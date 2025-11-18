import { createTRPCRouter, protectedProcedure } from "../trpc";
import { db } from "@/server/db";
import { watchlistItems } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import z from "zod";
import { randomUUID } from "crypto";

const getWatchlist = protectedProcedure
  .query(async ({ ctx }) => {
    const { subject } = ctx;
    const data = await db.query.watchlistItems.findMany({
      where: eq(watchlistItems.userId, subject.id),
    });
    return data;
  });

const addToWatchlist = protectedProcedure
  .input(z.object({
    symbol: z.string(),
  }))
  .mutation(async ({ ctx, input }) => {
    const { subject } = ctx;
    
    const existing = await db.query.watchlistItems.findFirst({
      where: and(
        eq(watchlistItems.userId, subject.id),
        eq(watchlistItems.symbol, input.symbol)
      ),
    });

    if (existing) {
      throw new Error("Symbol already in watchlist");
    }

    const [newItem] = await db.insert(watchlistItems).values({
      id: randomUUID(),
      userId: subject.id,
      symbol: input.symbol,
      addedAt: new Date(),
    }).returning();
    
    return newItem;
  });

const removeFromWatchlist = protectedProcedure
  .input(z.object({
    id: z.string(),
  }))
  .mutation(async ({ ctx, input }) => {
    const { subject } = ctx;
    
    await db.delete(watchlistItems)
      .where(and(
        eq(watchlistItems.id, input.id),
        eq(watchlistItems.userId, subject.id)
      ));
    
    return { success: true };
  });

export const watchlistApiRouter = createTRPCRouter({
  getWatchlist: getWatchlist,
  addToWatchlist: addToWatchlist,
  removeFromWatchlist: removeFromWatchlist,
});
