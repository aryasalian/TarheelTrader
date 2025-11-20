/**
 * This file defines the entire database schema - including all tables and relations.
 *
 * To configure the Supabase database using this schema as a guide, use the command:
 * ```
 * npx drizzle-kit push
 * ```
 *
 * @author Ajay Gandecha <agandecha@unc.edu>
 * @license MIT
 * @see https://comp426-25f.github.io/
 */

import {
  pgTable,
  pgEnum,
  uuid,
  text,
  numeric,
  timestamp,
  boolean,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/* ENUMS */
export const actionEnum = pgEnum("action_enum", ["buy", "sell"]);
export const notificationTypeEnum = pgEnum("notification_type_enum", [
  "transaction",
  "watchlist",
]);

/* TABLES */
// profiles
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  username: text("username").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  avatarUrl: text("avatar_url"), // nullable
});

// position
export const position = pgTable("position", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => profiles.id),
  symbol: text("symbol").notNull(),
  quantity: numeric("quantity").notNull(),
  avgCost: numeric("avg_cost").notNull(),
  lastUpdated: timestamp("last_updated"), // nullable
});

// transaction
export const transaction = pgTable("transaction", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => profiles.id),
  symbol: text("symbol").notNull(),
  quantity: numeric("quantity").notNull(),
  price: numeric("price").notNull(),
  realizedPnl: numeric("realized_pnl").notNull().default("0"), // ONLY non-zero for sells
  executedAt: timestamp("executed_at").notNull(),
  action: actionEnum("action").notNull(),
});

// hourly_portfolio_snapshot
export const hourlyPortfolioSnapshot = pgTable(
  "hourly_portfolio_snapshot",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id),
    eohValue: numeric("eoh_value").notNull(),
    timestamp: timestamp("timestamp").notNull(),
  },
  (table) => {
    return {
      uniqueUserHour: unique().on(table.userId, table.timestamp),
    };
  },
);

// watchlist_items
export const watchlistItems = pgTable("watchlist_items", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => profiles.id),
  symbol: text("symbol").notNull(),
  addedAt: timestamp("added_at").notNull().defaultNow(),
});

// notification
export const notification = pgTable("notification", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => profiles.id),
  type: notificationTypeEnum("type").notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/* RELATIONS */
// profiles -> children
export const profilesRelations = relations(profiles, ({ many }) => ({
  positions: many(position),
  transactions: many(transaction),
  snapshots: many(hourlyPortfolioSnapshot),
  watchlist: many(watchlistItems),
  notifications: many(notification),
}));

// position -> profiles
export const positionRelations = relations(position, ({ one }) => ({
  user: one(profiles, {
    fields: [position.userId],
    references: [profiles.id],
  }),
}));

// transaction -> profiles
export const transactionRelations = relations(transaction, ({ one }) => ({
  user: one(profiles, {
    fields: [transaction.userId],
    references: [profiles.id],
  }),
}));

// snapshot -> profiles
export const snapshotRelations = relations(
  hourlyPortfolioSnapshot,
  ({ one }) => ({
    user: one(profiles, {
      fields: [hourlyPortfolioSnapshot.userId],
      references: [profiles.id],
    }),
  }),
);

// watchlist -> profiles
export const watchlistRelations = relations(watchlistItems, ({ one }) => ({
  user: one(profiles, {
    fields: [watchlistItems.userId],
    references: [profiles.id],
  }),
}));

// notification -> profiles
export const notificationRelations = relations(notification, ({ one }) => ({
  user: one(profiles, {
    fields: [notification.userId],
    references: [profiles.id],
  }),
}));
