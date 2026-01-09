import { Router } from "express";
import { adminMiddleware, authMiddleware, candidateMiddleware, supervisorMiddleware } from "../lib/middlewares";
import { conversationSchema, agentSchema } from "../types";
import { ConversationModel, MessageModel, UserModel } from "../db/models";
import { inMemoryMessages, type Message } from "../lib/messageStore";

export const router = Router();

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

  const supervisor = await UserModel.findById(data.supervisorId);
  if (!supervisor) {
    return res.status(404).json({
      "success": false,
      "error": "Supervisor not found"
    })
  };

  if (supervisor.role !== "supervisor") {
    return res.status(400).json({
      "success": false,
      "error": "supervisorId must point to a user with supervisor role"
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
    return res.status(400).json({
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
  if (!agent) {
    return res.status(404).json({
      "success": false,
      "error": "Agent not found"
    });
  };

  if (agent.role !== "agent") {
    return res.status(400).json({
      "success": false,
      "error": "User is not an agent"
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

  let messages: Message[] = [];

  if (conversation.status === "closed") {
    messages = await MessageModel.find({
      conversationId: conversation._id
    });
  } else if (conversation.status === "assigned") {
    messages = inMemoryMessages.get(conversation._id.toString()) || [];
  } else if (conversation.status === "open") {
    messages = [];
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
  if (req.role !== "admin" && req.role !== "supervisor") {
    return res.status(403).json({
      "success": false,
      "error": "Forbidden, insufficient permissions"
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
    return res.status(400).json({
      "success": false,
      "error": "Conversation already closed"
    });
  };

  if (conversation.status === "assigned") {
    return res.status(400).json({
      "success": false,
      "error": "Conversation is ongoing"
    });
  };

  if (req.role === "supervisor" && conversation.supervisorId.toString() !== req.userId) {
    return res.status(403).json({
      "success": false,
      "error": "You can only close conversations assigned to you"
    });
  };

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

router.get("/admin/analytics", authMiddleware, adminMiddleware, async (req, res) => {
  let analyticsData = [];

  const supervisors = await UserModel.find({
    role: "supervisor"
  });

  for (const supervisor of supervisors) {
    const agents = await UserModel.find({
      role: "agent",
      supervisorId: supervisor._id
    }).select("_id");
    const agentsId = agents.map(agent => agent._id);
    const closedConversations = await ConversationModel.countDocuments({
      status: "closed",
      agentId: { $in: agentsId }
    });

    analyticsData.push({
      "supervisorId": supervisor._id,
      "supervisorName": supervisor.name,
      "agents": agents.length,
      "conversationsHandled": closedConversations
    })
  };

  return res.status(200).json({
    "success": true,
    "data": analyticsData
  });
});
