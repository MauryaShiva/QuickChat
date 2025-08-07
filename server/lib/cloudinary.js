// Import the Cloudinary library (version 2)
import { v2 as cloudinary } from "cloudinary";

// Import dotenv to enable environment variable loading from .env files
import dotenv from "dotenv";

// Load environment variables from .env file into process.env
dotenv.config();

// Configure Cloudinary with credentials and secure setting
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, // Your Cloudinary account name
  api_key: process.env.CLOUDINARY_API_KEY, // Your Cloudinary API key
  api_secret: process.env.CLOUDINARY_API_SECRET, // Your Cloudinary API secret
  secure: true, // Ensure HTTPS is used for media access
});

// Export the configured Cloudinary instance for use in other modules
export default cloudinary;
