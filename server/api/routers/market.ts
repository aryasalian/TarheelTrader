import { createTRPCRouter, protectedProcedure } from "../trpc";
import {
  fetchSnapshots,
  fetchTopScreenerStocks,
} from "@/utils/alpaca/screener";
import crypto from "node:crypto";
import { getLatestPrice } from "@/utils/alpaca/getPrice";
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

const MIN_PRICE = 1;
const MIN_VOLUME = 10_000;
const SCREENER_CACHE_TTL_MS = 1000 * 30;

type ScreenerCacheEntry = {
  timestamp: number;
  items: ScreenerStock[];
};

const screenerCache = new Map<string, ScreenerCacheEntry>();

function buildCacheKey(input: {
  sector?: string;
  volatility?: ScreenerStock["volatility"];
  minPrice?: number;
  maxPrice?: number;
}) {
  return crypto
    .createHash("md5")
    .update(
      JSON.stringify({
        sector: input.sector ?? "all",
        volatility: input.volatility ?? "all",
        minPrice: input.minPrice ?? MIN_PRICE,
        maxPrice: input.maxPrice ?? undefined,
      }),
    )
    .digest("hex");
}

export const marketApiRouter = createTRPCRouter({
  getScreenerStocks: protectedProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(50),
        sector: z.string().optional(),
        minPrice: z.number().optional(),
        maxPrice: z.number().optional(),
        volatility: z.enum(["low", "medium", "high"]).optional(),
      }),
    )
    .query(async ({ input }) => {
      const cacheKey = buildCacheKey(input);
      const now = Date.now();
      const cachedEntry = screenerCache.get(cacheKey);

      const buildResponse = (items: ScreenerStock[]) => {
        const total = items.length;
        const totalPages = total > 0 ? Math.ceil(total / input.limit) : 0;
        const safePage = Math.min(input.page, Math.max(totalPages, 1));
        const start = (safePage - 1) * input.limit;
        const end = start + input.limit;
        return {
          items: items.slice(start, end),
          total,
          totalPages,
          page: safePage,
        } as const;
      };

      if (cachedEntry && now - cachedEntry.timestamp < SCREENER_CACHE_TTL_MS) {
        return buildResponse(cachedEntry.items);
      }

      const rawStocks = await fetchTopScreenerStocks(500);
      const symbols = rawStocks.map((stock) => stock.symbol);
      const snapshots = await fetchSnapshots(symbols);

      const processedStocks = rawStocks.map((stock) => {
        const snapshot = snapshots[stock.symbol] ?? null;
        const latestPrice =
          snapshot?.latestTrade?.p ??
          snapshot?.minuteBar?.c ??
          snapshot?.dailyBar?.c ??
          snapshot?.prevDailyBar?.c ??
          snapshot?.dailyBar?.o ??
          0;
        const prevClose =
          snapshot?.prevDailyBar?.c ??
          snapshot?.dailyBar?.o ??
          snapshot?.dailyBar?.c ??
          snapshot?.minuteBar?.c ??
          latestPrice;
        const changePercent = prevClose
          ? ((latestPrice - prevClose) / prevClose) * 100
          : 0;
        const volume =
          snapshot?.dailyBar?.v ??
          snapshot?.prevDailyBar?.v ??
          snapshot?.minuteBar?.v ??
          stock.avg_vol ??
          null;

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

      const nonPriceFiltered = processedStocks
        .filter((stock) => {
          if (
            stock.volume !== null &&
            stock.volume !== undefined &&
            stock.volume < MIN_VOLUME
          ) {
            return false;
          }
          if (
            input.sector &&
            input.sector !== "all" &&
            stock.sector?.toLowerCase() !== input.sector.toLowerCase()
          ) {
            return false;
          }
          if (input.volatility && stock.volatility !== input.volatility) {
            return false;
          }
          return true;
        })
        .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0));

      const fallbackBudget = Math.min(
        nonPriceFiltered.length,
        Math.max(1, input.page) * input.limit * 2,
      );

      const missingPriceSymbols = nonPriceFiltered
        .filter((stock) => !stock.price || stock.price <= 0)
        .slice(0, fallbackBudget)
        .map((stock) => stock.ticker);

      if (missingPriceSymbols.length > 0) {
        const FALLBACK_CHUNK_SIZE = 10;
        for (let i = 0; i < missingPriceSymbols.length; i += FALLBACK_CHUNK_SIZE) {
          const chunk = missingPriceSymbols.slice(i, i + FALLBACK_CHUNK_SIZE);
          await Promise.all(
            chunk.map(async (symbol) => {
              try {
                const price = await getLatestPrice(symbol);
                const target = nonPriceFiltered.find((stock) => stock.ticker === symbol);
                if (target && price > 0) {
                  target.price = price;
                  target.isEstimate = true;
                }
              } catch (error) {
                if (
                  error instanceof Error &&
                  "code" in error &&
                  (error as { code?: string }).code === "TOO_MANY_REQUESTS"
                ) {
                  return;
                }
              }
            }),
          );
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }

      const filtered = nonPriceFiltered.filter((stock) => {
        if (!stock.price || Number.isNaN(stock.price) || stock.price < MIN_PRICE) {
          return false;
        }
        if (input.minPrice !== undefined && stock.price < input.minPrice) {
          return false;
        }
        if (input.maxPrice !== undefined && stock.price > input.maxPrice) {
          return false;
        }
        return true;
      });

      screenerCache.set(cacheKey, { timestamp: now, items: filtered });

      return buildResponse(filtered);
    }),
});
