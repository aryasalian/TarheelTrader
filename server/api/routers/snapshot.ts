/**
 * tRPC APIs that contains all of the functionality for creating,
 * reading, updating, and deleting data in our database relating to
 * portfolio hourly snapshots.
 *
 */

import { createTRPCRouter, protectedProcedure } from "../trpc";
import { db } from "@/server/db";
import {
  hourlyPortfolioSnapshot,
  position,
  transaction,
} from "@/server/db/schema";
import { eq, desc, and, lte } from "drizzle-orm";
import { alpaca } from "@/utils/alpaca/clients";
import { randomUUID } from "crypto";

/* HELPER FUNCTIONS */
function floorToHour(date: Date): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    date.getHours(),
  );
}

function addHours(date: Date, hrs: number): Date {
  return new Date(date.getTime() + hrs * 3600 * 1000);
}

async function getPriceAtHour(symbol: string, ts: Date) {
  const now = new Date();
  const FIFTEEN_MIN = 15 * 60 * 1000;
  const ONE_MIN = 60 * 1000;

  // HARD BLOCK if ts is too recent
  // 15 MIN for SIP Alpaca rule; 1 MIN to ensure (end + 15min) > now;
  // 1 MIN more to ensure seconds don't cause issues
  if (ts.getTime() + FIFTEEN_MIN + ONE_MIN + ONE_MIN > now.getTime()) {
    return null;
  }

  const bars = alpaca.getBarsV2(
    symbol,
    {
      start: ts.toISOString(),
      end: new Date(ts.getTime() + ONE_MIN).toISOString(), // only 1-minute window
      timeframe: "1Min",
    },
    alpaca.configuration,
  );

  const collected = [];
  for await (const bar of bars) {
    collected.push(bar);
  }

  // choose X:00 AM/PM  bar not X:59 AM/PM or any others
  return collected[0]?.ClosePrice ?? null;
}

async function computeCashAtHour(userId: string, ts: Date) {
  const txns = await db.query.transaction.findMany({
    where: and(
      eq(transaction.userId, userId),
      lte(transaction.executedAt, ts), // <— FILTER BY HOUR
    ),
  });

  let cash = 0;

  for (const t of txns) {
    const price = parseFloat(t.price || "0");
    const qty = t.quantity ? parseFloat(t.quantity) : 0;

    switch (t.action) {
      case "deposit":
        cash += price;
        break;

      case "withdraw":
        cash -= price;
        break;

      case "buy":
        cash -= price * qty;
        break;

      case "sell":
        cash += price * qty;
        break;
    }
  }

  return cash;
}

async function computeNavAtHour(userId: string, ts: Date) {
  const cash = await computeCashAtHour(userId, ts);

  const positions = await db.query.position.findMany({
    where: eq(position.userId, userId),
  });

  let mv = 0;

  for (const p of positions) {
    const price = await getPriceAtHour(p.symbol, ts);
    const finalPrice = price ?? Number(p.avgCost); // fallback
    mv += Number(p.quantity) * finalPrice;
  }

  return cash + mv;
}

async function insertSnapshot(userId: string, ts: Date, nav: number) {
  await db
    .insert(hourlyPortfolioSnapshot)
    .values({
      id: randomUUID(),
      userId,
      eohValue: nav.toString(),
      timestamp: ts,
    })
    .onConflictDoUpdate({
      target: [
        hourlyPortfolioSnapshot.userId,
        hourlyPortfolioSnapshot.timestamp,
      ],
      set: { eohValue: nav.toString() },
    });
}

/* SNAPSHOT PROCEDURE */
// This function creates a snapshot for all past hours since the last snapshot was made
// This triggers as soon as the user logs in
const takeHourlySnapshots = protectedProcedure.mutation(async ({ ctx }) => {
  const { subject } = ctx;
  const now = new Date();
  const nowHour = floorToHour(now);

  // get last snapshot
  const [latest] = await db
    .select()
    .from(hourlyPortfolioSnapshot)
    .where(eq(hourlyPortfolioSnapshot.userId, subject.id))
    .orderBy(desc(hourlyPortfolioSnapshot.timestamp))
    .limit(1);

  // 1. No snapshots exist yet
  let cursor = latest ? floorToHour(latest.timestamp) : null;
  if (!cursor) {
    const nav = await computeNavAtHour(subject.id, nowHour); // create only current hour
    await insertSnapshot(subject.id, nowHour, nav);
    return { created: 1 };
  }

  const FIFTEEN_MIN = 15 * 60 * 1000;
  const ONE_MIN = 60 * 1000;

  // 2. Already up to date
  if (cursor.getTime() + FIFTEEN_MIN >= now.getTime()) {
    console.log(
      "FETCHING SNAPSHOT:",
      "cursor =",
      cursor.toISOString(),
      "| now =",
      now.toISOString(),
      "| cursor+15min =",
      new Date(cursor.getTime() + FIFTEEN_MIN).toISOString(),
    );
    return { created: 0 };
  }

  // 3. Snapshots missing so generate every missing hour
  let created = 0;
  while (true) {
    cursor = addHours(cursor, 1); // incrementer
    // loop break condition: if cursor=3:00PM and now=3:13PM, no snapshot made since cursor+15 > now
    // adds 15 min buffer to meet Alpaca rules + 2 mins for endtime and seconds accounting
    if (cursor.getTime() + FIFTEEN_MIN + ONE_MIN + ONE_MIN >= now.getTime()) {
      break;
    }
    console.log(
      "FETCHING SNAPSHOT:",
      "cursor =",
      cursor.toISOString(),
      "| now =",
      now.toISOString(),
      "| cursor+15min =",
      new Date(cursor.getTime() + FIFTEEN_MIN).toISOString(),
    );
    const nav = await computeNavAtHour(subject.id, cursor);
    await insertSnapshot(subject.id, cursor, nav);
    created++;
  }

  return { created };
});

/**
 * Router for all position-related APIs.
 */
export const snapshotApiRouter = createTRPCRouter({
  takeHourlySnapshots: takeHourlySnapshots,
});
