import React, { useState, useEffect, useContext } from "react";
import { AuthContext } from "../../context/AuthContext";
import { ChatContext } from "../../context/ChatContext";
import toast from "react-hot-toast";
import assets from "../assets/assets";

/**
 * A modal component for starting a new one-on-one chat with a user.
 * @param {{ onClose: () => void; }} props
 */
const NewChatModal = ({ onClose }) => {
  // Destructures state and functions from the authentication and chat contexts.
  const { axios, onlineUsers } = useContext(AuthContext);
  const { createConversation } = useContext(ChatContext);

  // State to hold the list of all available users.
  const [users, setUsers] = useState([]);
  // State for the search input value.
  const [searchTerm, setSearchTerm] = useState("");
  // State to manage the loading indicator while fetching users.
  const [loading, setLoading] = useState(true);

  // Effect to fetch all users from the server when the modal is opened.
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        const { data } = await axios.get("/api/auth/users");
        if (data.success) {
          setUsers(data.users);
        }
      } catch (error) {
        toast.error("Failed to fetch users.");
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, [axios]);

  /**
   * Handles the selection of a user to start a new chat.
   * @param {string} userId - The unique identifier of the selected user.
   */
  const handleUserSelect = async (userId) => {
    // Calls the context function to create a new one-on-one conversation.
    await createConversation({ participantIds: [userId] });
    onClose(); // Closes the modal after the conversation is initiated.
  };

  // Filters the list of users based on the search term.
  const filteredUsers = users.filter((user) =>
    user.fullName.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
        <h2 className="text-xl font-semibold text-white mb-4">
          Start a New Chat
        </h2>
        <input
          type="text"
          placeholder="Search for a user..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          className="w-full bg-gray-900/90 text-white p-3 rounded-lg mb-4 border border-gray-600 focus:ring-2 focus:ring-teal-500 outline-none"
        />
        {/* Scrollable list of users. */}
        <div className="max-h-80 overflow-y-auto pr-2">
          {loading ? (
            <p className="text-center text-gray-400">Loading users...</p>
          ) : (
            filteredUsers.map((user) => {
              const isOnline = onlineUsers.includes(user._id);
              return (
                <div
                  key={user._id}
                  onClick={() => handleUserSelect(user._id)}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-teal-500/20 cursor-pointer"
                >
                  <div className="relative">
                    <img
                      src={user.profilePic || assets.avatar_icon}
                      alt={user.fullName}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    {/* Online status indicator dot. */}
                    {isOnline && (
                      <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-green-400 ring-2 ring-gray-800"></span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">
                      {user.fullName}
                    </p>
                    {/* Online status text. */}
                    <p
                      className={`text-xs ${
                        isOnline ? "text-green-400" : "text-gray-400"
                      }`}
                    >
                      {isOnline ? "online" : "offline"}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default NewChatModal;
