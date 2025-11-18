import { alpaca } from "./clients";

export async function getLatestPrice(symbol: string): Promise<number> {
  try {
    const trade = await alpaca.getLatestTrade(symbol);
    if (trade && trade.Price) {
      return trade.Price;
    }

    const quote = await alpaca.getLatestQuote(symbol);
    if (quote) {
      const { BidPrice, AskPrice } = quote;
      const mid =
        BidPrice && AskPrice ? (BidPrice + AskPrice) / 2 : BidPrice || AskPrice;
      if (mid) return mid;
    }

    throw new Error(`No market data available for ${symbol}`);
  } catch (error) {
    console.error(`Alpaca API error for ${symbol}:`, error);
    throw error;
  }
}

export async function getMultiplePrices(
  symbols: string[],
): Promise<Record<string, number>> {
  const prices: Record<string, number> = {};

  await Promise.all(
    symbols.map(async (symbol) => {
      try {
        prices[symbol] = await getLatestPrice(symbol);
      } catch {
        console.error(`Failed to fetch price for ${symbol}`);
      }
    }),
  );

  return prices;
}
