import { createTRPCRouter, protectedProcedure } from "../trpc";
import { db } from "@/server/db";
import { position, transaction } from "@/server/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import { NewTransaction } from "@/server/models/inputs";
import { TRPCError } from "@trpc/server";
import { getLatestPrice } from "@/utils/alpaca/getPrice";

const getTransactions = protectedProcedure.query(async ({ ctx }) => {
  const { subject } = ctx;
  const data = await db.query.transaction.findMany({
    where: eq(transaction.userId, subject.id),
    orderBy: [desc(transaction.executedAt)],
  });
  return data;
});

const createTransaction = protectedProcedure
  .input(NewTransaction)
  .mutation(async ({ ctx, input }) => {
    const { subject } = ctx;
    const ticker = input.symbol.toUpperCase();
    const qty = input.quantity;
    const action = input.action;

    const livePrice = await getLatestPrice(ticker);

    // 1. INSERT transaction itself
    const [newTransaction] = await db
      .insert(transaction)
      .values({
        id: randomUUID(),
        userId: subject.id,
        symbol: ticker,
        quantity: qty.toString(),
        price: livePrice.toString(),
        action,
        executedAt: new Date(),
      })
      .returning();

    // 2. FETCH existing position for user + symbol
    const existing = await db.query.position.findFirst({
      where: and(eq(position.userId, subject.id), eq(position.symbol, ticker)),
    });

    // BUY LOGIC
    if (action === "buy") {
      if (!existing) {
        // Create new position
        await db.insert(position).values({
          id: randomUUID(),
          userId: subject.id,
          symbol: ticker,
          quantity: qty.toString(),
          avgCost: livePrice.toString(),
          lastUpdated: new Date(),
        });
      } else {
        // Update existing position using weighted average
        const oldQty = parseFloat(existing.quantity);
        const oldAvg = parseFloat(existing.avgCost);

        const newQty = oldQty + qty;
        const newAvg = (oldQty * oldAvg + qty * livePrice) / newQty;

        await db
          .update(position)
          .set({
            quantity: newQty.toString(),
            avgCost: newAvg.toString(),
            lastUpdated: new Date(),
          })
          .where(eq(position.id, existing.id));
      }
    }

    // SELL LOGIC
    if (action === "sell") {
      if (!existing) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "We don't offer short-selling yet",
        });
      }

      const oldQty = parseFloat(existing.quantity);
      const newQty = oldQty - qty;

      if (newQty < 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Sell quantity exceeds position quantity.",
        });
      }

      if (newQty === 0) {
        // Remove position entirely
        await db.delete(position).where(eq(position.id, existing.id));
      } else {
        // Keep avgCost the same for sells
        await db
          .update(position)
          .set({
            quantity: newQty.toString(),
            lastUpdated: new Date(),
          })
          .where(eq(position.id, existing.id));
      }
    }

    return newTransaction;
  });

const getTransactionStats = protectedProcedure.query(async ({ ctx }) => {
  const { subject } = ctx;
  const transactions = await db.query.transaction.findMany({
    where: eq(transaction.userId, subject.id),
  });

  let totalBought = 0;
  let totalSold = 0;
  const totalTransactions = transactions.length;

  transactions.forEach((txn) => {
    const amount = parseFloat(txn.quantity) * parseFloat(txn.price);
    if (txn.action === "buy") {
      totalBought += amount;
    } else {
      totalSold += amount;
    }
  });

  return {
    totalTransactions,
    totalBought,
    totalSold,
  };
});

export const transactionApiRouter = createTRPCRouter({
  getTransactions: getTransactions,
  createTransaction: createTransaction,
  getTransactionStats: getTransactionStats,
});
