import express from "express";
// The 'protectRoute' middleware is imported but not used on these routes, as they are public.
import { protectRoute } from "../middleware/authMiddleware.js";
import { generateBio } from "../controllers/aiController.js"; // Controller for the AI bio generation logic.

const router = express.Router();

/**
 * Defines a POST route at '/generate-bio' for creating a user bio with AI.
 *
 * This route is intentionally public (i.e., it does not use the 'protectRoute' middleware).
 * This allows new, unauthenticated users to access the AI bio generation feature
 * directly from the sign-up page.
 */
router.post("/generate-bio", generateBio);

export default router;
