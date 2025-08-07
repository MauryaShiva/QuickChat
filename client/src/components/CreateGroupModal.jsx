import React, { useState, useContext, useRef } from "react";
import { ChatContext } from "../../context/ChatContext";
import { AuthContext } from "../../context/AuthContext";
import toast from "react-hot-toast";
import assets from "../assets/assets";

const CreateGroupModal = ({ onClose }) => {
  const { conversations, createConversation } = useContext(ChatContext);
  const { authUser, onlineUsers } = useContext(AuthContext);

  const [groupName, setGroupName] = useState("");
  const [groupBio, setGroupBio] = useState("");
  const [groupIcon, setGroupIcon] = useState(null);
  const [previewIcon, setPreviewIcon] = useState(null);
  const [selectedParticipants, setSelectedParticipants] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false); // ✅ NEW: State to handle loading
  const fileInputRef = useRef(null);

  const allUsers = conversations.flatMap((convo) => convo.participants);
  const uniqueUsers = Array.from(
    new Map(allUsers.map((user) => [user._id, user])).values()
  );
  const availableUsers = uniqueUsers.filter(
    (user) => user._id !== authUser._id && user.email !== "groq@bot.com"
  );

  const filteredUsers = availableUsers.filter((user) =>
    user.fullName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleParticipantToggle = (userId) => {
    setSelectedParticipants((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleIconChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      return toast.error("Please select an image file.");
    }
    setGroupIcon(file);
    setPreviewIcon(URL.createObjectURL(file));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!groupName.trim()) {
      return toast.error("Group name is required.");
    }
    if (selectedParticipants.length < 1) {
      return toast.error("Select at least one member for the group.");
    }

    setIsLoading(true); // ✅ FIX: Disable button on submit
    try {
      await createConversation({
        participantIds: selectedParticipants,
        groupName,
        groupBio,
        groupIcon,
      });
      onClose();
    } catch (error) {
      toast.error("Failed to create group. Please try again.");
    } finally {
      setIsLoading(false); // ✅ FIX: Re-enable button after completion
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-gray-800/80 backdrop-blur-xl rounded-xl shadow-lg w-full max-w-md p-6 border border-gray-700 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-semibold text-white mb-4">
          Create New Group
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col items-center">
            <input
              type="file"
              ref={fileInputRef}
              hidden
              accept="image/*"
              onChange={handleIconChange}
            />
            <img
              src={previewIcon || assets.group_icon}
              alt="Group Icon"
              className="w-24 h-24 rounded-full object-cover border-4 border-teal-500 cursor-pointer"
              onClick={() => fileInputRef.current.click()}
            />
            <p className="text-xs text-gray-400 mt-2">Click icon to change</p>
          </div>

          <input
            type="text"
            placeholder="Group Name"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            className="w-full bg-gray-900/90 text-white p-3 rounded-lg border border-gray-600 focus:ring-2 focus:ring-teal-500 outline-none"
          />

          <textarea
            placeholder="Group Bio (Optional)"
            value={groupBio}
            onChange={(e) => setGroupBio(e.target.value)}
            rows={3}
            className="w-full bg-gray-900/90 text-white p-3 rounded-lg border border-gray-600 focus:ring-2 focus:ring-teal-500 outline-none resize-none"
          />

          <input
            type="text"
            placeholder="Search for users to add..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-gray-900/90 text-white p-3 rounded-lg border border-gray-600 focus:ring-2 focus:ring-teal-500 outline-none"
          />

          <div className="max-h-40 overflow-y-auto pr-2">
            {filteredUsers.map((user) => {
              const isOnline = onlineUsers.includes(user._id);
              return (
                <div
                  key={user._id}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-teal-500/20"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <img
                        src={user.profilePic || assets.avatar_icon}
                        alt={user.fullName}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                      {isOnline && (
                        <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-green-400 ring-2 ring-gray-800"></span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium truncate">
                        {user.fullName}
                      </p>
                      <p
                        className={`text-xs ${
                          isOnline ? "text-green-400" : "text-gray-400"
                        }`}
                      >
                        {isOnline ? "online" : "offline"}
                      </p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={selectedParticipants.includes(user._id)}
                    onChange={() => handleParticipantToggle(user._id)}
                    className="form-checkbox h-5 w-5 text-teal-500 bg-gray-800 border-gray-600 rounded focus:ring-teal-500"
                  />
                </div>
              );
            })}
          </div>

          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-gray-300 hover:bg-gray-700 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading} // ✅ FIX: Disable button when loading
              className="px-6 py-2 rounded-lg bg-teal-600 text-white font-semibold hover:bg-teal-700 transition disabled:bg-gray-500 disabled:cursor-not-allowed"
            >
              {isLoading ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateGroupModal;
