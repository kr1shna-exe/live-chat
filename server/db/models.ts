import mongoose from "mongoose";
import { required } from "zod/mini";

export async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URL || "mongodb://localhost:27017/live-chat");
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("Error connecting to MongoDB", error);
  }
}

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ["admin", "supervisor", "agent", "candidate"],
    required: true
  },
  supervisorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
    required: function (this: any) {
      return this.role === "agent";
    }
  }
});

const ConversationSchema = new mongoose.Schema({
  candidateId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
  agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  supervisorId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
  status: {
    type: String,
    enum: ["open", "assigned", "closed"],
    required: true
  },
  createdAt: { type: Date, default: Date.now }
})

const MessageSchema = new mongoose.Schema({
  conversationId: { type: mongoose.Schema.Types.ObjectId },
  senderId: { type: mongoose.Schema.Types.ObjectId },
  senderRole: String,
  content: String,
  createdAt: { type: Date, default: Date.now }
});


export const UserModel = mongoose.model("User", UserSchema);
export const ConversationModel = mongoose.model("Conversation", ConversationSchema);
export const MessageModel = mongoose.model("Message", MessageSchema);
