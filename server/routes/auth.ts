import { Router } from "express";
import { loginSchema, registerSchema } from "../types";
import { UserModel } from "../db/models";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { authMiddleware } from "../lib/middlewares";

export const router = Router();

router.post("/signup", async (req, res) => {
  const { success, data } = registerSchema.safeParse(req.body);
  if (!success) {
    return res.status(400).json({
      "success": false,
      "error": "Invalid request schema"
    })
  }
  if (data.role === "agent") {
    if (!data.supervisorId) {
      return res.status(400).json({
        "success": false,
        "error": "SupervisorId is required"
      });
    }

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
        "error": "Supervisorid must point to user with a supervisor id"
      });
    };
  }

  const existingUser = await UserModel.findOne({
    email: data.email
  })
  if (existingUser) {
    return res.status(409).json({
      "success": false,
      "error": "Email already exists"
    })
  }
  const hashedPassword = await bcrypt.hash(data.password, 8);
  const newUser = await UserModel.create({
    name: data.name,
    email: data.email,
    password: hashedPassword,
    role: data.role,
    supervisorId: data.supervisorId
  });
  return res.status(201).json({
    "success": true,
    "data": {
      "_id": newUser._id,
      "name": newUser.name,
      "email": newUser.email,
      "role": newUser.role
    }
  });
});

router.post("/login", async (req, res) => {
  const { success, data } = loginSchema.safeParse(req.body);
  if (!success) {
    return res.status(400).json({
      "success": false,
      "error": "Invalid request schema"
    })
  };
  const existingUser = await UserModel.findOne({
    email: data.email
  })
  if (!existingUser) {
    return res.status(401).json({
      "success": false,
      "error": "User not found"
    })
  };
  const passwordCheck = await bcrypt.compare(data.password, existingUser.password);
  if (!passwordCheck) {
    return res.status(401).json({
      "success": false,
      "error": "Unauthorized"
    })
  };
  const token = jwt.sign({
    userId: existingUser._id,
    role: existingUser.role
  }, process.env.JWT_SECRET || "123", { expiresIn: "30d" });
  return res.status(200).json({
    "success": true,
    "data": {
      "token": token
    }
  })
});

router.get("/me", authMiddleware, async (req, res) => {
  const user = await UserModel.findById(req.userId);
  if (!user) {
    return res.status(404).json({
      "success": false,
      "error": "User not found"
    });
  };
  return res.status(200).json({
    "success": true,
    "data": {
      "_id": user._id,
      "name": user.name,
      "email": user.email,
      "role": user.role
    }
  })
})
