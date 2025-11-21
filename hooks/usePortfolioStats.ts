import { useMemo } from "react";
import { usePriceStore } from "@/store/priceStore";

interface Position {
  symbol: string;
  quantity: number;
  avgCost: number;
}

export function usePortfolioStats(
  positions: Position[],
  stats?: {
    totalRealizedPnl: number;
    totalDeposited: number;
    totalWithdrawn: number;
  },
) {
  // 1. Live Prices from Zustand Global Store
  const prices = usePriceStore((state) => state.prices);

  // Enrich each position with live market data + pnl metrics
  const enriched = useMemo(() => {
    return positions.map((p) => {
      const entry = prices[p.symbol.toUpperCase()];
      const currentPrice = entry?.price ?? p.avgCost;
      const isEstimate = !entry?.success;

      const marketValue = currentPrice * p.quantity;
      const costBasis = p.avgCost * p.quantity;
      const unrealized = marketValue - costBasis;

      return {
        symbol: p.symbol,
        quantity: p.quantity,
        avgCost: p.avgCost,
        currentPrice,
        marketValue,
        costBasis,
        unrealized,
        pnlPercent: costBasis > 0 ? (unrealized / costBasis) * 100 : 0,
        isEstimate,
      };
    });
  }, [positions, prices]); // update whenever prices or positions change

  // Aggregate metrics
  const totalMarketValue = enriched.reduce((s, p) => s + p.marketValue, 0);
  const totalCostBasis = enriched.reduce((s, p) => s + p.costBasis, 0);
  const totalUnrealized = enriched.reduce((s, p) => s + p.unrealized, 0);

  const realized = stats?.totalRealizedPnl ?? 0;
  const deposited = stats?.totalDeposited ?? 0;
  const withdrawn = stats?.totalWithdrawn ?? 0;

  const cash = deposited - withdrawn + realized; // cash from trades + deposits - withdrawals

  const nav = cash + totalMarketValue;
  const totalPnl = realized + totalUnrealized;
  const pnlPercent = totalCostBasis > 0 ? (totalPnl / totalCostBasis) * 100 : 0;

  // Best/Worst performers
  const bestPerformers = enriched
    .filter((p) => p.pnlPercent >= 0) // only positive
    .sort((a, b) => b.pnlPercent - a.pnlPercent)
    .slice(0, 5);

  const worstPerformers = enriched
    .filter((p) => p.pnlPercent <= 0) // only negative
    .sort((a, b) => a.pnlPercent - b.pnlPercent)
    .slice(0, 5);

  return {
    // big numbers
    nav,
    cash,
    realized,
    unrealized: totalUnrealized,
    totalPnl,
    pnlPercent,

    // breakdowns
    positions: enriched,
    bestPerformers,
    worstPerformers,

    // portfolio info
    totalMarketValue,
    totalCostBasis,
    deposited,
    withdrawn,
    count: positions.length,
  };
}
