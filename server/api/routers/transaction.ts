import { createTRPCRouter, protectedProcedure } from "../trpc";
import { db } from "@/server/db";
import { transaction } from "@/server/db/schema";
import { eq, desc } from "drizzle-orm";
import z from "zod";
import { randomUUID } from "crypto";

const getTransactions = protectedProcedure
  .query(async ({ ctx }) => {
    const { subject } = ctx;
    const data = await db.query.transaction.findMany({
      where: eq(transaction.userId, subject.id),
      orderBy: [desc(transaction.executedAt)],
    });
    return data;
  });

const createTransaction = protectedProcedure
  .input(z.object({
    symbol: z.string(),
    quantity: z.number(),
    price: z.number(),
    action: z.enum(["buy", "sell"]),
  }))
  .mutation(async ({ ctx, input }) => {
    const { subject } = ctx;
    const [newTransaction] = await db.insert(transaction).values({
      id: randomUUID(),
      userId: subject.id,
      symbol: input.symbol,
      quantity: input.quantity.toString(),
      price: input.price.toString(),
      action: input.action,
      executedAt: new Date(),
    }).returning();
    return newTransaction;
  });

const getTransactionStats = protectedProcedure
  .query(async ({ ctx }) => {
    const { subject } = ctx;
    const transactions = await db.query.transaction.findMany({
      where: eq(transaction.userId, subject.id),
    });

    let totalBought = 0;
    let totalSold = 0;
    let totalTransactions = transactions.length;

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
