import express from "express";
import { createRoom, joinRoom, getRoomDetails, closeRoom, getUserRooms } from "../controllers/roomController.js";
import { authMiddleware } from "../config/auth.js";

const router = express.Router();

router.get("/my-rooms", authMiddleware, getUserRooms);
router.post("/create", authMiddleware, createRoom);
router.post("/join", authMiddleware, joinRoom);
router.get("/:roomId", authMiddleware, getRoomDetails);
router.post("/:roomId/close", authMiddleware, closeRoom);

export default router;
