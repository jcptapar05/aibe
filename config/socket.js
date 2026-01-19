import prisma from "../config/database.js";
import { roomStates } from "../controllers/roomController.js";
import { verifyToken } from "../config/auth.js";

export const setupSocketIO = (io) => {
  // Authentication middleware for Socket.IO
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error("Authentication error"));
    }

    const decoded = verifyToken(token);

    if (!decoded) {
      return next(new Error("Authentication error"));
    }

    socket.userId = decoded.userId;
    next();
  });

  io.on("connection", (socket) => {
    console.log("User connected:", socket.userId);

    // Join room
    socket.on("join-room", async ({ roomId, username }) => {
      try {
        socket.join(roomId);

        // Get room state
        const state = roomStates.get(roomId) || {
          isPlaying: false,
          currentTime: 0,
          videoUrl: null,
          participants: [],
        };

        // Update or add participant
        const existingParticipantIndex = state.participants.findIndex((p) => p.userId === socket.userId);
        if (existingParticipantIndex !== -1) {
          state.participants[existingParticipantIndex].socketId = socket.id;
          state.participants[existingParticipantIndex].username = username; // Update username too just in case
        } else {
          state.participants.push({
            userId: socket.userId,
            username,
            socketId: socket.id,
          });
        }
        roomStates.set(roomId, state);

        // Notify others
        socket.to(roomId).emit("user-joined", {
          userId: socket.userId,
          username,
        });

        // Send current state to new user
        socket.emit("room-state", state);

        console.log(`User ${username} joined room ${roomId}`);
      } catch (error) {
        console.error("Join room error:", error);
        socket.emit("error", { message: "Failed to join room" });
      }
    });

    // Leave room
    socket.on("leave-room", async ({ roomId, username }) => {
      try {
        socket.leave(roomId);

        const state = roomStates.get(roomId);
        if (state) {
          state.participants = state.participants.filter((p) => p.userId !== socket.userId);
          roomStates.set(roomId, state);
        }

        // Update participation record
        await prisma.roomParticipation.updateMany({
          where: {
            userId: socket.userId,
            leftAt: null,
          },
          data: {
            leftAt: new Date(),
          },
        });

        socket.to(roomId).emit("user-left", {
          userId: socket.userId,
          username,
        });

        console.log(`User ${username} left room ${roomId}`);
      } catch (error) {
        console.error("Leave room error:", error);
      }
    });

    // Playback control - play
    socket.on("play", ({ roomId, currentTime }) => {
      const state = roomStates.get(roomId);
      if (state && state.hostId === socket.userId) {
        state.isPlaying = true;
        state.currentTime = currentTime;
        roomStates.set(roomId, state);
        socket.to(roomId).emit("play", { currentTime });
      }
    });

    // Playback control - pause
    socket.on("pause", ({ roomId, currentTime }) => {
      const state = roomStates.get(roomId);
      if (state && state.hostId === socket.userId) {
        state.isPlaying = false;
        state.currentTime = currentTime;
        roomStates.set(roomId, state);
        socket.to(roomId).emit("pause", { currentTime });
      }
    });

    // Playback control - seek
    socket.on("seek", ({ roomId, currentTime }) => {
      const state = roomStates.get(roomId);
      if (state && state.hostId === socket.userId) {
        state.currentTime = currentTime;
        roomStates.set(roomId, state);
        socket.to(roomId).emit("seek", { currentTime });
      }
    });

    // Chat message
    socket.on("chat-message", async ({ roomId, message, username }) => {
      try {
        // Find room
        const room = await prisma.room.findUnique({
          where: { roomId },
        });

        if (room) {
          // Save message
          await prisma.message.create({
            data: {
              roomId: room.id,
              userId: socket.userId,
              content: message,
            },
          });

          // Broadcast to room
          io.to(roomId).emit("chat-message", {
            userId: socket.userId,
            username,
            message,
            timestamp: new Date(),
          });
        }
      } catch (error) {
        console.error("Chat message error:", error);
      }
    });

    // Reaction
    socket.on("reaction", async ({ roomId, emoji, username }) => {
      try {
        const room = await prisma.room.findUnique({
          where: { roomId },
        });

        if (room) {
          // Save reaction
          await prisma.reaction.create({
            data: {
              roomId: room.id,
              userId: socket.userId,
              emoji,
            },
          });

          // Broadcast to room
          io.to(roomId).emit("reaction", {
            userId: socket.userId,
            username,
            emoji,
            timestamp: new Date(),
          });
        }
      } catch (error) {
        console.error("Reaction error:", error);
      }
    });

    // Gift
    socket.on("gift", async ({ roomId, giftType, username }) => {
      try {
        const room = await prisma.room.findUnique({
          where: { roomId },
        });

        if (room) {
          // Save gift
          await prisma.gift.create({
            data: {
              roomId: room.id,
              userId: socket.userId,
              giftType,
            },
          });

          // Broadcast to room
          io.to(roomId).emit("gift", {
            userId: socket.userId,
            username,
            giftType,
            timestamp: new Date(),
          });
        }
      } catch (error) {
        console.error("Gift error:", error);
      }
    });

    // Close room
    socket.on("close-room", ({ roomId }) => {
      const state = roomStates.get(roomId);
      if (state && state.hostId === socket.userId) {
        io.to(roomId).emit("room-closed");
      }
    });

    // Watch start
    socket.on("watch-start", ({ roomId, movieId, videoUrl }) => {
      const state = roomStates.get(roomId);
      if (state && state.hostId === socket.userId) {
        state.videoUrl = videoUrl;
        state.movieId = movieId;
        roomStates.set(roomId, state);
        socket.to(roomId).emit("watch-start", { movieId, videoUrl });
      }
    });

    // Watch end
    socket.on("watch-end", ({ roomId }) => {
      socket.to(roomId).emit("watch-end");
    });

    // Disconnect
    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.userId);
    });
  });
};
