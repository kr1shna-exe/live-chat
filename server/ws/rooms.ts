import type { ExtendWebSocket } from "./types";

export const rooms = new Map<string, Set<ExtendWebSocket>>();

