import React, { useState, useContext, useRef } from "react";
import { ChatContext } from "../../context/ChatContext";
import { AuthContext } from "../../context/AuthContext";
import toast from "react-hot-toast";
import assets from "../assets/assets";

/**
 * A modal component for viewing and editing group chat information.
 * @param {{ onClose: () => void; }} props
 */
const GroupInfoModal = ({ onClose }) => {
  // Destructures state and functions from the chat and authentication contexts.
  const { selectedConversation, updateGroupInfo } = useContext(ChatContext);
  const { authUser, axios, onlineUsers } = useContext(AuthContext);

  // State to toggle between viewing and editing modes.
  const [isEditing, setIsEditing] = useState(false);
  // State for the editable group name.
  const [groupName, setGroupName] = useState(selectedConversation.groupName);
  // State for the editable group bio.
  const [groupBio, setGroupBio] = useState(selectedConversation.groupBio || "");
  // State to hold the new group icon file data (if changed).
  const [groupIcon, setGroupIcon] = useState(null);
  // State for the visual preview of the group icon.
  const [previewIcon, setPreviewIcon] = useState(
    selectedConversation.groupIcon
  );
  // State to manage the loading indicator for the AI bio generation.
  const [isGenerating, setIsGenerating] = useState(false);
  // Reference to the hidden file input element for the group icon.
  const fileInputRef = useRef(null);

  // Determines if the current authenticated user is the admin of the group.
  const isUserAdmin = selectedConversation.admin?._id === authUser._id;

  /**
   * Handles the change event when a new group icon is selected.
   * @param {React.ChangeEvent<HTMLInputElement>} event - The file input change event.
   */
  const handleIconChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      return toast.error("Please select an image file.");
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      // Update both the visual preview and the state for the new icon data.
      setPreviewIcon(reader.result);
      setGroupIcon(reader.result);
    };
    reader.readAsDataURL(file);
  };

  /**
   * Handles the submission of changes to the group's information.
   */
  const handleSaveChanges = () => {
    if (!groupName.trim()) {
      return toast.error("Group name cannot be empty.");
    }
    const updatedData = { groupName, groupBio };
    if (groupIcon) {
      updatedData.groupIcon = groupIcon;
    }
    // Call the context function to optimistically update and send changes to the server.
    updateGroupInfo(selectedConversation._id, updatedData, previewIcon);
    setIsEditing(false);
    toast.success("Group info updated!");
  };

  /**
   * Sends a request to the backend to generate a group bio using AI.
   */
  const handleGenerateBio = async () => {
    if (!groupBio.trim()) {
      return toast.error(
        "Please enter some keywords in the bio field to generate from."
      );
    }
    setIsGenerating(true);
    try {
      const { data } = await axios.post("/api/ai/generate-bio", {
        keywords: groupBio,
      });
      if (data.success) {
        setGroupBio(data.bio);
        toast.success("Bio generated successfully!");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to generate bio.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    // The modal backdrop, which closes the modal when clicked.
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* The modal content, which stops click propagation. */}
      <div
        className="bg-gray-800/80 backdrop-blur-xl rounded-xl shadow-lg w-full max-w-md p-6 border border-gray-700 text-white"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-4">
            <img
              src={previewIcon || assets.group_icon}
              alt="Group Icon"
              className="w-24 h-24 rounded-full object-cover border-4 border-teal-500"
            />
            {isEditing && (
              <>
                <input
                  type="file"
                  ref={fileInputRef}
                  hidden
                  accept="image/*"
                  onChange={handleIconChange}
                />
                <button
                  onClick={() => fileInputRef.current.click()}
                  className="absolute bottom-0 right-0 bg-teal-600 p-2 rounded-full hover:bg-teal-700"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 text-white"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path d="M17.414 2.586a2 2 0 0 0-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 0 0 0-2.828z" />
                    <path
                      fillRule="evenodd"
                      d="M2 6a2 2 0 0 1 2-2h4a1 1 0 0 1 0 2H4v10h10v-4a1 1 0 1 1 2 0v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </>
            )}
          </div>

          {isEditing ? (
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="bg-gray-900/90 text-white text-2xl font-bold p-2 rounded-lg text-center w-full focus:ring-2 focus:ring-teal-500 outline-none"
            />
          ) : (
            <h2 className="text-2xl font-bold">{groupName}</h2>
          )}

          {isEditing ? (
            <div className="relative w-full mt-2">
              <textarea
                value={groupBio}
                onChange={(e) => setGroupBio(e.target.value)}
                placeholder="Add keywords and click generate..."
                className="bg-gray-900/90 text-white text-sm p-2 pr-28 rounded-lg text-center w-full h-24 resize-none focus:ring-2 focus:ring-teal-500 outline-none"
              />
              <button
                type="button"
                onClick={handleGenerateBio}
                disabled={isGenerating}
                className="absolute bottom-2 right-2 px-3 py-1.5 bg-teal-600 text-xs font-semibold rounded-md hover:bg-teal-700 transition duration-300 disabled:bg-teal-800"
              >
                {isGenerating ? "Generating..." : "Generate with AI"}
              </button>
            </div>
          ) : (
            <p className="text-sm text-gray-300 mt-1">
              {groupBio || "No bio."}
            </p>
          )}

          {/* Conditionally render edit controls only for the group admin. */}
          {isUserAdmin &&
            (isEditing ? (
              <div className="flex gap-4 mt-4">
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 text-sm rounded-lg text-gray-300 hover:bg-gray-700 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveChanges}
                  className="px-6 py-2 text-sm rounded-lg bg-teal-600 text-white font-semibold hover:bg-teal-700 transition"
                >
                  Save
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="mt-4 px-6 py-2 text-sm rounded-lg bg-teal-600/50 text-white font-semibold hover:bg-teal-600/80 transition"
              >
                Edit Group
              </button>
            ))}
        </div>

        <hr className="my-4 border-t border-gray-700/50" />

        <h3 className="font-semibold mb-2">
          {selectedConversation.participants.length} Participants
        </h3>
        {/* Scrollable list of group participants. */}
        <div className="max-h-40 overflow-y-auto pr-2">
          {selectedConversation.participants.map((participant) => {
            const isOnline = onlineUsers.includes(participant._id);
            return (
              <div
                key={participant._id}
                className="flex items-center gap-3 p-2 rounded-lg"
              >
                <div className="relative">
                  <img
                    src={participant.profilePic || assets.avatar_icon}
                    alt={participant.fullName}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                  {/* Online status indicator dot. */}
                  {isOnline && participant._id !== authUser._id && (
                    <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-green-400 ring-2 ring-gray-800"></span>
                  )}
                </div>
                <div>
                  <p className="font-medium">{participant.fullName}</p>
                  {/* Display user's role (Admin) or online/offline status. */}
                  <span
                    className={`text-xs ${
                      selectedConversation.admin?._id === participant._id
                        ? "text-teal-400"
                        : isOnline
                        ? "text-green-400"
                        : "text-gray-400"
                    }`}
                  >
                    {selectedConversation.admin?._id === participant._id
                      ? "Admin"
                      : isOnline
                      ? "online"
                      : "offline"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default GroupInfoModal;
