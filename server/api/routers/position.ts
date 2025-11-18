/**
 * tRPC APIs that contains all of the functionality for creating,
 * reading, updating, and deleting data in our database relating to
 * profiles.
 *
 */

import { createTRPCRouter, protectedProcedure } from "../trpc";
import { Positions } from "@/server/models/responses";
import { db } from "@/server/db";
import { position } from "@/server/db/schema";
import { eq } from "drizzle-orm";
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
  .query(async ({ input }) => {
    try {
      const price = await getLatestPrice(input.symbol);
      return { symbol: input.symbol, price, success: true };
    } catch (error) {
      // Fallback to mock price
      console.warn(`Using mock price for ${input.symbol}:`, error);
      return { symbol: input.symbol, price: 150.0, success: false };
    }
  });

const getStockPrices = protectedProcedure
  .input(z.object({ symbols: z.array(z.string()).min(1).max(50) }))
  .query(async ({ input }) => {
    const uniqueSymbols = Array.from(
      new Set(input.symbols.map((symbol) => symbol.toUpperCase())),
    );

    try {
      const priceMap = await getMultiplePrices(uniqueSymbols);
      return uniqueSymbols.map((symbol) => {
        const price = priceMap[symbol];
        return {
          symbol,
          price: price ?? 150.0,
          success: typeof price === "number",
        };
      });
    } catch (error) {
      console.warn("Falling back to mock prices for batch request", error);
      return uniqueSymbols.map((symbol) => ({
        symbol,
        price: 150.0,
        success: false,
      }));
    }
  });

/**
 * Router for all position-related APIs.
 */
export const positionApiRouter = createTRPCRouter({
  getPositions: getPositions,
  getStockPrice: getStockPrice,
  getStockPrices: getStockPrices,
});
