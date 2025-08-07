import mongoose from "mongoose";

/**
 * Defines the schema for a message in the database.
 * This schema is designed to support both one-on-one and group conversations.
 */
const messageSchema = new mongoose.Schema(
  {
    // The user ID of the person who sent the message.
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // This creates a reference to the 'User' model.
      required: true,
    },
    // The ID of the conversation this message belongs to.
    // This replaces the older 'receiverId' to support group chats.
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation", // This creates a reference to the 'Conversation' model.
      required: true,
    },
    // The text content of the message.
    text: {
      type: String,
      default: "", // Defaults to an empty string if no text is provided.
    },
    // The URL of an image, if the message includes one.
    image: {
      type: String,
      default: "",
    },
    // An array of user IDs who have seen the message.
    // This allows for read receipts in both one-on-one and group chats.
    seenBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  // This option automatically adds 'createdAt' and 'updatedAt' timestamp fields to the schema.
  { timestamps: true }
);

// Creates the 'Message' model from the schema.
const Message = mongoose.model("Message", messageSchema);
export default Message;
