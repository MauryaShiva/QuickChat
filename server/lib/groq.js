// Import Groq SDK to interact with Groq's language model API
import Groq from "groq-sdk";

// Import dotenv to load environment variables from .env file
import dotenv from "dotenv";

// Load environment variables into process.env
dotenv.config();

// Create a new instance of the Groq SDK using the API key from the environment
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY, // API key stored securely in .env file
});

// Export the configured Groq instance for use in other modules or routes
export default groq;
