import prisma from "../config/database.js";

export const getUserAnalytics = async (req, res) => {
  try {
    const userId = req.userId;

    // Total watch time
    const watchSessions = await prisma.watchSession.findMany({
      where: { userId },
      include: {
        movie: true,
      },
    });

    const totalWatchTime = watchSessions.reduce((sum, session) => sum + session.duration, 0);
    const avgSessionDuration = watchSessions.length > 0 ? totalWatchTime / watchSessions.length : 0;

    // Watch mode breakdown
    const aloneCount = watchSessions.filter((s) => s.watchMode === "alone").length;
    const roomCount = watchSessions.filter((s) => s.watchMode === "room").length;

    // Watch history
    const watchHistory = watchSessions.map((session) => ({
      movieTitle: session.movie.title,
      date: session.startedAt,
      duration: session.duration,
      watchMode: session.watchMode,
    }));

    // Daily watch time (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentSessions = await prisma.watchSession.findMany({
      where: {
        userId,
        startedAt: {
          gte: sevenDaysAgo,
        },
      },
    });

    const dailyWatchTime = {};
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split("T")[0];
      dailyWatchTime[dateKey] = 0;
    }

    recentSessions.forEach((session) => {
      const dateKey = session.startedAt.toISOString().split("T")[0];
      if (dailyWatchTime[dateKey] !== undefined) {
        dailyWatchTime[dateKey] += session.duration;
      }
    });

    // Top watched movies
    const movieCounts = {};
    watchSessions.forEach((session) => {
      const title = session.movie.title;
      movieCounts[title] = (movieCounts[title] || 0) + 1;
    });

    const topMovies = Object.entries(movieCounts)
      .map(([title, count]) => ({ title, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    res.json({
      totalWatchTime,
      avgSessionDuration,
      watchModeBreakdown: {
        alone: aloneCount,
        room: roomCount,
      },
      watchHistory,
      dailyWatchTime,
      topMovies,
    });
  } catch (error) {
    console.error("Get user analytics error:", error);
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
};

export const getRoomAnalytics = async (req, res) => {
  try {
    const { roomId } = req.params;

    const room = await prisma.room.findUnique({
      where: { roomId },
      include: {
        participants: true,
        messages: true,
        reactions: true,
        gifts: true,
        watchSessions: true,
      },
    });

    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }

    const totalParticipants = room.participants.length;
    const totalMessages = room.messages.length;
    const totalReactions = room.reactions.length;
    const totalGifts = room.gifts.length;
    const totalWatchDuration = room.watchSessions.reduce((sum, session) => sum + session.duration, 0);

    // Gift breakdown
    const giftBreakdown = {};
    room.gifts.forEach((gift) => {
      giftBreakdown[gift.giftType] = (giftBreakdown[gift.giftType] || 0) + 1;
    });

    res.json({
      roomId: room.roomId,
      totalParticipants,
      totalMessages,
      totalReactions,
      totalGifts,
      totalWatchDuration,
      giftBreakdown,
      createdAt: room.createdAt,
      closedAt: room.closedAt,
    });
  } catch (error) {
    console.error("Get room analytics error:", error);
    res.status(500).json({ error: "Failed to fetch room analytics" });
  }
};

export const createWatchSession = async (req, res) => {
  try {
    const { movieId, roomId, watchMode } = req.body;

    if (!movieId || !watchMode) {
      return res.status(400).json({ error: "Movie ID and watch mode are required" });
    }

    // Find or create movie
    const movie = await prisma.movie.findUnique({
      where: { tmdbId: parseInt(movieId) },
    });

    if (!movie) {
      return res.status(404).json({ error: "Movie not found. Fetch movie details first." });
    }

    const session = await prisma.watchSession.create({
      data: {
        userId: req.userId,
        movieId: movie.id,
        roomId: roomId ? (await prisma.room.findUnique({ where: { roomId } }))?.id : null,
        watchMode,
        duration: 0,
      },
    });

    res.status(201).json(session);
  } catch (error) {
    console.error("Create watch session error:", error);
    res.status(500).json({ error: "Failed to create watch session" });
  }
};

export const endWatchSession = async (req, res) => {
  try {
    const { sessionId, duration } = req.body;

    if (!sessionId || duration === undefined) {
      return res.status(400).json({ error: "Session ID and duration are required" });
    }

    const session = await prisma.watchSession.update({
      where: { id: sessionId },
      data: {
        duration: parseInt(duration),
        endedAt: new Date(),
      },
    });

    res.json(session);
  } catch (error) {
    console.error("End watch session error:", error);
    res.status(500).json({ error: "Failed to end watch session" });
  }
};
