import mongoose from "mongoose";
import bcrypt from "bcrypt";

/**
 * Defines the schema for a user in the database.
 * This includes user credentials, profile information, and timestamps.
 */
const userSchema = new mongoose.Schema(
  {
    // The user's email address, used for login and identification.
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true, // Ensures each email address is unique in the database.
      lowercase: true, // Converts the email to lowercase before saving.
      trim: true, // Removes whitespace from the beginning and end.
      match: [
        /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        "Please enter a valid email address",
      ],
    },
    // The user's full name.
    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
    },
    // The user's password. It will be hashed before being saved to the database.
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters long"],
    },
    // The URL for the user's profile picture.
    profilePic: {
      type: String,
      default: "", // Defaults to an empty string if no picture is provided.
    },
    // A short biography for the user's profile.
    bio: {
      type: String,
      default: "",
      trim: true,
      maxlength: 160, // Sets a maximum length of 160 characters.
    },
    // Tracks the last time the user was active or connected.
    lastSeen: {
      type: Date,
      default: Date.now,
    },
  },
  // This option automatically adds 'createdAt' and 'updatedAt' timestamp fields.
  { timestamps: true }
);

/**
 * A pre-save middleware hook that automatically hashes the user's password
 * before it is saved to the database. This hook only runs if the password
 * field has been modified.
 */
userSchema.pre("save", async function (next) {
  // Skip hashing if the password has not been changed.
  if (!this.isModified("password")) return next();
  try {
    // Generate a salt with 10 rounds for strong encryption.
    const salt = await bcrypt.genSalt(10);
    // Hash the password with the generated salt.
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

/**
 * A method on the user schema to compare a candidate password with the
 * hashed password stored in the database.
 * @param {string} candidatePassword - The plain-text password to compare.
 * @returns {Promise<boolean>} A promise that resolves to true if the passwords match, otherwise false.
 */
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Creates the 'User' model from the schema.
const User = mongoose.model("User", userSchema);
export default User;
