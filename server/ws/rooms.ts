import type { ExtendWebSocket } from "./types";

export const rooms = new Map<string, Set<ExtendWebSocket>>();

export function joinRoom(ws: ExtendWebSocket, roomName: string) {
  if (!ws.rooms) {
    ws.rooms = new Set();
  }
  ws.rooms.add(roomName);
  if (!rooms.has(roomName)) {
    rooms.set(roomName, new Set());
  }
  rooms.get(roomName)!.add(ws);
}

export function leaveRoom(ws: ExtendWebSocket, roomName: string) {
  ws.rooms?.delete(roomName);
  const room = rooms.get(roomName);
  if (room) {
    room.delete(ws);
    if (room.size === 0) {
      rooms.delete(roomName);
    }
  }
}

export function broadcastToRoom(roomName: string, message: any) {
  const room = rooms.get(roomName);
  if (!room) return;
  const messageStr = JSON.stringify(message);
  room.forEach(socket => {
    if (socket.readyState === 1) {
      socket.send(messageStr);
    }
  })
}
