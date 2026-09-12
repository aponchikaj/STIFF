export * from "./client";
export * from "./game-types";

export * as authApi from "./auth";
export * as gameApi from "./game";

/** The signed-in admin. The shop panel's `SafeUser`, from the same endpoint. */
export interface SafeUser {
  id: string;
  username: string;
  email: string;
  role: "user" | "admin";
  isVerified: boolean;
  createdAt: string;
}
