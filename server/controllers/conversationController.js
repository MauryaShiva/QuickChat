// 📝 Import necessary models and libraries.
import Conversation from "../models/Conversation.js";
import User from "../models/User.js";
import Message from "../models/Message.js";
import cloudinary from "../lib/cloudinary.js";
import { io, userSocketMap } from "../server.js";

/**
 * Fetches all conversations for the currently logged-in user.
 * It also ensures a default conversation with the AI bot exists.
 */
export const getConversations = async (request, response) => {
  try {
    const userId = request.user._id;
    const groqBot = await User.findOne({ email: "groq@bot.com" });

    // 📌 If the Groq AI bot exists, ensure the user has a conversation with it.
    if (groqBot) {
      const existingGroqConvo = await Conversation.findOne({
        isGroupChat: false,
        participants: { $all: [userId, groqBot._id], $size: 2 },
      });

      // 📌 If no conversation exists with the bot, create one with a welcome message.
      if (!existingGroqConvo) {
        await Conversation.create({
          participants: [userId, groqBot._id],
          lastMessage: {
            text: "Hello! I'm Groq, your AI assistant. How can I help you today?",
            sender: groqBot._id,
          },
        });
      }
    }

    // 📌 Find all conversations the user is a part of, populating necessary details.
    const conversations = await Conversation.find({ participants: userId })
      .populate("participants", "-password")
      .populate("admin", "-password")
      .populate("lastMessage.sender", "-password")
      .sort({ updatedAt: -1 })
      .lean();

    // 📌 For each conversation, calculate the count of unseen messages.
    const conversationsWithCounts = await Promise.all(
      conversations.map(async (convo) => {
        const unseenCount = await Message.countDocuments({
          conversationId: convo._id,
          senderId: { $ne: userId },
          seenBy: { $ne: userId },
        });
        return { ...convo, unseenMessagesCount: unseenCount };
      })
    );
    response.json({ success: true, conversations: conversationsWithCounts });
  } catch (error) {
    console.error("Error in getConversations: ", error.message);
    response
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

/**
 * Creates a new conversation, which can be a one-on-one chat or a group chat.
 */
export const createConversation = async (request, response) => {
  try {
    const { participantIds, groupName, groupIcon, groupBio } = request.body;
    const adminId = request.user._id;

    if (!participantIds || !Array.isArray(participantIds)) {
      return response
        .status(400)
        .json({ success: false, message: "Participant IDs are required." });
    }

    // 📌 Combine admin's ID with participant IDs, ensuring no duplicates.
    const allParticipantIds = [
      ...new Set([adminId.toString(), ...participantIds]),
    ];
    const isGroupChat = !!groupName;

    if (isGroupChat && !groupName.trim()) {
      return response.status(400).json({
        success: false,
        message: "Group name cannot be empty for group chats.",
      });
    }

    let conversation;
    // 📌 For one-on-one chats, check if a conversation already exists.
    if (!isGroupChat) {
      conversation = await Conversation.findOne({
        isGroupChat: false,
        participants: { $all: allParticipantIds, $size: 2 },
      });
    }

    // 📌 If an existing conversation is found, return it.
    if (conversation) {
      const populated = await conversation.populate(
        "participants",
        "-password"
      );
      return response.json({
        success: true,
        conversation: populated,
        isNew: false,
      });
    }

    // 📌 If a group icon is provided, upload it to Cloudinary.
    let uploadedIconUrl = "";
    if (isGroupChat && groupIcon) {
      const uploadResult = await cloudinary.uploader.upload(groupIcon, {
        folder: "group_icons",
      });
      uploadedIconUrl = uploadResult.secure_url;
    }

    const newConversation = new Conversation({
      participants: allParticipantIds,
      isGroupChat,
      groupName: isGroupChat ? groupName : undefined,
      groupIcon: isGroupChat ? uploadedIconUrl : undefined,
      groupBio: isGroupChat ? groupBio : undefined,
      admin: isGroupChat ? adminId : undefined,
    });
    await newConversation.save();

    const populatedConversation = await Conversation.findById(
      newConversation._id
    )
      .populate("participants", "-password")
      .populate("admin", "-password");

    // 📌 Notify all participants of the new conversation via WebSockets.
    allParticipantIds.forEach((participantId) => {
      const socketId = userSocketMap[participantId.toString()];
      if (socketId) {
        io.to(socketId).emit("newConversation", populatedConversation);
      }
    });

    response.status(201).json({
      success: true,
      conversation: populatedConversation,
      isNew: true,
    });
  } catch (error) {
    console.error("Error in createConversation: ", error.message);
    response
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

/**
 * Updates a group's information (name, bio, icon). Only the admin can perform this action.
 */
export const updateGroupInfo = async (req, res) => {
  try {
    const { groupName, groupBio, groupIcon } = req.body;
    const { conversationId } = req.params;
    const userId = req.user._id;
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res
        .status(404)
        .json({ success: false, message: "Group not found." });
    }
    // 📌 Ensure the user making the request is the group admin.
    if (conversation.admin.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Only the group admin can edit group info.",
      });
    }
    if (groupName) conversation.groupName = groupName;
    if (groupBio) conversation.groupBio = groupBio;
    if (groupIcon) {
      const uploadResult = await cloudinary.uploader.upload(groupIcon, {
        folder: "group_icons",
      });
      conversation.groupIcon = uploadResult.secure_url;
    }
    await conversation.save();
    const updatedConversation = await Conversation.findById(conversationId)
      .populate("participants", "-password")
      .populate("admin", "-password");

    // 📌 Emit a 'groupUpdate' event to notify all members of the changes in real-time.
    io.to(conversationId).emit("groupUpdate", updatedConversation);

    res.json({ success: true, conversation: updatedConversation });
  } catch (error) {
    console.error("Error in updateGroupInfo: ", error.message);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * Allows a user to leave a group. Handles admin reassignment or group deletion if necessary.
 */
export const leaveGroup = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res
        .status(404)
        .json({ success: false, message: "Group not found." });
    }
    const wasAdmin = conversation.admin.toString() === userId.toString();
    // 📌 Remove the user from the participants list.
    conversation.participants.pull(userId);

    // 📌 If the group becomes empty after the user leaves, delete it and its messages.
    if (conversation.participants.length === 0) {
      await Message.deleteMany({ conversationId: conversationId });
      await Conversation.findByIdAndDelete(conversationId);
    } else {
      // 📌 If the leaving user was the admin, assign a new admin.
      if (wasAdmin) {
        conversation.admin = conversation.participants[0];
      }
      await conversation.save();
      const updatedConversation = await Conversation.findById(conversationId)
        .populate("participants", "-password")
        .populate("admin", "-password");

      // 📌 Notify remaining members of the change in group membership and admin status.
      io.to(conversationId).emit("groupUpdate", updatedConversation);
    }

    // 📌 Notify the user who left to remove the conversation from their client.
    const leaverSocketId = userSocketMap[userId.toString()];
    if (leaverSocketId) {
      io.to(leaverSocketId).emit("conversationRemoved", conversationId);
    }

    res
      .status(200)
      .json({ success: true, message: "You have left the group." });
  } catch (error) {
    console.error("Error in leaveGroup: ", error.message);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * Adds one or more new participants to a group. Only the admin can perform this action.
 */
export const addParticipant = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { userIdsToAdd } = req.body;
    const adminId = req.user._id;
    if (
      !userIdsToAdd ||
      !Array.isArray(userIdsToAdd) ||
      userIdsToAdd.length === 0
    ) {
      return res
        .status(400)
        .json({ message: "An array of user IDs is required." });
    }
    const conversation = await Conversation.findById(conversationId);
    if (!conversation)
      return res.status(404).json({ message: "Conversation not found" });
    // 📌 Ensure the user making the request is the group admin.
    if (conversation.admin.toString() !== adminId.toString()) {
      return res
        .status(403)
        .json({ message: "Forbidden: Only admins can add members" });
    }
    // 📌 Filter out users who are already in the group.
    const newParticipantIds = userIdsToAdd.filter(
      (id) => !conversation.participants.some((p) => p.equals(id))
    );
    if (newParticipantIds.length === 0) {
      return res
        .status(400)
        .json({ message: "All selected users are already in the group." });
    }
    conversation.participants.push(...newParticipantIds);
    await conversation.save();
    const updatedConversation = await Conversation.findById(conversationId)
      .populate("participants", "-password")
      .populate("admin", "-password");

    // 📌 Notify all current members about the updated participant list.
    io.to(conversationId).emit("groupUpdate", updatedConversation);

    // 📌 Notify each new participant that they've been added and make them join the socket room.
    newParticipantIds.forEach((userId) => {
      const newMemberSocketId = userSocketMap[userId.toString()];
      if (newMemberSocketId) {
        io.to(newMemberSocketId).emit("newConversation", updatedConversation);
        const socketInstance = io.sockets.sockets.get(newMemberSocketId);
        if (socketInstance) {
          socketInstance.join(conversationId);
        }
      }
    });
    res.status(200).json({ success: true, conversation: updatedConversation });
  } catch (error) {
    console.error("Error in addParticipant: ", error.message);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * Removes a participant from a group. Only the admin can perform this action.
 */
export const removeParticipant = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { userIdToRemove } = req.body;
    const adminId = req.user._id;
    const conversation = await Conversation.findById(conversationId);
    if (!conversation)
      return res.status(404).json({ message: "Conversation not found" });
    // 📌 Ensure the user making the request is the group admin.
    if (conversation.admin.toString() !== adminId.toString())
      return res
        .status(403)
        .json({ message: "Forbidden: Only admins can remove members" });
    // 📌 Prevent the admin from removing themselves with this function.
    if (userIdToRemove === adminId.toString())
      return res
        .status(400)
        .json({ message: "Admin cannot remove themselves" });
    conversation.participants.pull(userIdToRemove);
    await conversation.save();
    const updatedConversation = await Conversation.findById(conversationId)
      .populate("participants", "-password")
      .populate("admin", "-password");

    // 📌 Notify all remaining members of the updated participant list.
    io.to(conversationId).emit("groupUpdate", updatedConversation);

    // 📌 Notify the removed user so they can remove the conversation from their client.
    const removedUserSocketId = userSocketMap[userIdToRemove];
    if (removedUserSocketId) {
      io.to(removedUserSocketId).emit("conversationRemoved", conversationId);
    }
    res
      .status(200)
      .json({ success: true, message: "Participant removed successfully" });
  } catch (error) {
    console.error("Error in removeParticipant: ", error.message);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * Deletes an entire group conversation and all associated messages. Only the admin can do this.
 */
export const deleteGroupConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const adminId = req.user._id;
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res
        .status(404)
        .json({ success: false, message: "Group not found." });
    }
    // 📌 Ensure the user making the request is the group admin.
    if (conversation.admin.toString() !== adminId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Only the group admin can delete the group.",
      });
    }
    // 📌 Delete all messages within the group and then delete the group itself.
    await Message.deleteMany({ conversationId: conversationId });
    await Conversation.findByIdAndDelete(conversationId);
    // 📌 Notify all members to remove the conversation from their clients.
    io.to(conversationId).emit("conversationRemoved", conversationId);
    res
      .status(200)
      .json({ success: true, message: "Group deleted successfully." });
  } catch (error) {
    console.error("Error in deleteGroupConversation: ", error.message);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
