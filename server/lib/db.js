import mongoose from "mongoose";

// Asynchronous function to connect to MongoDB database
export const connectDB = async () => {
  try {
    // Attempt to connect to MongoDB using environment variable with a database name suffix
    await mongoose.connect(`${process.env.MONGODB_URI}/chat-app`, {
      useNewUrlParser: true, // Use new URL parser (recommended setting)
      useUnifiedTopology: true, // Use new topology engine (recommended setting)
    });

    // Log success message if MongoDB connection is successful
    console.log("✅ MongoDB connected successfully");
  } catch (error) {
    // Log error and terminate the server if MongoDB connection fails
    console.error("❌ MongoDB connection error:", error.message);
    process.exit(1);
  }

  // Optional event listener for successful MongoDB connection at runtime
  mongoose.connection.on("connected", () => {
    console.log("🔌 Mongoose connection established");
  });
};
