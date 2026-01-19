import { getTrending, searchMovies, getMovieDetails } from "../config/tmdb.js";
import prisma from "../config/database.js";

export const getTrendingMovies = async (req, res) => {
  try {
    const data = await getTrending();
    res.json(data);
  } catch (error) {
    console.error("Get trending error:", error);
    res.status(500).json({ error: "Failed to fetch trending movies" });
  }
};

export const searchMoviesController = async (req, res) => {
  try {
    const { query } = req.query;

    if (!query) {
      return res.status(400).json({ error: "Query parameter is required" });
    }

    const data = await searchMovies(query);
    res.json(data);
  } catch (error) {
    console.error("Search movies error:", error);
    res.status(500).json({ error: "Failed to search movies" });
  }
};

export const getMovieDetailsController = async (req, res) => {
  try {
    const { id } = req.params;
    const data = await getMovieDetails(id);

    // Find trailer
    const trailer = data.videos?.results?.find((video) => video.type === "Trailer" && video.site === "YouTube");

    // Save or update movie in database
    await prisma.movie.upsert({
      where: { tmdbId: parseInt(id) },
      update: {
        title: data.title,
        overview: data.overview,
        posterPath: data.poster_path,
        rating: data.vote_average,
        trailerKey: trailer?.key,
      },
      create: {
        tmdbId: parseInt(id),
        title: data.title,
        overview: data.overview,
        posterPath: data.poster_path,
        rating: data.vote_average,
        trailerKey: trailer?.key,
      },
    });

    res.json({
      ...data,
      trailerKey: trailer?.key,
    });
  } catch (error) {
    console.error("Get movie details error:", error);
    res.status(500).json({ error: "Failed to fetch movie details" });
  }
};
