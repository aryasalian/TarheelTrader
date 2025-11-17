/**
 * This file contains all of the Zod validation models
 * used to ensure that our tRPC API functions accept
 * input data in the correct format.
 */

import { z } from "zod";

/** Defines the schema for a profile identity. */
export const ProfileIdentity = z.object({ profileId: z.string() });

/** Defines the schema for a new user. */
export const NewUser = z.object({
  username: z.string(),
});

/** Defines the schema for a new draft profile image. */
export const DraftProfileImage = z.object({ avatarUrl: z.string().nullish() });
