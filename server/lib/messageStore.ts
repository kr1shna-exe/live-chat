interface Message {
  conversationId: string,
  senderId: string,
  senderRole: string,
  content: string,
  createdAt: Date
}

export const inMemoryMessages = new Map<string, Message[]>();

export function addMessage(conversationId: string, message: Message) {
  if (!inMemoryMessages.has(conversationId)) {
    inMemoryMessages.set(conversationId, []);
  }
  inMemoryMessages.get(conversationId)!.push(message);
}

export function getMessages(conversationId: string): Message[] {
  return inMemoryMessages.get(conversationId) || [];
}

export function clearMessages(conversationId: string) {
  return inMemoryMessages.delete(conversationId);
}
