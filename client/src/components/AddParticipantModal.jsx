import React, { useState, useEffect, useContext } from "react";
import toast from "react-hot-toast";
import { ChatContext } from "../../context/ChatContext";
import { AuthContext } from "../../context/AuthContext";
import assets from "../assets/assets";

/**
 * A modal component for adding new participants to a group conversation.
 * @param {{
 * isOpen: boolean;
 * onClose: () => void;
 * conversation: object;
 * }} props
 */
const AddParticipantModal = ({ isOpen, onClose, conversation }) => {
  // State to hold the list of all users fetched from the API.
  const [allUsers, setAllUsers] = useState([]);
  // State for the search input value.
  const [searchTerm, setSearchTerm] = useState("");
  // State to hold the IDs of the users selected to be added.
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  // State to manage the loading indicator on the add button.
  const [loading, setLoading] = useState(false);

  // Destructures state and functions from the authentication and chat contexts.
  const { axios, onlineUsers } = useContext(AuthContext);
  const { addParticipant } = useContext(ChatContext);

  // Effect to fetch all users when the modal is opened.
  useEffect(() => {
    if (isOpen) {
      // Reset state each time the modal opens.
      setSelectedUserIds([]);
      setSearchTerm("");

      const fetchUsers = async () => {
        try {
          const { data } = await axios.get("/api/auth/users");
          if (data.success) {
            setAllUsers(data.users);
          }
        } catch (error) {
          toast.error("Failed to fetch users.");
          console.error(error);
        }
      };
      fetchUsers();
    }
  }, [isOpen, axios]);

  /**
   * Handles the selection and deselection of users from the list.
   * @param {string} userId - The unique identifier of the user being toggled.
   */
  const handleUserSelect = (userId) => {
    setSelectedUserIds((previousSelected) => {
      if (previousSelected.includes(userId)) {
        // If the user is already selected, remove them.
        return previousSelected.filter((id) => id !== userId);
      } else {
        // Otherwise, add the user to the selection.
        return [...previousSelected, userId];
      }
    });
  };

  /**
   * Handles the final submission to add the selected participants to the group.
   */
  const handleAddParticipant = async () => {
    if (selectedUserIds.length === 0) {
      toast.error("Please select at least one user to add.");
      return;
    }
    setLoading(true);
    await addParticipant(conversation._id, selectedUserIds);
    setLoading(false);
    onClose(); // Close the modal after the operation is complete.
  };

  // Do not render the component if it's not open.
  if (!isOpen) return null;

  // Create a Set of current participant IDs for efficient lookup.
  const participantIds = new Set(
    conversation.participants.map((participant) => participant._id)
  );

  // Filter the list of all users to show only those who are not already in the group
  // and match the current search term.
  const filteredUsers = allUsers.filter(
    (user) =>
      !participantIds.has(user._id) &&
      user.fullName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center">
      <div className="bg-[#1c1c1c] text-white p-6 rounded-lg shadow-xl w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Add Participants</h2>
        <input
          type="text"
          placeholder="Search for a user..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          className="w-full p-2 rounded bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-teal-500 mb-4"
        />

        <div className="max-h-60 overflow-y-auto mb-4 border border-gray-700 rounded-lg">
          {filteredUsers.length > 0 ? (
            filteredUsers.map((user) => {
              const isOnline = onlineUsers.includes(user._id);
              const isSelected = selectedUserIds.includes(user._id);
              return (
                // The entire row is a label to make the whole area clickable.
                <label
                  key={user._id}
                  htmlFor={`user-checkbox-${user._id}`}
                  className={`flex items-center justify-between p-3 cursor-pointer hover:bg-gray-700 ${
                    isSelected ? "bg-teal-600/50" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <img
                        src={user.profilePic || assets.avatar_icon}
                        alt={user.fullName}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                      <span
                        className={`absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full ring-2 ring-[#1c1c1c] ${
                          isOnline ? "bg-green-500" : "bg-gray-500"
                        }`}
                      ></span>
                    </div>
                    <div className="flex flex-col">
                      <span className="font-medium">{user.fullName}</span>
                      <span
                        className={`text-xs ${
                          isOnline ? "text-green-400" : "text-gray-400"
                        }`}
                      >
                        {isOnline ? "Online" : "Offline"}
                      </span>
                    </div>
                  </div>
                  <input
                    id={`user-checkbox-${user._id}`}
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleUserSelect(user._id)}
                    // The checkbox is visually present but not directly interactive; the label handles the click.
                    className="form-checkbox h-5 w-5 bg-gray-800 border-gray-600 text-teal-600 focus:ring-teal-500 rounded pointer-events-none"
                  />
                </label>
              );
            })
          ) : (
            <p className="p-4 text-center text-gray-400">
              No users found or all users are already in the group.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-4">
          <button
            onClick={onClose}
            className="py-2 px-4 rounded bg-gray-600 hover:bg-gray-500 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleAddParticipant}
            disabled={loading || selectedUserIds.length === 0}
            className="py-2 px-4 rounded bg-teal-600 hover:bg-teal-500 transition disabled:bg-gray-500 disabled:cursor-not-allowed"
          >
            {loading ? "Adding..." : `Add User(s) (${selectedUserIds.length})`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddParticipantModal;
