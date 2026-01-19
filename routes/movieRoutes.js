import express from "express";
import {
  getTrendingMovies,
  searchMoviesController,
  getMovieDetailsController,
} from "../controllers/movieController.js";
import { authMiddleware } from "../config/auth.js";

const router = express.Router();

router.get("/trending", authMiddleware, getTrendingMovies);
router.get("/search", authMiddleware, searchMoviesController);
router.get("/:id", authMiddleware, getMovieDetailsController);

export default router;
