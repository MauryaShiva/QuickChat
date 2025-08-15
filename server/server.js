// 📝 Import necessary modules from packages and local files.
import express from "express";
import http from "http";
import cors from "cors";
import dotenv from "dotenv";
import { Server } from "socket.io";
import { connectDB } from "./lib/db.js";
import userRoutes from "./routes/userRoutes.js";
import messageRouter from "./routes/messageRoutes.js";
import aiRouter from "./routes/aiRoutes.js";
import conversationRouter from "./routes/conversationRoutes.js";
import User from "./models/User.js";
import Conversation from "./models/Conversation.js";

// 📝 Load environment variables from the .env file.
dotenv.config();

const app = express();
const httpServer = http.createServer(app);

// 📝 Configure middlewares.
app.use(cors()); // 📌 Enable Cross-Origin Resource Sharing.
app.use(express.json({ limit: "50mb" })); // 📌 Parse incoming JSON requests with a 50mb limit.
app.use(express.urlencoded({ extended: true, limit: "50mb" })); // 📌 Parse URL-encoded data with a 50mb limit.

// 📝 Asynchronous function to initialize the server by connecting to the database and setting up initial data.
const startServer = async () => {
  await connectDB();
  // 📝 Checks if the AI bot user exists in the database and creates it if not.
  const createBotUserIfNeeded = async () => {
    try {
      const groqUser = await User.findOne({ email: "groq@bot.com" });
      if (!groqUser) {
        console.log("Creating Groq Bot User...");
        await User.create({
          fullName: "Groq 🤖",
          email: "groq@bot.com",
          password: "a_very_secure_password_placeholder", // This should be handled securely.
          bio: "I am a helpful, lightning-fast AI assistant powered by Groq.",
          profilePic:
            "https://res.cloudinary.com/domg9ab4n/image/upload/v1753960806/AI_Bot_.png",
        });
        console.log("Groq Bot User created successfully.");
      }
    } catch (error) {
      console.error("Error creating Groq Bot user:", error);
    }
  };
  await createBotUserIfNeeded();
};

startServer();

// 📝 Initialize Socket.IO server with CORS configuration.
const io = new Server(httpServer, { cors: { origin: "*" } });
// 📝 Maps user IDs to their corresponding socket IDs for real-time communication.
export const userSocketMap = {};

