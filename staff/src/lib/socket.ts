import { io, type Socket } from "socket.io-client";
import { getAccessToken } from "@/lib/api";

const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL ??
  (process.env.NODE_ENV === "production"
    ? undefined
    : "http://localhost:4000");

export function connectStaffSocket(): Socket | null {
  if (!WS_URL || typeof window === "undefined") return null;
  const token = getAccessToken();
  return io(`${WS_URL}/staff`, {
    transports: ["websocket", "polling"],
    withCredentials: true,
    auth: token ? { token } : {},
  });
}
