import prisma from "../config/database.js";
import crypto from "crypto";

// In-memory room state for real-time sync
export const roomStates = new Map();

export const createRoom = async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: "Password is required" });
    }

    // Generate unique room ID
    const roomId = crypto.randomBytes(6).toString("hex");

    // Create room in database
    const room = await prisma.room.create({
      data: {
        roomId,
        password,
        hostId: req.userId,
      },
      include: {
        host: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    // Initialize room state
    roomStates.set(roomId, {
      hostId: req.userId,
      isPlaying: false,
      currentTime: 0,
      videoUrl: null,
      participants: [],
    });

    res.status(201).json(room);
  } catch (error) {
    console.error("Create room error:", error);
    res.status(500).json({ error: "Failed to create room" });
  }
};

export const joinRoom = async (req, res) => {
  try {
    const { roomId, password } = req.body;

    if (!roomId || !password) {
      return res.status(400).json({ error: "Room ID and password are required" });
    }

    // Find room
    const room = await prisma.room.findUnique({
      where: { roomId },
      include: {
        host: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }

    if (!room.isActive) {
      return res.status(400).json({ error: "Room is closed" });
    }

    if (room.password !== password) {
      return res.status(401).json({ error: "Invalid password" });
    }

    // Create participation record
    await prisma.roomParticipation.create({
      data: {
        roomId: room.id,
        userId: req.userId,
      },
    });

    res.json(room);
  } catch (error) {
    console.error("Join room error:", error);
    res.status(500).json({ error: "Failed to join room" });
  }
};

export const getRoomDetails = async (req, res) => {
  try {
    const { roomId } = req.params;

    const room = await prisma.room.findUnique({
      where: { roomId },
      include: {
        host: {
          select: {
            id: true,
            username: true,
          },
        },
        participants: {
          where: {
            leftAt: null,
          },
          include: {
            user: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        },
      },
    });

    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }

    res.json(room);
  } catch (error) {
    console.error("Get room details error:", error);
    res.status(500).json({ error: "Failed to fetch room details" });
  }
};

export const closeRoom = async (req, res) => {
  try {
    const { roomId } = req.params;

    const room = await prisma.room.findUnique({
      where: { roomId },
    });

    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }

    if (room.hostId !== req.userId) {
      return res.status(403).json({ error: "Only the host can close the room" });
    }

    await prisma.room.update({
      where: { roomId },
      data: {
        isActive: false,
        closedAt: new Date(),
      },
    });

    // Remove room state
    roomStates.delete(roomId);

    res.json({ message: "Room closed successfully" });
  } catch (error) {
    console.error("Close room error:", error);
    res.status(500).json({ error: "Failed to close room" });
  }
};

export const getUserRooms = async (req, res) => {
  try {
    const userId = req.userId;

    const rooms = await prisma.room.findMany({
      where: {
        OR: [
          { hostId: userId },
          {
            participants: {
              some: { userId: userId, leftAt: null },
            },
          },
        ],
        isActive: true,
      },
      include: {
        host: {
          select: {
            username: true,
          },
        },
        participants: {
          where: { leftAt: null },
          select: {
            user: {
              select: { username: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(rooms);
  } catch (error) {
    console.error("Get user rooms error:", error);
    res.status(500).json({ error: "Failed to fetch user rooms" });
  }
};
