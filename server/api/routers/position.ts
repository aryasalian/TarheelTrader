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
import z from "zod";

const getPositions = protectedProcedure
  .output(Positions)
  .query(async ({ ctx }) => {
    const { subject } = ctx;
    const data = await db.query.position.findMany({
      where: eq(position.userId, subject.id),
    });
    // We wont throw error for empty array, that's a valid response //
    return Positions.parse(data);
  });

const getPortfolioValue = protectedProcedure
  .output(z.number())
  .query(async ({ ctx }) => {
    const { subject } = ctx;
    // Get all positions
    const positions = Positions.parse(
      await db.query.position.findMany({
        where: eq(position.userId, subject.id),
      }),
    );

    if (positions.length === 0) {
      return 0; // empty portfolio
    }

    // Fetch market prices from Alpaca
    // TODO: replace with Alpaca API call

    // Price lookup per symbol
    const fetchPrice = async (symbol: string): Promise<number> => {
      // just mocking for now, you replace it later
      return 100;
    };

    let total = 0;
    for (const pos of positions) {
      const price = await fetchPrice(pos.symbol);
      total += pos.quantity * price;
    }

    // Return the portfolio value
    return z.number().parse(total);
  });

/**
 * Router for all position-related APIs.
 */
export const positionApiRouter = createTRPCRouter({
  getPositions: getPositions,
  getPortfolioValue: getPortfolioValue,
});
