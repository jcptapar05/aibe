import express from "express";
import {
  getUserAnalytics,
  getRoomAnalytics,
  createWatchSession,
  endWatchSession,
} from "../controllers/analyticsController.js";
import { authMiddleware } from "../config/auth.js";

const router = express.Router();

router.get("/user", authMiddleware, getUserAnalytics);
router.get("/room/:roomId", authMiddleware, getRoomAnalytics);
router.post("/session/start", authMiddleware, createWatchSession);
router.post("/session/end", authMiddleware, endWatchSession);

export default router;
