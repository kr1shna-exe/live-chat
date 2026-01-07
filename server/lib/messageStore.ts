// For storing messages for active conversation
export const inMemoryMessages = new Map<string, any[]>();

// For storing websocket rooms
export const rooms = new Map<string, Set<any>>();
