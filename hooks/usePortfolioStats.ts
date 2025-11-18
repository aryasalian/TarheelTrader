import { useMemo } from "react";
import { usePriceStore } from "@/store/priceStore";

interface Position {
  symbol: string;
  quantity: number;
  avgCost: number;
}

export function usePortfolioStats(positions: Position[]) {
  // 1. Live Prices from Zustand Global Store
  const prices = usePriceStore((state) => state.prices);

  // 2. Compute total portfolio value using memo
  const nav = useMemo(() => {
    if (!positions || positions.length === 0) return 0;
    return positions.reduce((sum, p) => {
      const entry = prices[p.symbol.toUpperCase()];
      const price = entry?.price ?? 0;
      return sum + p.quantity * price;
    }, 0);
  }, [positions, prices]);

  // 3. Calculated cost basis
  const totalCost = useMemo(() => {
    return positions.reduce((sum, p) => sum + p.avgCost * p.quantity, 0);
  }, [positions]);

  // 4. PnL and PnL%
  const pnl = nav - totalCost;
  const pnlPercent = totalCost > 0 ? (pnl / totalCost) * 100 : 0; // if denom=0, math error

  // 5. Ticker-level stats
  const enriched = useMemo(() => {
    return positions.map((p) => {
      const entry = prices[p.symbol.toUpperCase()];
      const currentPrice = entry?.price ?? p.avgCost;
      const isEstimate = !entry?.success;

      const marketValue = currentPrice * p.quantity;
      const totalCost = p.avgCost * p.quantity;
      const pnl = marketValue - totalCost;

      return {
        symbol: p.symbol,
        quantity: p.quantity,
        avgCost: p.avgCost,
        currentPrice,
        marketValue,
        totalCost,
        pnl,
        pnlPercent: totalCost > 0 ? (pnl / totalCost) * 100 : 0,
        isEstimate,
      };
    });
  }, [positions, prices]); // update whenever prices or positions change

  // 6. Best & worst performers
  let best = null;
  let worst = null;
  for (const pos of enriched) {
    if (!best || pos.pnlPercent > best.pnlPercent) best = pos;
    if (!worst || pos.pnlPercent < worst.pnlPercent) worst = pos;
  }

  return {
    totalCost,
    nav,
    pnl,
    pnlPercent,
    best,
    worst,
    positions: enriched,
    count: positions.length,
  };
}
