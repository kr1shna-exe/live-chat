import type { NextFunction, Request, Response } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  // const token = req.headers.authorization?.replace("Bearer ", "");
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(" ")[1];
  if (!token) {
    return res.status(401).json({
      "success": false,
      "error": "Token missing"
    })
  };
  try {
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET || "123") as JwtPayload;
    req.userId = decodedToken.userId;
    req.role = decodedToken.role;
    next();
  } catch (err) {
    return res.status(401).json({
      "success": false,
      "error": "Token invalid"
    })
  }
};

export const candidateMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.role || req.role !== "candidate") {
    return res.status(403).json({
      "success": false,
      "error": "Forbidden, insufficient permissions"
    })
  };
  next();
}

export const supervisorMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.role || req.role !== "supervisor") {
    return res.status(403).json({
      "success": false,
      "error": "Forbidden, insufficient permissions"
    });
  };
  next();
}

export const adminMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.role || req.role !== "admin") {
    return res.status(403).json({
      "success": false,
      "error": "Forbidden, insufficient permissions"
    });
  };
  next();
}
