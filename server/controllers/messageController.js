import Message from "../models/Message.js";
import User from "../models/User.js";
import Conversation from "../models/Conversation.js";
import cloudinary from "../lib/cloudinary.js";
import { io, userSocketMap } from "../server.js"; // Corrected import for userSocketMap
import groq from "../lib/groq.js";
import mongoose from "mongoose";

/**
 * Fetches all messages for a specific conversation and marks them as seen by the current user.
 * @param {object} request - The Express request object.
 * @param {object} response - The Express response object.
 */
export const getMessages = async (request, response) => {
  try {
    const { conversationId } = request.params;
    const userId = request.user._id;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return response
        .status(404)
        .json({ success: false, message: "Conversation not found" });
    }

    // Ensure the user is a participant in the conversation before fetching messages.
    if (!conversation.participants.includes(userId)) {
      return response.status(403).json({
        success: false,
        message: "User not authorized for this conversation",
      });
    }

    const messages = await Message.find({ conversationId })
      .populate("senderId", "-password")
      .sort({ createdAt: 1 });

    // Mark all incoming messages in this conversation as seen by the current user.
    await Message.updateMany(
      {
        conversationId: conversationId,
        senderId: { $ne: userId }, // Messages not sent by the current user.
        seenBy: { $ne: userId }, // Messages not already seen by the current user.
      },
      { $addToSet: { seenBy: userId } } // Add the user's ID to the 'seenBy' array.
    );

    response.json({ success: true, messages });
  } catch (error) {
    console.error("Error in getMessages: ", error.message);
    response
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

/**
 * Sends a new message to a conversation. Handles both human-to-human messages
 * and interactions with the Groq AI bot, including streaming responses.
 * @param {object} request - The Express request object.
 * @param {object} response - The Express response object.
 */
export const sendMessage = async (request, response) => {
  try {
    const { text, image, tempId } = request.body;
    const { conversationId } = request.params;
    const senderId = request.user._id;

    const conversation = await Conversation.findById(conversationId).populate(
      "participants"
    );
    if (!conversation) {
      return response
        .status(404)
        .json({ success: false, message: "Conversation not found" });
    }

    // Check if the conversation is with the Groq AI bot.
    const groqBotUser = conversation.participants.find(
      (participant) => participant.email === "groq@bot.com"
    );

    // --- AI Bot Logic ---
    if (groqBotUser && conversation.isGroupChat === false) {
      // First, save and emit the user's message immediately for a responsive UI.
      const userMessage = await Message.create({
        senderId,
        conversationId,
        text,
        image: image || null, // ✅ CHANGE: User's message now saves the image as well.
        seenBy: [senderId],
      });
      const populatedUserMessage = await Message.findById(
        userMessage._id
      ).populate("senderId", "-password");

      // Attach the temporary ID from the client to the payload for optimistic UI updates.
      const userMessagePayload = populatedUserMessage.toObject();
      userMessagePayload.tempId = tempId;
      io.to(conversationId).emit("newMessage", userMessagePayload);

      // Send an immediate response to the client to confirm receipt.
      response
        .status(200)
        .json({ success: true, message: "Bot processing started." });

      // Check if the user has sent an image but no accompanying text.
      // This is a special case to handle gracefully since the AI cannot process images.
      if (image && !text) {
        const botResponseText =
          "I see that you've sent an image. While my current capabilities don't include image analysis, if you can describe it for me or ask your question in text, I'll do my best to assist you.";
        const groqMessage = await Message.create({
          senderId: groqBotUser._id,
          conversationId,
          text: botResponseText,
          seenBy: [groqBotUser._id],
        });
        const populatedGroqMessage = await Message.findById(
          groqMessage._id
        ).populate("senderId", "-password");
        io.to(conversationId).emit("newMessage", populatedGroqMessage);

        conversation.lastMessage = {
          text: "Groq AI has responded.",
          sender: groqBotUser._id,
        };
        await conversation.save();
        return; // Exit the function early.
      }

      // --- AI Context and Memory ---
      // Fetch the last 10 messages to provide context (memory) for the AI.
      const messageHistory = await Message.find({ conversationId })
        .sort({ createdAt: -1 })
        .limit(10)
        .populate("senderId", "email")
        .lean();

      // Format the message history into the structure expected by the Groq API.
      const formattedHistory = messageHistory.reverse().map((message) => ({
        role: message.senderId.email === "groq@bot.com" ? "assistant" : "user",
        content: message.text,
      }));

      // Create a dynamic system prompt to give the AI its personality and context.
      const systemPrompt = {
        role: "system",
        content: `You are QuickBot, a helpful and friendly AI assistant within the QuickChat app. You are talking to ${
          request.user.fullName
        }. The current date is ${new Date().toLocaleDateString("en-IN", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })}.`,
      };

      // Call the Groq API with the system prompt and message history.
      const stream = await groq.chat.completions.create({
        messages: [
          systemPrompt,
          ...formattedHistory, // Includes the user's most recent message.
        ],
        model: "llama3-8b-8192",
        stream: true,
      });

      // --- AI Response Streaming Logic ---
      let fullResponse = "";
      const botMessageId = new mongoose.Types.ObjectId();

      // Notify the client that the bot is starting its response.
      io.to(conversationId).emit("botResponseStart", {
        _id: botMessageId,
        senderId: groqBotUser,
        text: "",
        createdAt: new Date().toISOString(),
        conversationId,
      });

      // Process the response stream chunk by chunk.
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          fullResponse += content;
          // Emit each chunk to the client for a real-time typing effect.
          io.to(conversationId).emit("botResponseStream", {
            _id: botMessageId,
            chunk: content,
            conversationId,
          });
        }
      }

      // Once the stream is finished, save the complete bot message to the database.
      const groqMessage = await Message.create({
        _id: botMessageId,
        senderId: groqBotUser._id,
        conversationId,
        text: fullResponse,
        seenBy: [groqBotUser._id],
      });

      const populatedGroqMessage = await Message.findById(
        groqMessage._id
      ).populate("senderId", "-password");

      // Notify the client that the bot has finished its response.
      io.to(conversationId).emit("botResponseEnd", {
        message: populatedGroqMessage,
        conversationId,
      });

      // Update the conversation's last message.
      conversation.lastMessage = {
        text: "Groq AI has responded.",
        sender: groqBotUser._id,
      };
      await conversation.save();
      return; // End the function here as the bot logic is complete.
    }

    // --- Regular Human-to-Human Message Logic ---
    let imageUrl;
    if (image) {
      // If an image is included, upload it to Cloudinary.
      const uploadResult = await cloudinary.uploader.upload(image, {
        folder: "chat_images",
      });
      imageUrl = uploadResult.secure_url;
    }

    const newMessage = await Message.create({
      senderId,
      conversationId,
      text,
      image: imageUrl || null,
      seenBy: [senderId],
    });

    const populatedMessage = await Message.findById(newMessage._id).populate(
      "senderId",
      "-password"
    );
    conversation.lastMessage = { text: text || "Image", sender: senderId };
    await conversation.save();

    // Attach the temporary ID for optimistic UI updates on the client.
    const messagePayload = populatedMessage.toObject();
    messagePayload.tempId = tempId;

    // Emit the new message to all participants in the conversation.
    io.to(conversationId).emit("newMessage", messagePayload);

    response.status(201).json({ success: true, message: populatedMessage });
  } catch (error) {
    console.error("Error in sendMessage: ", error.message);
    response
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};
