import express from "express";
import { protectRoute } from "../middleware/authMiddleware.js";
import { getMessages, sendMessage } from "../controllers/messageController.js";

const messageRouter = express.Router();

/**
 * Defines the API routes for sending and receiving messages.
 * All routes in this file are protected and require user authentication.
 */

// Route to fetch all messages for a specific conversation.
// The ':conversationId' is a URL parameter that identifies the chat.
messageRouter.get("/:conversationId", protectRoute, getMessages);

// Route to send a new message to a specific conversation.
messageRouter.post("/send/:conversationId", protectRoute, sendMessage);

export default messageRouter;
