/**
 * tRPC APIs that contains all of the functionality for creating,
 * reading, updating, and deleting data in our database relating to
 * profiles.
 *
 */

import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";
import { Profile } from "@/server/models/responses";
import {
  DraftProfileImage,
  NewUser,
  ProfileIdentity,
} from "@/server/models/inputs";
import { db } from "@/server/db";
import { profiles } from "@/server/db/schema";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";

/**
 * Loads data for a specific profile given its ID.
 */
const getProfile = publicProcedure
  .input(ProfileIdentity)
  .output(Profile)
  .query(async ({ input }) => {
    const { profileId } = input;
    const data = await db.query.profiles.findFirst({
      where: eq(profiles.id, profileId),
    });
    if (!data) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "The server cannot find the requested resource.",
      });
    }
    return Profile.parse(data);
  });

/**
 * Loads data for the currently authenticated user (passed in as the `subject`).
 */
const getAuthedUserProfile = protectedProcedure
  .output(Profile)
  .query(async ({ ctx }) => {
    const { subject } = ctx;
    const data = await db.query.profiles.findFirst({
      where: eq(profiles.id, subject.id),
    });
    if (!data) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "The server cannot find the requested resource.",
      });
    }
    return Profile.parse(data);
  });

/**
 * TODO: Create a new user based on the name and handle provided.
 *
 * This endpoint is used whenever a new user authenticates with Supabase Auth
 * so that we can have a profile entry in our database for that user.
 */
const handleNewUser = protectedProcedure
  .input(NewUser)
  .mutation(async ({ ctx, input }) => {
    const { subject } = ctx;
    const { username } = input;
    await db
      .insert(profiles)
      .values({ id: subject.id, username: username, createdAt: new Date() });
  });

/**
 * Updates a user's avatar in Supabase storage.
 *
 * This function updates the avatar URL for the currently signed in
 * user to match the attachment URL provided.
 */
const updateProfilePicture = protectedProcedure
  .input(DraftProfileImage)
  .mutation(async ({ ctx, input }) => {
    const { subject } = ctx;
    const { avatarUrl } = input;
    await db
      .update(profiles)
      .set({ avatarUrl: avatarUrl })
      .where(eq(profiles.id, subject.id));
  });

/**
 * Router for all profile-related APIs.
 */
export const profilesApiRouter = createTRPCRouter({
  getProfile: getProfile,
  getAuthedUserProfile: getAuthedUserProfile,
  handleNewUser: handleNewUser,
  updateProfilePicture: updateProfilePicture,
});
