import { createTRPCRouter, protectedProcedure } from "../trpc";
import {
  fetchSnapshots,
  fetchTopScreenerStocks,
} from "@/utils/alpaca/screener";
import { z } from "zod";

const ScreenerStock = z.object({
  ticker: z.string(),
  name: z.string(),
  sector: z.string().nullable(),
  industry: z.string().nullable(),
  exchange: z.string().nullable(),
  marketCap: z.number().nullable(),
  volume: z.number().nullable(),
  price: z.number(),
  changePercent: z.number(),
  volatility: z.enum(["low", "medium", "high"]),
  isEstimate: z.boolean(),
});

type ScreenerStock = z.infer<typeof ScreenerStock>;

const classifyVolatility = (
  changePercent: number,
): ScreenerStock["volatility"] => {
  const abs = Math.abs(changePercent);
  if (abs >= 3) return "high";
  if (abs >= 1.5) return "medium";
  return "low";
};

export const marketApiRouter = createTRPCRouter({
  getScreenerStocks: protectedProcedure
    .input(
      z
        .object({
          page: z.number().min(1).default(1),
          limit: z.number().min(1).max(100).default(50),
          sector: z.string().optional(),
          volatility: z.enum(["low", "medium", "high"]).optional(),
          minPrice: z.number().min(0).optional(),
          maxPrice: z.number().optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const screenerStocks = await fetchTopScreenerStocks(40);
      const symbols = screenerStocks.map((stock) => stock.symbol);
      const snapshots = await fetchSnapshots(symbols);

      let stocks = screenerStocks.map((stock) => {
        const snapshot = snapshots[stock.symbol] ?? null;
        const latestPrice =
          snapshot?.latestTrade?.p ??
          snapshot?.minuteBar?.c ??
          snapshot?.dailyBar?.c ??
          0;
        const prevClose =
          snapshot?.prevDailyBar?.c ?? snapshot?.dailyBar?.o ?? latestPrice;
        const changePercent = prevClose
          ? ((latestPrice - prevClose) / prevClose) * 100
          : 0;
        const volume = snapshot?.dailyBar?.v ?? stock.avg_vol ?? null;

        return {
          ticker: stock.symbol,
          name: stock.name,
          sector: stock.sector ?? null,
          industry: stock.industry ?? null,
          exchange: null,
          marketCap: stock.market_cap ?? null,
          volume,
          price: latestPrice,
          changePercent,
          volatility: classifyVolatility(changePercent),
          isEstimate: !Boolean(
            snapshot?.latestTrade?.p ||
              snapshot?.minuteBar?.c ||
              snapshot?.dailyBar?.c,
          ),
        } satisfies ScreenerStock;
      });

      // Apply filters
      if (input?.sector) {
        stocks = stocks.filter((stock) => stock.sector === input.sector);
      }
      if (input?.volatility) {
        stocks = stocks.filter(
          (stock) => stock.volatility === input.volatility,
        );
      }
      if (input?.minPrice !== undefined) {
        stocks = stocks.filter((stock) => stock.price >= input.minPrice!);
      }
      if (input?.maxPrice !== undefined) {
        stocks = stocks.filter((stock) => stock.price <= input.maxPrice!);
      }

      // Apply pagination
      const page = input?.page ?? 1;
      const limit = input?.limit ?? 50;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedStocks = stocks.slice(startIndex, endIndex);

      return {
        items: paginatedStocks,
        total: stocks.length,
        totalPages: Math.ceil(stocks.length / limit),
        currentPage: page,
      };
    }),

  getAvailableSectors: protectedProcedure.query(async () => {
    const screenerStocks = await fetchTopScreenerStocks(40);
    const sectors = new Set<string>();

    screenerStocks.forEach((stock) => {
      if (stock.sector) {
        sectors.add(stock.sector);
      }
    });

    return Array.from(sectors).sort();
  }),
});
