import { Router } from "express";
import { adminMiddleware, authMiddleware, candidateMiddleware, supervisorMiddleware } from "../lib/middlewares";
import { conversationSchema, agentSchema } from "../types";
import { ConversationModel, MessageModel, UserModel } from "../db/models";
import { inMemoryMessages } from "../lib/messageStore";

const router = Router();

router.post("/conversations", authMiddleware, candidateMiddleware, async (req, res) => {
  const { success, data } = conversationSchema.safeParse(req.body);
  if (!success) {
    return res.status(400).json({
      "success": false,
      "error": "Invalid request schema"
    })
  };
  const existingConversation = await ConversationModel.findOne({
    candidateId: req.userId,
    status: { $in: ["open", "assigned"] }
  })
  if (existingConversation) {
    return res.status(409).json({
      "success": false,
      "error": "Candidate already has an active conversation"
    })
  };
  const newConversation = await ConversationModel.create({
    candidateId: req.userId,
    supervisorId: data.supervisorId,
    status: "open"
  });
  return res.status(200).json({
    "success": true,
    "data": {
      "id": newConversation._id,
      "status": newConversation.status,
      "supervisorId": newConversation.supervisorId
    }
  });
});

router.post("/conversations/:id/assign", authMiddleware, supervisorMiddleware, async (req, res) => {
  const { success, data } = agentSchema.safeParse(req.body);
  if (!success) {
    return res.status(400).json({
      "success": false,
      "error": "Invalid request schema"
    });
  };

  const conversation = await ConversationModel.findById(req.params.id);
  if (!conversation) {
    return res.status(404).json({
      "success": false,
      "error": "Conversation not found"
    });
  };

  if (conversation.status === "closed") {
    return res.status(403).json({
      "success": false,
      "error": "cannot assign agent"
    });
  };

  if (conversation.supervisorId.toString() !== req.userId) {
    return res.status(403).json({
      "success": false,
      "error": "Conversation does not belong to you"
    });
  };

  const agent = await UserModel.findById(data.agentId);
  if (!agent || agent.role !== "agent") {
    return res.status(404).json({
      "success": false,
      "error": "Agent not found"
    });
  };

  if (agent.supervisorId?.toString() !== req.userId) {
    return res.status(403).json({
      "success": false,
      "error": "Agent doesn't belong to you"
    });
  };

  conversation.agentId = JSON.parse(data.agentId);
  conversation.status = "open";
  await conversation.save();

  return res.status(200).json({
    "success": true,
    "data": {
      "conversationId": conversation._id,
      "agentId": conversation.agentId,
      "supervisorId": conversation.supervisorId
    }
  })
});

router.get("/conversations/:id", authMiddleware, async (req, res) => {
  const conversation = await ConversationModel.findById(req.params.id);

  if (!conversation) {
    return res.status(404).json({
      "success": false,
      "error": "Conversation not found"
    });
  };

  if (req.role !== "admin") {
    const hasAccess =
      (req.role === "candidate" && conversation.candidateId.toString() === req.userId) ||
      (req.role === "supervisor" && conversation.supervisorId.toString() === req.userId) ||
      (req.role === "agent" && conversation.agentId?.toString() === req.userId);

    if (!hasAccess) {
      return res.status(403).json({
        "success": false,
        "error": "Forbidden, insufficient permissions"
      });
    };
  };

  let messages = [];

  if (conversation.status === "closed") {
    messages = await MessageModel.find({
      conversationId: conversation._id
    });
  } else if (conversation.status === "assigned") {
    messages = inMemoryMessages.get(conversation._id.toString()) || [];
  }
  return res.status(200).json({
    "success": true,
    "data": {
      "_id": conversation._id,
      "status": conversation.status,
      "agentId": conversation.agentId,
      "supervisorId": conversation.supervisorId,
      "candidateId": conversation.candidateId,
      "messages": messages
    }
  });
});

router.post("/conversations/:id/close", authMiddleware, async (req, res) => {
  const conversation = await ConversationModel.findById(req.params.id);
  if (conversation?.status !== "open") {
    return res.status(400).json({
      "success": false,
      "error": "Conversation is still going on"
    });
  };
  if ()
    conversation.status = "closed";
  await conversation.save();
  return res.status(200).json({
    "success": true,
    "data": {
      "conversation_id": conversation._id,
      "status": conversation.status
    }
  });
});
