import { TRPCError } from "@trpc/server";
import { alpaca } from "./clients";

export async function getLatestPrice(symbol: string): Promise<number> {
  const ticker = symbol.toUpperCase();

  try {
    // Try trade first
    const trade = await alpaca.getLatestTrade(ticker);
    if (trade && typeof trade.Price === "number" && trade.Price > 0) {
      return trade.Price;
    }

    // Try quote second
    const quote = await alpaca.getLatestQuote(ticker);
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
    const err = e as { statusCode?: number };

    // Alpaca throws 404 for invalid symbols → ticker not found
    if (err.statusCode === 404) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Symbol '${ticker}' not found on Alpaca`,
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
