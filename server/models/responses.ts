/**
 * This file contains all of the Zod validation models
 * used to ensure that our tRPC API functions ultimately
 * return data in the correct format.
 */

import { z } from "zod";

export const Profile = z.object({
  id: z.string(),
  username: z.string(),
  createdAt: z.string().datetime(),
  avatarUrl: z.string().nullish(),
});

export const Positions = z.array(
  z.object({
    id: z.string(),
    userId: z.string(),
    symbol: z.string(),
    quantity: z.number(),
    avgCost: z.number(),
    lastUpdated: z.date().nullable(),
  }),
);

export const Price = z.object({
  symbol: z.string(),
  price: z.number(),
  success: z.boolean(),
});

export const Transaction = z.object({
  id: z.string(),
  userId: z.string(),
  symbol: z.string().nullish(),
  quantity: z.string().nullish(),
  price: z.string(),
  realizedPnl: z.string(),
  executedAt: z.date(),
  action: z.enum(["buy", "sell", "deposit", "withdraw"]),
});

export const Transactions = z.array(Transaction);

export const WatchlistItem = z.object({
  id: z.string(),
  userId: z.string(),
  symbol: z.string(),
  addedAt: z.date(),
});

export const WatchlistItems = z.array(WatchlistItem);

export const TransactionStats = z.object({
  totalTransactions: z.number(),
  totalBought: z.number(),
  totalSold: z.number(),
  totalDeposited: z.number(),
  totalWithdrawn: z.number(),
  totalRealizedPnl: z.number(),
});
