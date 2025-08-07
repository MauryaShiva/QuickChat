import express from "express";
import { protectRoute } from "../middleware/authMiddleware.js";
import {
  createConversation,
  getConversations,
  updateGroupInfo,
  addParticipant,
  removeParticipant,
  deleteGroupConversation,
  leaveGroup,
} from "../controllers/conversationController.js";

const router = express.Router();

/**
 * Defines the API routes for managing conversations.
 * All routes in this file are protected and require user authentication.
 */

// Route to fetch all conversations for the authenticated user.
router.get("/", protectRoute, getConversations);

// Route to create a new one-on-one or group conversation.
router.post("/create", protectRoute, createConversation);

// --- Routes for Group Management ---

// Route to update a group's information (name, bio, icon).
router.put("/group/:conversationId", protectRoute, updateGroupInfo);

// Route to add one or more participants to a group.
router.put("/group/:conversationId/add", protectRoute, addParticipant);

// Route to remove a participant from a group.
router.put("/group/:conversationId/remove", protectRoute, removeParticipant);

// Route to permanently delete a group conversation.
router.delete("/group/:conversationId", protectRoute, deleteGroupConversation);

// Route to allow the authenticated user to leave a group.
router.put("/group/:conversationId/leave", protectRoute, leaveGroup);

export default router;
