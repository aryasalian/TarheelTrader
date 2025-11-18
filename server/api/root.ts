/**
 * Configuration for the server-side tRPC API, including the primary API router.
 * Configuration of the server-side tRPC API.
 *
 * @author Ajay Gandecha <agandecha@unc.edu>
 * @license MIT
 * @see https://comp426-25f.github.io/
 */

import { createCallerFactory, createTRPCRouter } from "@/server/api/trpc";
import { profilesApiRouter } from "./routers/profiles";
import { positionApiRouter } from "./routers/position";
import { transactionApiRouter } from "./routers/transaction";
import { watchlistApiRouter } from "./routers/watchlist";
import { marketApiRouter } from "./routers/market";

// [NOTE]
// To expose a new API, add a new router here.

/** Primary router for the API server. */
export const appRouter = createTRPCRouter({
  profiles: profilesApiRouter,
  position: positionApiRouter,
  transaction: transactionApiRouter,
  watchlist: watchlistApiRouter,
  market: marketApiRouter,
});

export type AppRouter = typeof appRouter;
export const createCaller = createCallerFactory(appRouter);
