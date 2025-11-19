/**
 * tRPC APIs that contains all of the functionality for creating,
 * reading, updating, and deleting data in our database relating to
 * profiles.
 *
 */

import { createTRPCRouter, protectedProcedure } from "../trpc";
import { Positions, Price } from "@/server/models/responses";
import { db } from "@/server/db";
import { position, transaction } from "@/server/db/schema";
import { eq, and, lte } from "drizzle-orm";
import { z } from "zod";
import { getLatestPrice, getMultiplePrices } from "@/utils/alpaca/getPrice";

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

const getPortfolioHistory = protectedProcedure
  .input(z.object({ days: z.number().min(7).max(365).default(30) }))
  .output(
    z.array(
      z.object({
        date: z.string(),
        value: z.number(),
      }),
    ),
  )
  .query(async ({ ctx, input }) => {
    const { subject } = ctx;
    const daysAgo = input.days;

    // Get all transactions for the user
    const transactions = await db.query.transaction.findMany({
      where: eq(transaction.userId, subject.id),
      orderBy: (transaction, { asc }) => [asc(transaction.executedAt)],
    });

    if (transactions.length === 0) {
      return [];
    }

    // Find the earliest transaction date
    const firstTransactionDate = new Date(transactions[0].executedAt);
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - daysAgo);

    // Use the later of first transaction date or requested start date
    const effectiveStartDate =
      firstTransactionDate > startDate ? firstTransactionDate : startDate;

    // Generate daily snapshots
    const dailySnapshots: { date: string; value: number }[] = [];
    const currentDate = new Date(effectiveStartDate);
    currentDate.setHours(0, 0, 0, 0);

    while (currentDate <= today) {
      const dateStr = currentDate.toISOString().split("T")[0];
      const endOfDay = new Date(currentDate);
      endOfDay.setHours(23, 59, 59, 999);

      // Get all transactions up to this date
      const txnsUpToDate = transactions.filter(
        (txn) => new Date(txn.executedAt) <= endOfDay,
      );

      // Calculate positions at this point in time
      const positionsMap = new Map<
        string,
        { quantity: number; avgCost: number }
      >();

      for (const txn of txnsUpToDate) {
        const symbol = txn.symbol;
        const qty = parseFloat(txn.quantity);
        const price = parseFloat(txn.price);
        const existing = positionsMap.get(symbol) || {
          quantity: 0,
          avgCost: 0,
        };

        if (txn.action === "buy") {
          const newQty = existing.quantity + qty;
          const newAvg =
            newQty > 0
              ? (existing.quantity * existing.avgCost + qty * price) / newQty
              : price;
          positionsMap.set(symbol, { quantity: newQty, avgCost: newAvg });
        } else {
          // sell
          const newQty = existing.quantity - qty;
          if (newQty > 0) {
            positionsMap.set(symbol, {
              quantity: newQty,
              avgCost: existing.avgCost,
            });
          } else {
            positionsMap.delete(symbol);
          }
        }
      }

      // Calculate total portfolio value at historical cost basis
      // In a real scenario, you'd fetch historical prices, but for simplicity
      // we'll use the cost basis as an approximation
      let totalValue = 0;
      for (const [symbol, pos] of positionsMap.entries()) {
        totalValue += pos.quantity * pos.avgCost;
      }

      dailySnapshots.push({ date: dateStr, value: totalValue });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return dailySnapshots;
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
