import { createTRPCRouter, protectedProcedure } from "../trpc";
import { z } from "zod";
import { getLatestPrice, getMultiplePrices } from "@/utils/alpaca/getPrice";

export const getStockPrice = protectedProcedure
  .input(z.object({ symbol: z.string() }))
  .output(
    z.object({
      symbol: z.string(),
      price: z.number(),
      success: z.boolean(),
    }),
  )
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

export const getStockPrices = protectedProcedure
  .input(z.object({ symbols: z.array(z.string()).min(1).max(50) }))
  .output(
    z.array(
      z.object({
        symbol: z.string(),
        price: z.number(),
        success: z.boolean(),
      }),
    ),
  )
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

/**
 * Router for all position-related APIs.
 */
export const pricesApiRouter = createTRPCRouter({
  getStockPrice: getStockPrice,
  getStockPrices: getStockPrices,
});
