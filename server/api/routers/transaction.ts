import { createTRPCRouter, protectedProcedure } from "../trpc";
import { db } from "@/server/db";
import { position, transaction } from "@/server/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import { NewTransaction } from "@/server/models/inputs";
import { TRPCError } from "@trpc/server";
import { getLatestPrice } from "@/utils/alpaca/getPrice";
import { Transactions, TransactionStats } from "@/server/models/responses";

const getTransactions = protectedProcedure
  .output(Transactions)
  .query(async ({ ctx }) => {
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
    const action = input.action;

    // --------------------------
    // DEPOSIT / WITHDRAWAL LOGIC
    // --------------------------
    if (action === "deposit" || action === "withdraw") {
      if (!input.amount || input.amount <= 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Amount must be positive",
        });
      }

      await db.insert(transaction).values({
        id: randomUUID(),
        userId: subject.id,
        symbol: null,
        quantity: null,
        price: input.amount.toString(), // cash movement stored in price field
        realizedPnl: "0",
        action,
        executedAt: new Date(),
      });

      return { success: true };
    }

    // --------------------------
    // BUY / SELL LOGIC
    // --------------------------
    const ticker = input.symbol?.toUpperCase();
    const qty = input.quantity;

    if (!ticker || !qty) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Symbol and quantity required",
      });
    }

    const livePrice = await getLatestPrice(ticker);
    let realizedPnl = 0; // won't be editted for buys

    // 1. FETCH existing position for user + symbol
    const existing = await db.query.position.findFirst({
      where: and(eq(position.userId, subject.id), eq(position.symbol, ticker)),
    });

    // 2. CREATE positions
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

      // Realized PnL for this trade
      realizedPnl = (livePrice - parseFloat(existing.avgCost)) * qty;
      const oldQty = parseFloat(existing.quantity);
      const newQty = oldQty - qty;

      if (newQty < 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Sell quantity exceeds position quantity",
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

    // 3. INSERT transaction
    const [newTransaction] = await db
      .insert(transaction)
      .values({
        id: randomUUID(),
        userId: subject.id,
        symbol: ticker,
        quantity: qty.toString(),
        price: livePrice.toString(),
        realizedPnl: realizedPnl.toString(), // 0 for buys, non-zero for sells
        action,
        executedAt: new Date(),
      })
      .returning();

    return newTransaction;
  });

const getTransactionStats = protectedProcedure
  .output(TransactionStats)
  .query(async ({ ctx }) => {
    const { subject } = ctx;
    const transactions = await db.query.transaction.findMany({
      where: eq(transaction.userId, subject.id),
    });

    let totalBought = 0;
    let totalSold = 0;
    let totalRealizedPnl = 0;
    let totalDeposited = 0;
    let totalWithdrawn = 0;
    const totalTransactions = transactions.length;

    for (const txn of transactions) {
      const price = parseFloat(txn.price);
      const qty = txn.quantity ? parseFloat(txn.quantity) : null;

      switch (txn.action) {
        case "buy": {
          if (qty !== null) totalBought += qty * price;
          break;
        }

        case "sell": {
          if (qty !== null) totalSold += qty * price;
          totalRealizedPnl += parseFloat(txn.realizedPnl);
          break;
        }

        case "deposit": {
          totalDeposited += price;
          break;
        }

        case "withdraw": {
          totalWithdrawn += price;
          break;
        }
      }
    }

    return {
      totalTransactions,
      totalBought,
      totalSold,
      totalDeposited,
      totalWithdrawn,
      totalRealizedPnl,
    };
  });

export const transactionApiRouter = createTRPCRouter({
  getTransactions: getTransactions,
  createTransaction: createTransaction,
  getTransactionStats: getTransactionStats,
});
