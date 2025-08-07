import express from "express";
import {
  signup,
  login,
  updateProfile,
  checkAuth,
  getUsers,
} from "../controllers/userController.js";
import { protectRoute } from "../middleware/authMiddleware.js";

const router = express.Router();

/**
 * Defines the API routes for user authentication and management.
 * It includes both public routes for sign-up/login and protected routes for user actions.
 */

// --- Public Routes ---

// Route for new user registration.
router.post("/signup", signup);

// Route for user login.
router.post("/login", login);

// --- Protected Routes ---
// The 'protectRoute' middleware will be applied to all subsequent routes in this file.

// Route to update the profile of the currently authenticated user.
router.put("/update-profile", protectRoute, updateProfile);

// Route to check the authentication status and get the current user's data.
router.get("/check", protectRoute, checkAuth);

// Route to get a list of all users (excluding the current user and the AI bot).
router.get("/users", protectRoute, getUsers);

export default router;
