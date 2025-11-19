/**
 * This file contains all of the Zod validation models
 * used to ensure that our tRPC API functions accept
 * input data in the correct format.
 */

import { z } from "zod";

export const ProfileIdentity = z.object({ profileId: z.string() });

export const NewUser = z.object({
  username: z.string(),
});

export const DraftProfileImage = z.object({ avatarUrl: z.string().nullish() });

export const NewTransaction = z.object({
  symbol: z.string(),
  quantity: z.number(),
  action: z.enum(["buy", "sell"]),
});

export const NewWatchlistItem = z.object({
  symbol: z.string(),
});

export const WatchlistItemId = z.object({
  id: z.string(),
});
