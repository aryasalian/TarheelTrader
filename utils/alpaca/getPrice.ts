import { alpaca } from "./clients";

export async function getLatestPrice(symbol: string): Promise<number> {
  const response = await alpaca.getLatestQuote(symbol);

  // Alpaca returns nested objects like:
  // { BidPrice: number, AskPrice: number, ... }
  // The "official" last price is (bid + ask) / 2

  const { BidPrice, AskPrice } = response;

  // fallback if data missing
  const mid =
    BidPrice && AskPrice ? (BidPrice + AskPrice) / 2 : BidPrice || AskPrice;

  if (!mid) throw new Error("No market data available for " + symbol);

  return mid;
}
