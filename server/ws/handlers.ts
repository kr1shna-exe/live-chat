import type { ExtendWebSocket } from "./types";
import { ConversationModel, MessageModel } from "../db/models";
import { broadcastToRoom, joinRoom, leaveRoom, rooms } from "./rooms";
import { addMessage, clearMessages, inMemoryMessages } from "../lib/messageStore";

export async function handleJoinConversation(ws: ExtendWebSocket, data: any) {
  try {
    const { conversationId } = data;
    if (!conversationId) {
      ws.send(JSON.stringify({ event: "ERROR", data: { message: "Invalid request schema" } }));
      return;
    }
    if (ws.user?.role !== "candidate" && ws.user?.role !== "agent") {
      ws.send(JSON.stringify({ event: "ERROR", data: { message: "Forbidden for this role" } }))
      return;
    }

    const conversation = await ConversationModel.findById(conversationId);
    if (!conversation) {
      ws.send(JSON.stringify({ event: "ERROR", data: { message: "Conversation not found" } }));
      return;
    }

    if (conversation.status === "closed") {
      ws.send(JSON.stringify({ event: "ERROR", data: { message: "Conversation already closed" } }));
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

      if (conversation.status === "open") {
        conversation.status = "assigned";
        await conversation.save();
      }
    }

    const roomName = `conversation:${conversationId}`
    joinRoom(ws, roomName);
    ws.send(JSON.stringify({ event: "JOINED_CONVERSATION", data: { conversationId: conversationId, status: conversation.status } }));
    const messages = inMemoryMessages.get(conversationId) || [];
    messages.forEach(message => {
      ws.send(JSON.stringify({ event: "NEW_MESSAGE", data: message }));
    });
    return;
  } catch (error) {
    ws.send(JSON.stringify({ event: "ERROR", data: { message: "Internal Server Error" } }));
  }
}

export async function handleSendMessage(ws: ExtendWebSocket, data: any) {
  try {
    const { conversationId, content } = data;
    if (!conversationId) {
      ws.send(JSON.stringify({ event: "ERROR", data: { message: "Invalid request schema" } }));
      return;
    }

    if (!content) {
      ws.send(JSON.stringify({ event: "ERROR", data: { message: "Invalid request shcema" } }));
      return;
    }

    if (ws.user?.role !== "candidate" && ws.user?.role !== "agent") {
      ws.send(JSON.stringify({ event: "ERROR", data: { message: "Forbidden for this role" } }))
      return;
    }

    const roomName = `conversation:${conversationId}`;
    if (!ws.rooms?.has(roomName)) {
      ws.send(JSON.stringify({ event: "ERROR", data: { message: "You must join the conversation first" } }));
      return;
    }

    const message = {
      conversationId: conversationId,
      senderId: ws.user.userId,
      senderRole: ws.user.role,
      content: content,
      createdAt: new Date().toISOString()
    }
    addMessage(message);
    broadcastToRoom(roomName, {
      event: "NEW_MESSAGE",
      data: message
    }, ws);

    return ws.send(JSON.stringify({
      event: "NEW_MESSAGE",
      data: message
    }));
  } catch (error) {
    ws.send(JSON.stringify({ event: "ERROR", data: { message: "Internal Server Error" } }));
  }
}

export async function handleLeaveConversation(ws: ExtendWebSocket, data: any) {
  try {
    const { conversationId } = data;
    if (!conversationId) {
      ws.send(JSON.stringify({ event: "ERROR", data: { message: "Invalid request schema" } }));
      return;
    }

    if (ws.user?.role !== "candidate" && ws.user?.role !== "agent") {
      ws.send(JSON.stringify({ event: "ERROR", data: { message: "Forbidden for this role" } }));
      return;
    }

    const roomName = `conversation:${conversationId}`;
    if (!ws.rooms?.has(roomName)) {
      ws.send(JSON.stringify({ event: "ERROR", data: { message: "You are not in this conversation" } }));
      return;
    }
    leaveRoom(ws, roomName);
    return ws.send(JSON.stringify({ event: "LEFT_CONVERSATION", data: { conversationId: conversationId } }));
  } catch (error) {
    ws.send(JSON.stringify({ event: "ERROR", data: { message: "Internal Server Error" } }));
  }
}

export async function handleCloseConversation(ws: ExtendWebSocket, data: any) {
  try {
    const { conversationId } = data;
    if (!conversationId) {
      ws.send(JSON.stringify({ event: "ERROR", data: { message: "Invalid request schema" } }));
      return;
    }

    const conversation = await ConversationModel.findById(conversationId);
    if (!conversation) {
      ws.send(JSON.stringify({ event: "ERROR", data: { message: "Conversation not found" } }));
      return;
    }
    const roomName = `conversation:${conversationId}`;

    if (ws.user?.role !== "agent") {
      ws.send(JSON.stringify({ event: "ERROR", data: { message: "Forbidden for this role" } }));
      return;
    }

    if (ws.user?.userId !== conversation.agentId?.toString()) {
      ws.send(JSON.stringify({ event: "ERROR", data: { message: "Not allowed to access this conversation" } }));
      return;
    }

    if (conversation.status === "open") {
      ws.send(JSON.stringify({ event: "ERROR", data: { message: "Conversation not yet assigned" } }));
      return;
    } else if (conversation.status === "closed") {
      ws.send(JSON.stringify({ event: "ERROR", data: { message: "Conversation already closed" } }));
      return;
    }

    const messages = inMemoryMessages.get(conversationId);
    if (messages && messages.length > 0) {
      await MessageModel.insertMany(messages);
    };

    conversation.status = "closed";
    await conversation.save();
    broadcastToRoom(roomName, {
      event: "CONVERSATION_CLOSED",
      data: {
        conversationId: conversationId
      }
    }, ws);
    ws.send(JSON.stringify({ event: "CONVERSATION_CLOSED", data: { conversationId: conversationId } }));
    const room = rooms.get(roomName);
    if (room) {
      room.forEach(socket => {
        socket.rooms?.delete(roomName);
      });
      rooms.delete(roomName);
    }
    clearMessages(conversationId);
  } catch (error) {
    ws.send(JSON.stringify({ event: "ERROR", data: { message: "Internal Server Error" } }));
  }
}
