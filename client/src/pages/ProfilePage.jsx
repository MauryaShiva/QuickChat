import React, { useContext, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import assets from "../assets/assets";
import { AuthContext } from "../../context/AuthContext";
import toast from "react-hot-toast";

/**
 * A page component for viewing and editing the authenticated user's profile.
 * It allows updating the user's name, bio, and profile picture.
 */
const ProfilePage = () => {
  // Destructures state and functions from the authentication context.
  const { authUser, updateProfile, axios } = useContext(AuthContext);
  const navigate = useNavigate();

  // State for the user's editable full name.
  const [name, setName] = useState(authUser?.fullName || "");
  // State for the user's editable bio.
  const [bio, setBio] = useState(authUser?.bio || "");
  // State to hold the selected image file for the new profile picture.
  const [selectedImg, setSelectedImg] = useState(null);
  // State to manage the loading indicator for the AI bio generation.
  const [isGenerating, setIsGenerating] = useState(false);

  // Effect to update the form fields if the authUser object changes (e.g., after initial load).
  useEffect(() => {
    if (authUser) {
      setName(authUser.fullName);
      setBio(authUser.bio);
    }
  }, [authUser]);

  /**
   * Sends a request to the backend to generate a user bio based on keywords.
   */
  const handleGenerateBio = async () => {
    if (!bio.trim()) {
      toast.error("Please enter some keywords in the bio field first.");
      return;
    }
    setIsGenerating(true);
    try {
      const { data } = await axios.post("/api/ai/generate-bio", {
        keywords: bio,
      });
      if (data.success) {
        setBio(data.bio);
        toast.success("Bio generated!");
      } else {
        toast.error("Failed to generate bio.");
      }
    } catch (error) {
      toast.error("An error occurred while generating the bio.");
    } finally {
      setIsGenerating(false);
    }
  };

  /**
   * Handles the form submission to update the user's profile.
   * @param {React.FormEvent} event - The form submission event.
   */
  const handleSubmit = (event) => {
    event.preventDefault();
    const payload = { fullName: name, bio };

    // Navigate back to the home page immediately for a faster user experience.
    navigate("/");

    // If a new image was selected, convert it to a base64 string before updating.
    if (selectedImg) {
      const reader = new FileReader();
      reader.readAsDataURL(selectedImg);
      reader.onloadend = () => {
        payload.profilePic = reader.result;
        updateProfile(payload);
      };
      reader.onerror = (error) => {
        console.error("Error converting file to base64:", error);
        toast.error("Failed to upload image.");
      };
    } else {
      // If no new image was selected, update the profile with just the text fields.
      updateProfile(payload);
    }
  };

  // Determines the source for the small profile picture preview.
  const previewSrc = selectedImg
    ? URL.createObjectURL(selectedImg)
    : authUser?.profilePic || assets.avatar_icon;

  // Determines the source for the larger image displayed on the right side.
  const rightSideImage = selectedImg
    ? URL.createObjectURL(selectedImg)
    : authUser?.profilePic || assets.logo_icon;

  return (
    <div className="min-h-screen bg-gradient-to-tr from-[#181818] to-[#2e2e2e] text-white flex items-center justify-center px-4">
      <div className="w-full max-w-4xl backdrop-blur-lg border border-gray-600 rounded-2xl shadow-lg flex max-md:flex-col-reverse overflow-hidden">
        <form
          onSubmit={handleSubmit}
          className="flex-1 p-8 sm:p-12 flex flex-col gap-5"
        >
          <h2 className="text-2xl font-semibold mb-2">Profile Details</h2>

          {/* Profile Image Upload Section */}
          <label
            htmlFor="avatar"
            className="flex items-center gap-4 cursor-pointer"
          >
            <input
              type="file"
              id="avatar"
              accept=".png, .jpg, .jpeg"
              hidden
              onChange={(e) => setSelectedImg(e.target.files[0])}
            />
            <AnimatePresence mode="wait">
              <motion.img
                key={previewSrc}
                src={previewSrc}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = assets.avatar_icon;
                }}
                alt="avatar"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.3 }}
                className="w-16 h-16 rounded-full border-2 border-gray-500 object-cover"
              />
            </AnimatePresence>
            <span className="text-sm text-gray-300 hover:underline">
              Upload profile image
            </span>
          </label>

          {/* Name Input */}
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Your name"
            className="p-2 bg-transparent border border-gray-500 rounded-md focus:outline-none focus:ring-2 focus:ring-violet-500"
          />

          {/* Bio Textarea with AI Generation */}
          <div className="relative">
            <textarea
              rows={4}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Write a few keywords about yourself, then click generate!"
              required
              className="p-2 w-full bg-transparent border border-gray-500 rounded-md focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
            ></textarea>
            <button
              type="button"
              onClick={handleGenerateBio}
              disabled={isGenerating}
              className="absolute bottom-2 right-2 bg-violet-600/50 text-white text-xs font-semibold py-1 px-3 rounded-full hover:bg-violet-600/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? "Generating..." : "Generate with AI"}
            </button>
          </div>

          <button
            type="submit"
            className="bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 transition-all text-white py-2 px-6 rounded-full font-medium text-lg shadow-md"
          >
            Save Profile
          </button>
        </form>

        {/* Right-side Image Preview */}
        <div className="flex items-center justify-center p-6 bg-[#262626]">
          <img
            src={rightSideImage}
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = assets.logo_icon;
            }}
            alt="Profile Preview"
            className="max-w-44 aspect-square rounded-full mx-10 max-sm:mt-10 object-cover"
          />
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
