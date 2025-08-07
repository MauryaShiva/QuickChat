import React, { useContext, useEffect, useState, useMemo } from "react";
import assets from "../assets/assets";
import { ChatContext } from "../../context/ChatContext";
import { AuthContext } from "../../context/AuthContext";
import AddParticipantModal from "./AddParticipantModal";
import toast from "react-hot-toast";

/**
 * A sidebar component that displays details and actions for the selected conversation.
 * It shows different information for one-on-one chats versus group chats.
 */
const RightSidebar = () => {
  // Destructures state and functions from the chat and authentication contexts.
  const {
    selectedConversation,
    messages,
    removeParticipant,
    deleteGroup,
    leaveGroup,
  } = useContext(ChatContext);
  const { authUser, logout, onlineUsers } = useContext(AuthContext);

  // State to hold a list of image URLs from the current conversation's messages.
  const [msgImages, setMsgImages] = useState([]);
  // State to control the visibility of the "Add Participant" modal.
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Memoized value to get the chat partner in a one-on-one conversation.
  const chatPartner = useMemo(() => {
    if (!selectedConversation || selectedConversation.isGroupChat) return null;
    return selectedConversation.participants.find(
      (participant) => participant._id !== authUser._id
    );
  }, [selectedConversation, authUser]);

  // Memoized value to determine if the current user is the admin of the group.
  const isAdmin = useMemo(() => {
    return (
      selectedConversation?.isGroupChat &&
      selectedConversation.admin?._id === authUser._id
    );
  }, [selectedConversation, authUser]);

  // Effect to filter and update the list of shared images whenever messages change.
  useEffect(() => {
    if (messages && Array.isArray(messages)) {
      setMsgImages(messages.filter((msg) => msg.image).map((msg) => msg.image));
    } else {
      setMsgImages([]);
    }
  }, [messages]);

  /**
   * Handles the removal of a participant from the group.
   * Prompts for confirmation before proceeding.
   * @param {object} participant - The participant object to be removed.
   */
  const handleRemoveParticipant = (participant) => {
    // Note: window.confirm is used for simplicity. In a production app, a custom modal is preferred.
    if (
      window.confirm(
        `Are you sure you want to remove ${participant.fullName} from the group?`
      )
    ) {
      removeParticipant(selectedConversation._id, participant._id);
    }
  };

  /**
   * Handles the permanent deletion of a group.
   * This action is only available to the group admin.
   */
  const handleDeleteGroup = () => {
    if (
      window.confirm(
        `Are you sure you want to permanently delete the group "${selectedConversation.groupName}"? This action cannot be undone.`
      )
    ) {
      deleteGroup(selectedConversation._id);
    }
  };

  /**
   * Handles the current user leaving a group.
   */
  const handleLeaveGroup = () => {
    if (
      window.confirm(
        `Are you sure you want to leave the group "${selectedConversation.groupName}"?`
      )
    ) {
      leaveGroup(selectedConversation._id);
    }
  };

  // Do not render the sidebar if no conversation is selected.
  if (!selectedConversation) return null;

  // Renders the UI for a one-on-one chat.
  if (!selectedConversation.isGroupChat && chatPartner) {
    return (
      <div className="hidden xl:block bg-black/20 text-white w-full relative overflow-y-scroll">
        <div className="p-6 flex flex-col items-center gap-2">
          <img
            src={chatPartner?.profilePic || assets.avatar_icon}
            alt="Profile"
            className="w-20 aspect-square rounded-full object-cover"
          />
          <h1 className="text-xl font-medium flex items-center gap-2">
            {onlineUsers.includes(chatPartner._id) && (
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
            )}
            {chatPartner.fullName}
          </h1>
          <p className="text-center text-sm text-gray-300 px-4">
            {chatPartner.bio || "No bio."}
          </p>
        </div>
        <hr className="border-gray-700 my-4 mx-6" />
        <div className="p-5 text-xs">
          <p className="mb-2 font-medium">Media ({msgImages.length})</p>
          <div className="max-h-48 overflow-y-auto grid grid-cols-2 gap-2 opacity-80 pr-2">
            {msgImages.length > 0 ? (
              msgImages.map((url, index) => (
                <div
                  key={index}
                  onClick={() => window.open(url)}
                  className="cursor-pointer rounded aspect-square"
                >
                  <img
                    src={url}
                    alt="Shared media"
                    className="h-full w-full object-cover rounded-md"
                  />
                </div>
              ))
            ) : (
              <p className="col-span-2 text-center text-gray-400">
                No media shared yet.
              </p>
            )}
          </div>
        </div>
        <button
          onClick={logout}
          className="absolute bottom-5 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-red-500 to-red-600 text-white border-none text-sm font-semibold py-2 px-8 rounded-full cursor-pointer hover:opacity-90 transition"
        >
          Logout
        </button>
      </div>
    );
  }

  // Renders the UI for a group chat.
  if (selectedConversation.isGroupChat) {
    return (
      <>
        <div className="hidden xl:flex flex-col bg-black/20 text-white w-full relative overflow-y-scroll p-6">
          <div className="flex-grow">
            {/* Group Information Section */}
            <div className="flex flex-col items-center gap-2">
              <img
                src={selectedConversation.groupIcon || assets.group_icon}
                alt="Group Icon"
                className="w-20 aspect-square rounded-full object-cover"
              />
              <h1 className="text-xl font-medium">
                {selectedConversation.groupName}
              </h1>
              <p className="text-center text-sm text-gray-300 px-4">
                {selectedConversation.groupBio || "No group bio."}
              </p>
            </div>
            <hr className="border-gray-700 my-4" />

            {/* Participants List Section */}
            <div className="text-xs">
              <div className="flex justify-between items-center mb-2">
                <p className="font-medium">
                  Participants ({selectedConversation.participants.length})
                </p>
                {isAdmin && (
                  <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="text-teal-400 hover:text-teal-300 text-sm font-bold"
                  >
                    + Add
                  </button>
                )}
              </div>
              <div className="max-h-40 overflow-y-auto pr-2 space-y-1">
                {selectedConversation.participants.map((participant) => {
                  const isOnline = onlineUsers.includes(participant._id);
                  return (
                    <div
                      key={participant._id}
                      className="flex items-center justify-between gap-3 p-1 rounded-md hover:bg-white/5"
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <img
                            src={participant.profilePic || assets.avatar_icon}
                            alt={participant.fullName}
                            className="w-9 h-9 rounded-full object-cover"
                          />
                          {isOnline && (
                            <span className="absolute bottom-0 right-0 block h-2 w-2 rounded-full bg-green-500 ring-1 ring-gray-800"></span>
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-sm text-gray-200">
                            {participant.fullName}
                          </p>
                          <span
                            className={`text-xs ${
                              selectedConversation.admin?._id ===
                              participant._id
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
                      {/* Admin can remove any participant except themselves. */}
                      {isAdmin && participant._id !== authUser._id && (
                        <button
                          onClick={() => handleRemoveParticipant(participant)}
                          className="text-red-500 hover:text-red-400 opacity-60 hover:opacity-100 p-1"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            fill="currentColor"
                            viewBox="0 0 16 16"
                          >
                            <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16" />
                            <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708" />
                          </svg>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <hr className="border-gray-700 my-4" />

            {/* Shared Media Section */}
            <div className="text-xs">
              <p className="mb-2 font-medium">Media ({msgImages.length})</p>
              <div className="max-h-48 overflow-y-auto grid grid-cols-2 gap-2 opacity-80 pr-2">
                {msgImages.length > 0 ? (
                  msgImages.map((url, index) => (
                    <div
                      key={index}
                      onClick={() => window.open(url)}
                      className="cursor-pointer rounded aspect-square"
                    >
                      <img
                        src={url}
                        alt="Shared media"
                        className="h-full w-full object-cover rounded-md"
                      />
                    </div>
                  ))
                ) : (
                  <p className="col-span-2 text-center text-gray-400">
                    No media shared yet.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons Section */}
          <div className="mt-6 space-y-4">
            {/* The "Leave Group" button is visible to all members. */}
            <button
              onClick={handleLeaveGroup}
              className="w-full bg-yellow-800/80 hover:bg-yellow-700/90 text-white border-none text-sm font-semibold py-2 px-4 rounded-full cursor-pointer transition-colors"
            >
              Leave Group
            </button>

            {/* The "Delete Group" button is only visible to the admin. */}
            {isAdmin && (
              <button
                onClick={handleDeleteGroup}
                className="w-full bg-red-800/80 hover:bg-red-700/90 text-white border-none text-sm font-semibold py-2 px-4 rounded-full cursor-pointer transition-colors"
              >
                Delete Group
              </button>
            )}

            <button
              onClick={logout}
              className="w-full bg-gradient-to-r from-red-500 to-red-600 text-white border-none text-sm font-semibold py-2 px-8 rounded-full cursor-pointer hover:opacity-90 transition"
            >
              Logout
            </button>
          </div>
        </div>

        {/* The modal for adding new participants to the group. */}
        <AddParticipantModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          conversation={selectedConversation}
          onlineUsers={onlineUsers}
        />
      </>
    );
  }

  return null; // Return null if the conversation is not a group or one-on-one chat.
};

export default RightSidebar;
