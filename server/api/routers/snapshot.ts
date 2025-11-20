/**
 * tRPC APIs that contains all of the functionality for creating,
 * reading, updating, and deleting data in our database relating to
 * portfolio hourly snapshots.
 *
 */

import { createTRPCRouter, protectedProcedure } from "../trpc";
import { db } from "@/server/db";
import { hourlyPortfolioSnapshot, position } from "@/server/db/schema";
import { eq, desc } from "drizzle-orm";
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
  const bars = alpaca.getBarsV2(
    symbol,
    {
      start: ts.toISOString(),
      end: addHours(ts, 1).toISOString(),
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

async function insertSnapshot(userId: string, ts: Date, nav: number) {
  await db.insert(hourlyPortfolioSnapshot).values({
    id: randomUUID(),
    userId,
    eohValue: nav.toString(),
    timestamp: ts,
  });
}

async function computeNavAtHour(userId: string, ts: Date) {
  const positions = await db.query.position.findMany({
    where: eq(position.userId, userId),
  });

  if (positions.length === 0) return 0;
  let nav = 0;

  for (const p of positions) {
    const price = await getPriceAtHour(p.symbol, ts);
    const finalPrice = price ?? Number(p.avgCost); // fallback
    nav += Number(p.quantity) * finalPrice;
  }

  return nav;
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

  // 2. Already up to date
  if (cursor.getTime() >= nowHour.getTime()) {
    return { created: 0 };
  }

  // 3. Snapshots missing so generate every missing hour
  let created = 0;
  while (true) {
    cursor = addHours(cursor, 1); // incrementer
    // loop break condition
    if (cursor.getTime() > nowHour.getTime()) {
      break;
    }
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
