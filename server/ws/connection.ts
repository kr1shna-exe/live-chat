import { WebSocketServer } from "ws";
import jwt, { type JwtPayload } from "jsonwebtoken";
import type { ExtendWebSocket } from "./types";
import { IncomingMessage } from "http";

export const wss = new WebSocketServer({ port: 8000 });

wss.on('connection', (ws: ExtendWebSocket, req: IncomingMessage) => {
  const url = new URL(req.url || '', "http://localhost");
  const token = url.searchParams.get("token");

  if (!token) {
    ws.send(JSON.stringify({ event: "ERROR", data: { message: "Unauthorized or invalid token" } }));
    ws.close();
    return;
  }
  try {
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET || "123") as JwtPayload;
    ws.user = {
      userId: decodedToken.userId,
      role: decodedToken.role
    }
    ws.rooms = new Set();
  } catch (error) {
    ws.send(JSON.stringify({ event: "ERROR", data: { message: "Unauthorized or invalid token" } }));
    ws.close();
  }
});
