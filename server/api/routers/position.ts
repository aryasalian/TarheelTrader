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

/**
 * Router for all position-related APIs.
 */
export const positionApiRouter = createTRPCRouter({
  getPositions: getPositions,
});