// 📝 Handle new client connections to the Socket.IO server.
io.on("connection", async (socket) => {
  const userId = socket.handshake.query.userId;
  // 📌 If a user ID is not provided in the connection query, do nothing.
  if (!userId) return;

  // 📌 Map the user's ID to their unique socket ID and broadcast the updated list of online users.
  userSocketMap[userId] = socket.id;
  io.emit("onlineUsers", Object.keys(userSocketMap));

  // 📝 Automatically join the user to rooms for all of their existing conversations.
  try {
    const conversations = await Conversation.find({ participants: userId });
    conversations.forEach((convo) => {
      socket.join(convo._id.toString());
    });
  } catch (error) {
    console.error("Error joining conversation rooms for user:", userId, error);
  }

  // 📝 Listen for 'typing' events from a client and broadcast it to others in the same conversation.
  socket.on("typing", ({ conversationId }) => {
    socket.to(conversationId).emit("typing", { conversationId });
  });

  // 📝 Listen for 'stopTyping' events to notify others that the user has stopped typing.
  socket.on("stopTyping", ({ conversationId }) => {
    socket.to(conversationId).emit("stopTyping", { conversationId });
  });

  // 📝 Handles a user joining a new group conversation room in real-time.
  socket.on("joinGroupRoom", ({ conversationId }) => {
    socket.join(conversationId);
  });

  // 📝 Listen for 'call-user' to initiate a WebRTC call offer to another user.
  socket.on("call-user", async (data) => {
    const { to, offer, isVideo } = data;
    const receiverSocketId = userSocketMap[to];
    if (receiverSocketId) {
      const caller = await User.findById(userId).select("-password");
      socket.to(receiverSocketId).emit("call-made", {
        offer,
        from: userId,
        isVideo,
        callerInfo: caller,
      });
    }
  });

  // 📝 Listen for 'make-answer' to send a WebRTC answer back to the calling user.
  socket.on("make-answer", (data) => {
    const { to, answer } = data;
    const receiverSocketId = userSocketMap[to];
    if (receiverSocketId) {
      socket.to(receiverSocketId).emit("answer-made", { answer, from: userId });
    }
  });

  // 📝 Listen for 'ice-candidate' to exchange network candidates for WebRTC connection.
  socket.on("ice-candidate", (data) => {
    const { to, candidate } = data;
    const receiverSocketId = userSocketMap[to];
    if (receiverSocketId) {
      socket
        .to(receiverSocketId)
        .emit("ice-candidate-received", { candidate, from: userId });
    }
  });

  // 📝 Listen for 'call-timeout' to notify the recipient of a missed call.
  socket.on("call-timeout", async (data) => {
    const { to } = data;
    const receiverSocketId = userSocketMap[to];
    if (receiverSocketId) {
      const caller = await User.findById(userId).select("fullName");
      io.to(receiverSocketId).emit("call-missed", {
        callerName: caller ? caller.fullName : "Someone",
      });
    }
  });

  // 📝 Listen for 'reject-call' to inform the caller that the call was rejected.
  socket.on("reject-call", (data) => {
    const { to } = data;
    const receiverSocketId = userSocketMap[to];
    if (receiverSocketId) {
      socket.to(receiverSocketId).emit("call-rejected");
    }
  });

  // 📝 Listen for 'end-call' to terminate the call for both parties.
  socket.on("end-call", (data) => {
    const { to } = data;
    const receiverSocketId = userSocketMap[to];
    if (receiverSocketId) {
      socket.to(receiverSocketId).emit("call-ended");
    }
  });

  // ✨ NEW: Handler for when a client wants to renegotiate the connection (ICE Restart).
  socket.on("renegotiate-call", ({ to, offer }) => {
    const recipientSocketId = userSocketMap[to];
    if (recipientSocketId) {
      io.to(recipientSocketId).emit("renegotiate-call", {
        from: userId,
        offer,
      });
    }
  });
  // ✨ NEW: Handler for the answer to a renegotiation offer.
  socket.on("renegotiate-answer", ({ to, answer }) => {
    const recipientSocketId = userSocketMap[to];
    if (recipientSocketId) {
      io.to(recipientSocketId).emit("renegotiate-answer", {
        from: userId,
        answer,
      });
    }
  });

  // 📝 Handle client disconnection.
  socket.on("disconnect", async () => {
    // 📌 Remove the user from the online users map and broadcast the updated list.
    delete userSocketMap[userId];
    io.emit("onlineUsers", Object.keys(userSocketMap));
    socket.broadcast.emit("user-disconnected", { userId });
    // 📌 Update the user's 'lastSeen' timestamp in the database.
    try {
      await User.findByIdAndUpdate(userId, { lastSeen: new Date() });
    } catch (error) {
      console.error("Failed to update lastSeen for user:", userId, error);
    }
  });
});

export { io };

// 📝 A simple API endpoint to check if the server is running.
app.get("/api/status", (req, res) => {
  res.json({ success: true, message: "Server is running!" });
});

// 📝 Mount the routers for different API endpoints.
app.use("/api/auth", userRoutes);
app.use("/api/messages", messageRouter);
app.use("/api/ai", aiRouter);
app.use("/api/conversations", conversationRouter);

// Server ko Vercel ke liye export karo.
// Yeh line Vercel ko batati hai ki is file ko run karna hai.
export default httpServer;

// 📝 Define the port from environment variables or default to 5000.
const PORT = process.env.PORT || 5000;
// 📝 Start the HTTP server and listen on the specified port.
httpServer.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
