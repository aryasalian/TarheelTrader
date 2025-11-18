/**
 * This file contains all of the Zod validation models
 * used to ensure that our tRPC API functions ultimately
 * return data in the correct format.
 */

import { z } from "zod";

/** Defines the schema for profile and author data. */
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
    lastUpdated: z.string().nullable(),
  }),
);
