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
    totalBought: number;
    totalSold: number;
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
  const totalMarketValue = enriched.reduce((s, p) => s + p.marketValue, 0); // Open Positions Value
  const totalCostBasis = enriched.reduce((s, p) => s + p.costBasis, 0); // Open Positions Cost
  const totalUnrealized = enriched.reduce((s, p) => s + p.unrealized, 0);

  const realized =
    (stats?.totalSold ?? 0) - ((stats?.totalBought ?? 0) - totalCostBasis);
  const cash =
    (stats?.totalDeposited ?? 0) -
    (stats?.totalWithdrawn ?? 0) +
    (stats?.totalSold ?? 0) -
    (stats?.totalBought ?? 0); // cash from trades + deposits - withdrawals

  const nav = cash + totalMarketValue;
  const totalPnl = realized + totalUnrealized;
  const pnlPercent =
    (stats?.totalDeposited ?? 0) > 0
      ? (totalPnl / (stats?.totalDeposited ?? 0)) * 100
      : 0;

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
    count: positions.length,
  };
}
