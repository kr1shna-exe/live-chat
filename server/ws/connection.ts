import { WebSocketServer } from "ws";
import jwt, { type JwtPayload } from "jsonwebtoken";
import type { ExtendWebSocket } from "./types";
import { IncomingMessage } from "http";
import { handleJoinConversation, handleSendMessage } from "./handlers";
import { rooms } from "./rooms";

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

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        if (!message.event) {
          ws.send(JSON.stringify({ event: "ERROR", data: { message: "Invalid message format" } }));
          return;
        }

        switch (message.event) {
          case "JOIN_CONVERSATION":
            await handleJoinConversation(ws, message.data);
            break;

          case "NEW_MESSAGE":
            await handleSendMessage(ws, message.data);
            break;

          default:
            ws.send(JSON.stringify({ event: "ERROR", data: { message: "Unknown event" } }));
        }
      } catch (error) {
        ws.send(JSON.stringify({ event: "ERROR", data: { message: "Invalid message format" } }));
      }
    });

    ws.on('close', () => {
      ws.rooms?.forEach(roomName => {
        rooms.get(roomName)?.delete(ws);
      })
    })

  } catch (error) {
    ws.send(JSON.stringify({ event: "ERROR", data: { message: "Unauthorized or invalid token" } }));
    ws.close();
  }
});
