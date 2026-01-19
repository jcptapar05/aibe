import axios from "axios";

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = "https://api.themoviedb.org/3";

export const tmdbApi = axios.create({
  baseURL: TMDB_BASE_URL,
  params: {
    api_key: TMDB_API_KEY,
  },
});

export const getTrending = async () => {
  const response = await tmdbApi.get("/trending/movie/week");
  return response.data;
};

export const searchMovies = async (query) => {
  const response = await tmdbApi.get("/search/movie", {
    params: { query },
  });
  return response.data;
};

export const getMovieDetails = async (movieId) => {
  const response = await tmdbApi.get(`/movie/${movieId}`, {
    params: {
      append_to_response: "videos",
    },
  });
  return response.data;
};
