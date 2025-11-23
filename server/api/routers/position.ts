/**
 * tRPC APIs that contains all of the functionality for creating,
 * reading, updating, and deleting data in our database relating to
 * profiles.
 *
 */

import { createTRPCRouter, protectedProcedure } from "../trpc";
import {
  PortfolioHistoryOutput,
  Positions,
  Price,
} from "@/server/models/responses";
import { db } from "@/server/db";
import { hourlyPortfolioSnapshot, position } from "@/server/db/schema";
import { eq, and, gte, asc } from "drizzle-orm";
import { z } from "zod";
import { getLatestPrice, getMultiplePrices } from "@/utils/alpaca/getPrice";
import { HistoryInterval, HistoryRange } from "@/server/models/inputs";

const getPositions = protectedProcedure
  .output(Positions)
  .query(async ({ ctx }) => {
    const { subject } = ctx;
    const raw = await db.query.position.findMany({
      where: eq(position.userId, subject.id),
    });
    // We wont throw error for empty array, that's a valid response //
    return Positions.parse(
      raw.map((pos) => ({
        ...pos,
        quantity: Number(pos.quantity),
        avgCost: Number(pos.avgCost),
        lastUpdated: pos.lastUpdated,
      })),
    );
  });

const getStockPrice = protectedProcedure
  .input(z.object({ symbol: z.string() }))
  .output(Price)
  .query(async ({ input }) => {
    const symbol = input.symbol.toUpperCase();
    try {
      const price = await getLatestPrice(symbol);
      return { symbol, price, success: true };
    } catch (error) {
      console.warn(`Using fallback price for ${symbol}`, error);
      return { symbol, price: 150.0, success: false };
    }
  });

const getStockPrices = protectedProcedure
  .input(z.object({ symbols: z.array(z.string()).min(1).max(50) }))
  .output(z.array(Price))
  .query(async ({ input }) => {
    const uniqueSymbols = [
      ...new Set(input.symbols.map((s) => s.toUpperCase())),
    ];

    try {
      const priceMap = await getMultiplePrices(uniqueSymbols);
      return uniqueSymbols.map((symbol) => {
        const price = priceMap[symbol];
        return {
          symbol,
          price: typeof price === "number" ? price : 150.0,
          success: typeof price === "number",
        };
      });
    } catch (error) {
      console.warn("Falling back to mock batch prices", error);
      return uniqueSymbols.map((symbol) => ({
        symbol,
        price: 150.0,
        success: false,
      }));
    }
  });

/* Helper Funcs for Portfolio History API */

function startDateForRange(range: "1D" | "1W" | "1M" | "1Y" | "YTD") {
  const now = new Date();
  const d = new Date(now);
  if (range === "1D") d.setDate(now.getDate() - 1);
  if (range === "1W") d.setDate(now.getDate() - 7);
  if (range === "1M") d.setMonth(now.getMonth() - 1);
  if (range === "1Y") d.setFullYear(now.getFullYear() - 1);
  if (range === "YTD") return new Date(now.getFullYear(), 0, 1); // Jan 1 of this year
  return d;
}

function floorToWeek(date: Date) {
  const d = new Date(date);

  // JS: 0 = Sun, 1 = Mon, ..., 6 = Sat
  // We convert so that Monday = 1 ... Sunday = 7
  const js = d.getDay(); // 0..6
  const iso = js === 0 ? 6 : js - 1; // Mon = 0,...Sun = 6

  // Move backwards to Monday (1)
  d.setDate(d.getDate() - iso);
  d.setHours(0, 0, 0, 0);

  return d;
}

function floorToMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export const getPortfolioHistory = protectedProcedure
  .input(
    z.object({
      range: HistoryRange,
      interval: HistoryInterval,
    }),
  )
  .output(PortfolioHistoryOutput)
  .query(async ({ ctx, input }) => {
    const { subject } = ctx;
    const { range, interval } = input;

    const since = startDateForRange(range);

    // Fetch all snapshots from the last X period
    const snapshots = await db
      .select()
      .from(hourlyPortfolioSnapshot)
      .where(
        and(
          eq(hourlyPortfolioSnapshot.userId, subject.id),
          gte(hourlyPortfolioSnapshot.timestamp, since),
        ),
      )
      .orderBy(asc(hourlyPortfolioSnapshot.timestamp));

    if (snapshots.length === 0) {
      return {
        points: [],
        startValue: 0,
        endValue: 0,
      };
    }

    // Group by the desired interval
    // Helper to pick a bucket label
    function bucketKey(ts: Date): string {
      if (interval === "hourly") {
        return ts.toISOString().slice(0, 13) + ":00:00"; // YYYY-MM-DDTHH:00:00
      }
      if (interval === "daily") {
        return ts.toISOString().split("T")[0];
      }
      if (interval === "weekly") {
        return floorToWeek(ts).toISOString().split("T")[0];
      }
      if (interval === "monthly") {
        const d = floorToMonth(ts);
        return d.toISOString().split("T")[0];
      }
      return "";
    }

    const map = new Map<string, number>();
    for (const snap of snapshots) {
      const ts = new Date(snap.timestamp);
      const key = bucketKey(ts);

      map.set(key, Number(snap.eohValue));
    }

    // Convert to sorted array
    const points = [...map.entries()]
      .map(([date, value]) => ({ date, value }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Compute start/end
    const startValue = points[0].value;
    const endValue = points[points.length - 1].value;

    return {
      points,
      startValue,
      endValue,
    };
  });

/**
 * Router for all position-related APIs.
 */
export const positionApiRouter = createTRPCRouter({
  getPositions: getPositions,
  getStockPrice: getStockPrice,
  getStockPrices: getStockPrices,
  getPortfolioHistory: getPortfolioHistory,
});
