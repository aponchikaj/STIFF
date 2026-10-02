/**
 * The API surface, in one import.
 *
 *     import { gameApi, warsApi, ApiError } from "@/lib/api";
 *
 * Namespaced rather than flattened because several modules legitimately
 * own a function of the same name — `shopApi.list`, `warsApi.list` and
 * `reportsApi.mine` all read better qualified than renamed.
 *
 * Coverage, against the backend controllers:
 *   game.controller.ts        → gameApi          (24 routes)
 *   clans.controller.ts       → clansApi         (5)
 *   shop.controller.ts        → shopApi          (3)
 *   opals.controller.ts       → opalsApi         (3)
 *   voting.controller.ts      → votingApi        (2)
 *   wars.controller.ts        → warsApi          (7 player routes)
 *   reports/reports...ts      → reportsApi       (4)
 *   auth.controller.ts        → authApi          (10)
 *   users.controller.ts       → profileApi       (the `me` half)
 *   notifications...ts        → notificationsApi (4)
 *
 * The `/game/admin/*` controllers are deliberately absent. They belong to
 * the game-admin panel on admin.stiff.co, they are `@Roles('admin')`, and an
 * admin-audience token is rejected by the shop guard this client speaks to —
 * so a call to one from here could only ever fail.
 */

export * from "./client";
export * from "./types";

export * as gameApi from "./game";
export * as clansApi from "./clans";
export * as shopApi from "./shop";
export * as opalsApi from "./opals";
export * as votingApi from "./voting";
export * as warsApi from "./wars";
export * as reportsApi from "./reports";
export * as authApi from "./auth";
export * as profileApi from "./profile";
export * as notificationsApi from "./notifications";
