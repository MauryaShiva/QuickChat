import jwt from "jsonwebtoken";
import User from "../models/User.js";

/**
 * An Express middleware function to protect routes by verifying a JSON Web Token (JWT).
 * It checks for a token in the request headers, validates it, and attaches the
 * authenticated user's data to the request object.
 * @param {object} request - The Express request object.
 * @param {object} response - The Express response object.
 * @param {Function} next - The next middleware function in the stack.
 */
export const protectRoute = async (request, response, next) => {
  try {
    // Attempt to get the token from either the 'authorization' or 'token' header.
    const rawToken = request.headers.authorization || request.headers.token;
    if (!rawToken) {
      return response
        .status(401)
        .json({ success: false, message: "No token provided" });
    }

    // The token might be prefixed with "Bearer ", so we handle that case.
    const token = rawToken.startsWith("Bearer ")
      ? rawToken.split(" ")[1]
      : rawToken;

    // Verify the token using the secret key. This will throw an error if the token is invalid or expired.
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find the user in the database using the ID from the decoded token.
    // Exclude the password field from the returned user object.
    const user = await User.findById(decoded.userId).select("-password");
    if (!user) {
      return response
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Attach the authenticated user object to the request for use in subsequent controllers.
    request.user = user;
    // Pass control to the next middleware or route handler.
    next();
  } catch (error) {
    // Catches errors from jwt.verify() (e.g., invalid signature, expired token).
    console.log("protectRoute error:", error.message);
    response
      .status(401)
      .json({ success: false, message: "Invalid or expired token" });
  }
};
