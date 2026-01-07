import z from "zod";

export const registerSchema = z.object({
  name: z.string().min(4),
  email: z.email(),
  password: z.string().min(4),
  role: z.enum(["admin", "supervisor", "agent", "candidate"]),
  supervisorId: z.string().optional()
})

export const loginSchema = z.object({
  email: z.string(),
  password: z.string().min(4)
});

export const conversationSchema = z.object({
  supervisorId: z.string()
})

export const agentSchema = z.object({
  agentId: z.string()
})
