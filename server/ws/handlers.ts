import type { ExtendWebSocket } from "./types";
import { ConversationModel } from "../db/models";
import { broadcastToRoom, joinRoom } from "./rooms";
import { addMessage, inMemoryMessages } from "../lib/messageStore";

export async function handleJoinConversation(ws: ExtendWebSocket, conversationId: string) {
  if (ws.user?.role !== "candidate" && ws.user?.role !== "agent") {
    ws.send(JSON.stringify({ event: "ERROR", data: { message: "Forbidden for this role" } }))
    ws.close();
  }

  const conversation = await ConversationModel.findById(conversationId);
  if (!conversation) {
    ws.send(JSON.stringify({ event: "ERROR", data: { message: "Conversation not found" } }));
    return;
  }

  if (ws.user?.role === "candidate") {
    if (ws.user?.userId !== conversation.candidateId.toString()) {
      ws.send(JSON.stringify({ event: "ERROR", data: { message: "Not allowed to access this conversation" } }));
      return;
    }
  } else if (ws.user?.role === "agent") {
    if (conversation.agentId?.toString() !== ws.user?.userId) {
      ws.send(JSON.stringify({ event: "ERROR", data: { message: "Not allowed to access this conversation" } }));
      return;
    }

    if (conversation.status == "open") {
      conversation.status = "assigned";
      await conversation.save();
    }
  }

  const roomName = `conversation:${conversationId}`
  joinRoom(ws, roomName);

  if (!inMemoryMessages.has(conversationId)) {
    inMemoryMessages.set(conversationId, []);
  }

  ws.send(JSON.stringify({ event: "JOINED_CONVERSATION", data: { conversationId: conversationId, status: conversation.status } }));
}

export async function handleSendMessage(ws: ExtendWebSocket, data: any) {
  const { conversationId, content } = data;
  if (!conversationId) {
    ws.send(JSON.stringify({ event: "ERROR", data: { message: "Invalid request schema" } }));
    return;
  }

  if (ws.user?.role !== "candidate" && ws.user?.role !== "agent") {
    ws.send(JSON.stringify({ event: "ERROR", data: { message: "Forbidden for this role" } }))
    return;
  }

  const roomName = `conversation:${conversationId}`;
  if (ws.rooms?.has(roomName)) {
    ws.send(JSON.stringify({ event: "ERROR", data: { message: "You must join the conversation first" } }));
    return;
  }

  const message = {
    senderId: ws.user.userId,
    senderRole: ws.user.role,
    content: content,
    createdAt: new Date().toISOString()
  }
  addMessage(conversationId, content);
  broadcastToRoom(roomName, {
    event: "NEW_MESSAGE",
    data: message
  }, ws);

}


