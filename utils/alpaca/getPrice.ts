import { TRPCError } from "@trpc/server";
import { alpaca } from "./clients";

const RATE_LIMIT_DELAY_MS = 400;
const RATE_LIMIT_MAX_ATTEMPTS = 3;

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
    const isRateLimit = msg.includes("code: 429") || msg.includes("too many requests");
    if (isRateLimit && attempt < RATE_LIMIT_MAX_ATTEMPTS) {
      const backoff = RATE_LIMIT_DELAY_MS * attempt;
      await delay(backoff);
      return withRateLimitRetry(operation, attempt + 1);
    }
    throw error;
  }
}

export async function getLatestPrice(symbol: string): Promise<number> {
  const ticker = symbol.toUpperCase();

  try {
    // Try trade first
    const trade = await withRateLimitRetry(() => alpaca.getLatestTrade(ticker));
    if (trade && typeof trade.Price === "number" && trade.Price > 0) {
      return trade.Price;
    }

    // Try quote second
    const quote = await withRateLimitRetry(() => alpaca.getLatestQuote(ticker));
    if (quote) {
      const bid = quote.BidPrice;
      const ask = quote.AskPrice;
      // Compute a safe midprice
      if (
        typeof bid === "number" &&
        typeof ask === "number" &&
        bid > 0 &&
        ask > 0
      ) {
        return (bid + ask) / 2;
      }
      if (typeof bid === "number" && bid > 0) return bid; // if ask & mid doesn't exist
      if (typeof ask === "number" && ask > 0) return ask; // if bid & mid doesn't exist
    }

    // If BOTH trade + quote failed → Order book too shallow
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Symbol '${ticker}' has a shallow order-book. No quotes could be found.`,
    });
  } catch (e: unknown) {
    const msg = String(e);

    // Alpaca invalid ticker cases
    if (msg.includes("no trade found") || msg.includes("code: 404")) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Symbol '${ticker}' not found on Alpaca`,
      });
    }

    // Alpaca rate limit cases
    if (msg.includes("code: 429") || msg.includes("too many requests")) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "Alpaca rate limit exceeded",
      });
    }

    // Otherwise real server issue
    console.log("Alpaca error:", e);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to fetch latest price from Alpaca",
    });
  }
}

export async function getMultiplePrices(
  symbols: string[],
): Promise<Record<string, number>> {
  const prices: Record<string, number> = {};

  await Promise.all(
    symbols.map(async (symbol) => {
      prices[symbol] = await getLatestPrice(symbol);
    }),
  );

  return prices;
}
