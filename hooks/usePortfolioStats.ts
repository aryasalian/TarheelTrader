import { useMemo } from "react";
import { usePriceStore } from "@/store/priceStore";

interface Position {
  symbol: string;
  quantity: number;
  avgCost: number;
}

export function usePortfolioStats(
  positions: Position[],
  stats?: { totalRealizedPnl: number },
) {
  // 1. Live Prices from Zustand Global Store
  const prices = usePriceStore((state) => state.prices);

  // Enrich each position with live market data + pnl metrics
  const enriched = useMemo(() => {
    return positions.map((p) => {
      const entry = prices[p.symbol.toUpperCase()];
      const currentPrice = entry?.price ?? p.avgCost;
      const isEstimate = entry ? !entry.success : true;

      const totalCost = p.avgCost * p.quantity;
      const marketValue = currentPrice * p.quantity;
      const pnl = marketValue - totalCost;

      return {
        symbol: p.symbol,
        quantity: p.quantity,
        avgCost: p.avgCost,
        currentPrice,
        isEstimate,
        marketValue,
        totalCost,
        pnl, // unrealized
        pnlPercent: totalCost > 0 ? (pnl / totalCost) * 100 : 0,
      };
    });
  }, [positions, prices]); // update whenever prices or positions change

  // Aggregate metrics
  const totalMarketValue = enriched.reduce((sum, p) => sum + p.marketValue, 0);
  const totalCostBasis = enriched.reduce((sum, p) => sum + p.totalCost, 0);
  const unrealized = enriched.reduce((sum, p) => sum + p.pnl, 0);

  const realized = stats?.totalRealizedPnl ?? 0;

  const totalPnl = unrealized + realized;
  const pnlPercent = totalCostBasis > 0 ? (totalPnl / totalCostBasis) * 100 : 0;

  const nav = totalMarketValue + realized;

  // Best/Worst performer
  let best: (typeof enriched)[number] | null = null;
  let worst: (typeof enriched)[number] | null = null;
  for (const pos of enriched) {
    if (!best || pos.pnlPercent > best.pnlPercent) best = pos;
    if (!worst || pos.pnlPercent < worst.pnlPercent) worst = pos;
  }

  return {
    // Core portfolio metrics
    nav,
    totalMarketValue,
    totalCostBasis,
    unrealized,
    realized,
    totalPnl,
    pnlPercent,

    // Enriched rows
    positions: enriched,
    count: positions.length,

    // Top/bottom performers
    best,
    worst,
  };
}
