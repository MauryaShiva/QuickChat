// Import JSON Web Token (JWT) library to sign and verify tokens
import jwt from "jsonwebtoken";

// Function to generate a JSON Web Token for a given user identifier
export const generateToken = (userId) => {
  return jwt.sign(
    { userId }, // Payload contains the unique user identifier
    process.env.JWT_SECRET, // Secret key used to sign the token, stored in environment variable
    {
      expiresIn: "7d", // Token will expire after 7 days
    }
  );
};
