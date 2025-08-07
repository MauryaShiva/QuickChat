import mongoose from "mongoose";

/**
 * Defines the schema for a conversation in the database.
 * A conversation can be either a one-on-one chat or a group chat.
 */
const conversationSchema = new mongoose.Schema(
  {
    // An array of user IDs who are part of this conversation.
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User", // This creates a reference to the 'User' model.
        required: true,
      },
    ],
    // The name of the group, only applicable if it's a group chat.
    groupName: {
      type: String,
      trim: true, // Removes whitespace from the beginning and end of the string.
    },
    // The URL for the group's profile icon.
    groupIcon: {
      type: String,
      default: "", // Sets a default empty string if no icon is provided.
    },
    // A short description or bio for the group.
    groupBio: {
      type: String,
      trim: true,
      maxlength: 250, // Sets a maximum length of 250 characters for the bio.
    },
    // A boolean flag to distinguish between one-on-one chats and group chats.
    isGroupChat: {
      type: Boolean,
      default: false,
    },
    // The user ID of the group's administrator, only applicable for group chats.
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    // Stores a snippet of the most recent message for display in the conversation list.
    lastMessage: {
      text: String,
      sender: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    },
  },
  // This option automatically adds 'createdAt' and 'updatedAt' timestamp fields to the schema.
  { timestamps: true }
);

// Creates the 'Conversation' model from the schema.
const Conversation = mongoose.model("Conversation", conversationSchema);
export default Conversation;
