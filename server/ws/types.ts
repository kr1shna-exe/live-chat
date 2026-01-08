import { WebSocket } from "ws";

export interface ExtendWebSocket extends WebSocket {
  user?: {
    userId: string,
    role: string
  };
  rooms?: Set<string>;
}
