import bcrypt from "bcryptjs";
import cloudinary from "../lib/cloudinary.js";
import User from "../models/User.js";
import Conversation from "../models/Conversation.js";
import { generateToken } from "../lib/utils.js";

/**
 * Handles new user registration (sign-up).
 * Creates a new user, hashes their password, and automatically creates a conversation with the AI bot.
 * @param {object} request - The Express request object.
 * @param {object} response - The Express response object.
 */
export const signup = async (request, response) => {
  const { fullName, email, password, bio } = request.body;

  try {
    if (!fullName || !email || !password || !bio) {
      return response
        .status(400)
        .json({ success: false, message: "All fields are required" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return response
        .status(400)
        .json({ success: false, message: "User already exists" });
    }

    const newUser = await User.create({
      fullName,
      email,
      password, // The password will be hashed by the pre-save hook in the User model.
      bio,
    });

    // Automatically create a conversation with the Groq AI bot for the new user.
    const groqBot = await User.findOne({ email: "groq@bot.com" });
    if (groqBot) {
      await Conversation.create({
        participants: [newUser._id, groqBot._id],
        lastMessage: {
          text: "Hello! I'm Groq, your AI assistant. How can I help you today?",
          sender: groqBot._id,
        },
      });
    }

    // Generate a JWT for the new user.
    const token = generateToken(newUser._id);
    const user = newUser.toObject();
    delete user.password; // Remove the hashed password from the response.

    response.json({
      success: true,
      user,
      token,
      message: "Account created successfully",
    });
  } catch (error) {
    console.error("Signup error:", error.message);

    // Provide more specific error messages for Mongoose validation failures.
    if (error.name === "ValidationError") {
      // Check if the error is specifically for the bio's maximum length.
      if (
        error.errors &&
        error.errors.bio &&
        error.errors.bio.kind === "maxlength"
      ) {
        return response.status(400).json({
          success: false,
          message: "Bio cannot be more than 160 characters.",
        });
      }
      return response.status(400).json({
        success: false,
        message: "Please check your input and try again.",
      });
    }

    // Fallback for any other server errors.
    response
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

/**
 * Handles user login.
 * Verifies credentials and returns a JWT upon successful authentication.
 * @param {object} request - The Express request object.
 * @param {object} response - The Express response object.
 */
export const login = async (request, response) => {
  const { email, password } = request.body;

  try {
    const userDoc = await User.findOne({ email });
    if (!userDoc) {
      return response.status(400).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const isPasswordCorrect = await bcrypt.compare(password, userDoc.password);
    if (!isPasswordCorrect) {
      return response.status(400).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const token = generateToken(userDoc._id);
    const user = userDoc.toObject();
    delete user.password;

    response.json({
      success: true,
      user,
      token,
      message: "Login successful",
    });
  } catch (error) {
    console.error("Login error:", error.message);
    response.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Checks the validity of a user's token and returns the user's data.
 * This is typically used for session verification on the client-side.
 * @param {object} request - The Express request object, with user data attached by middleware.
 * @param {object} response - The Express response object.
 */
export const checkAuth = async (request, response) => {
  const user = request.user?.toObject ? request.user.toObject() : request.user;
  if (user) delete user.password;
  response.json({ success: true, user });
};

/**
 * Updates the profile of the authenticated user.
 * @param {object} request - The Express request object.
 * @param {object} response - The Express response object.
 */
export const updateProfile = async (request, response) => {
  try {
    const { fullName, bio, profilePic } = request.body;
    const userId = request.user._id;

    const user = await User.findById(userId);
    if (!user) {
      return response
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    user.fullName = fullName || user.fullName;
    user.bio = bio || user.bio;

    // If a new profile picture is provided, upload it to Cloudinary.
    if (profilePic) {
      const uploadResult = await cloudinary.uploader.upload(profilePic, {
        folder: "profile_pics",
      });
      user.profilePic = uploadResult.secure_url;
    }

    const updatedUser = await user.save();
    const userToReturn = updatedUser.toObject();
    delete userToReturn.password;

    response.json({
      success: true,
      user: userToReturn,
      message: "Profile updated successfully",
    });
  } catch (error) {
    console.error("Update profile error:", error.message);
    response.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Fetches a list of all users, excluding the currently logged-in user and the AI bot.
 * @param {object} request - The Express request object.
 * @param {object} response - The Express response object.
 */
export const getUsers = async (request, response) => {
  try {
    const loggedInUserId = request.user._id;

    const allUsers = await User.find({
      _id: { $ne: loggedInUserId }, // Exclude the current user.
      email: { $ne: "groq@bot.com" }, // Exclude the AI bot.
    }).select("-password"); // Exclude passwords from the result.

    response.json({ success: true, users: allUsers });
  } catch (error) {
    console.error("Error in getUsers: ", error.message);
    response
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};
