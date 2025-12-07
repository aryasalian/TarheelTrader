import { TRPCError } from "@trpc/server";
import { alpaca } from "./clients";

const RATE_LIMIT_DELAY_MS = 400;
const RATE_LIMIT_MAX_ATTEMPTS = 3;
const CACHE_TTL_MS = 10000;

const priceCache = new Map<string, { price: number; timestamp: number }>();

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRateLimitRetry<T>(
  operation: () => Promise<T>,
  attempt = 1,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const msg = String(error);
    const isRateLimit =
      msg.includes("code: 429") || msg.includes("too many requests");
    if (isRateLimit && attempt < RATE_LIMIT_MAX_ATTEMPTS) {
      const backoff = RATE_LIMIT_DELAY_MS * attempt;
      await delay(backoff);
      return withRateLimitRetry(operation, attempt + 1);
    }
    throw error;
  }
}

export async function getLatestPrice(
  symbol: string,
  useCache = true,
): Promise<number> {
  const ticker = symbol.toUpperCase();

  if (useCache) {
    const cached = priceCache.get(ticker);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.price;
    }
  }

  try {
    const trade = await withRateLimitRetry(() => alpaca.getLatestTrade(ticker));
    if (trade && typeof trade.Price === "number" && trade.Price > 0) {
      const price = trade.Price;
      priceCache.set(ticker, { price, timestamp: Date.now() });
      return price;
    }

    const quote = await withRateLimitRetry(() => alpaca.getLatestQuote(ticker));
    if (quote) {
      const bid = quote.BidPrice;
      const ask = quote.AskPrice;
      if (
        typeof bid === "number" &&
        typeof ask === "number" &&
        bid > 0 &&
        ask > 0
      ) {
        const price = (bid + ask) / 2;
        priceCache.set(ticker, { price, timestamp: Date.now() });
        return price;
      }
      if (typeof bid === "number" && bid > 0) {
        priceCache.set(ticker, { price: bid, timestamp: Date.now() });
        return bid;
      }
      if (typeof ask === "number" && ask > 0) {
        priceCache.set(ticker, { price: ask, timestamp: Date.now() });
        return ask;
      }
    }

    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Symbol '${ticker}' has a shallow order-book. No quotes could be found.`,
    });
  } catch (e: unknown) {
    const msg = String(e);

    if (msg.includes("no trade found") || msg.includes("code: 404")) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Symbol '${ticker}' not found on Alpaca`,
      });
    }

    if (msg.includes("code: 429") || msg.includes("too many requests")) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "Alpaca rate limit exceeded",
      });
    }

    console.log("Alpaca error:", e);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to fetch latest price from Alpaca",
    });
  }
}

export async function getMultiplePrices(
  symbols: string[],
  useCache = true,
): Promise<Record<string, number>> {
  const prices: Record<string, number> = {};
  const uniqueSymbols = [...new Set(symbols.map((s) => s.toUpperCase()))];

  const uncached: string[] = [];

  if (useCache) {
    for (const symbol of uniqueSymbols) {
      const cached = priceCache.get(symbol);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        prices[symbol] = cached.price;
      } else {
        uncached.push(symbol);
      }
    }
  } else {
    uncached.push(...uniqueSymbols);
  }

  if (uncached.length > 0) {
    const BATCH_SIZE = 5;
    for (let i = 0; i < uncached.length; i += BATCH_SIZE) {
      const batch = uncached.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((symbol) => getLatestPrice(symbol, false)),
      );

      results.forEach((result, idx) => {
        const symbol = batch[idx];
        if (result.status === "fulfilled") {
          prices[symbol] = result.value;
        }
      });

      if (i + BATCH_SIZE < uncached.length) {
        await delay(100);
      }
    }
  }

  return prices;
}
