import React, { useContext, useState, useEffect, useRef } from "react";
import assets from "../assets/assets";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import { ChatContext } from "../../context/ChatContext";
import CreateGroupModal from "./CreateGroupModal";
import NewChatModal from "./NewChatModal";
import UserProfileModal from "./UserProfileModal";

const Sidebar = () => {
  const {
    conversations,
    selectedConversation,
    setSelectedConversation,
    isConversationsLoading,
  } = useContext(ChatContext);
  const { authUser, logout, onlineUsers } = useContext(AuthContext);
  const [input, setInput] = useState("");
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [viewingUser, setViewingUser] = useState(null);
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMenuOpen]);

  const getChatPartner = (participants) => {
    return participants.find((p) => p._id !== authUser._id);
  };

  const groqConversation = conversations.find(
    (convo) =>
      !convo.isGroupChat &&
      getChatPartner(convo.participants)?.email === "groq@bot.com"
  );

  const otherConversations = conversations.filter(
    (convo) => convo._id !== groqConversation?._id
  );

  const filteredConversations = otherConversations.filter((convo) => {
    if (convo.isGroupChat) {
      return convo.groupName.toLowerCase().includes(input.toLowerCase());
    }
    const partner = getChatPartner(convo.participants);
    return (
      partner && partner.fullName.toLowerCase().includes(input.toLowerCase())
    );
  });

  // ✅ RESTORED: The ConversationItem component is now fully included.
  const ConversationItem = ({ conversation, isPinned = false }) => {
    const isGroup = conversation.isGroupChat;
    const partner = isGroup ? null : getChatPartner(conversation.participants);

    const name = isGroup ? conversation.groupName : partner?.fullName;
    const profilePic = isGroup
      ? conversation.groupIcon || assets.group_icon
      : partner?.profilePic || assets.avatar_icon;
    const isOnline = !isGroup && onlineUsers?.includes(partner?._id);
    const isGroqBot = !isGroup && partner?.email === "groq@bot.com";

    const handleSelect = () => {
      setSelectedConversation(conversation);
    };

    const handleViewProfile = (event) => {
      event.stopPropagation();
      setViewingUser(partner);
    };

    return (
      <div
        onClick={handleSelect}
        className={`relative flex items-center gap-3 py-3 px-4 rounded-lg cursor-pointer transition-all duration-200 ${
          selectedConversation?._id === conversation._id
            ? "bg-teal-500/20 ring-1 ring-teal-400"
            : "hover:bg-gray-700/60"
        } ${isPinned ? "border-b border-gray-700 mb-2 pb-4" : ""}`}
      >
        <div className="relative">
          <img
            src={profilePic}
            alt="Avatar"
            className={`w-[50px] aspect-square rounded-full object-cover ${
              !isGroup ? "cursor-pointer" : ""
            }`}
            onClick={!isGroup ? handleViewProfile : undefined}
          />
          {isOnline && !isGroqBot && (
            <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-green-400 ring-2 ring-gray-800"></span>
          )}
        </div>
        <div className="flex-1 flex flex-col leading-5 min-w-0">
          <p className="font-medium truncate">{name}</p>
          <span
            className={`text-xs truncate ${
              isGroqBot
                ? "text-teal-300"
                : isOnline
                ? "text-green-400"
                : "text-gray-400"
            }`}
          >
            {isGroup
              ? conversation.lastMessage?.text
                ? `${
                    conversation.lastMessage.sender?._id === authUser._id
                      ? "You: "
                      : ""
                  }${conversation.lastMessage.text}`
                : "Group Chat"
              : isGroqBot
              ? "AI Assistant"
              : isOnline
              ? "online"
              : "offline"}
          </span>
        </div>
        {conversation.unseenMessagesCount > 0 && (
          <div className="bg-teal-500 text-white text-[11px] font-bold min-w-[20px] h-5 flex items-center justify-center rounded-full px-1.5">
            {conversation.unseenMessagesCount}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {isGroupModalOpen && (
        <CreateGroupModal onClose={() => setIsGroupModalOpen(false)} />
      )}
      {isNewChatModalOpen && (
        <NewChatModal onClose={() => setIsNewChatModalOpen(false)} />
      )}
      {viewingUser && (
        <UserProfileModal
          user={viewingUser}
          onClose={() => setViewingUser(null)}
        />
      )}

      <div
        className={`bg-black/20 h-full p-5 rounded-r-xl overflow-y-scroll text-white transition-all duration-300 ${
          selectedConversation ? "max-md:hidden" : ""
        }`}
      >
        {/* ✅ RESTORED: The header and search bar JSX is now fully included. */}
        <div className="pb-5">
          <div className="flex justify-between items-center">
            <img src={assets.logo} alt="logo" className="max-w-40" />
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsNewChatModalOpen(true)}
                title="Start New Chat"
                className="p-2 rounded-full hover:bg-gray-700/80 transition"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M21.731 2.269a2.625 2.625 0 0 0-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 0 0 0-3.712ZM19.513 8.199l-3.712-3.712-8.4 8.4a5.25 5.25 0 0 0-1.32 2.214l-.8 2.685a.75.75 0 0 0 .933.933l2.685-.8a5.25 5.25 0 0 0 2.214-1.32l8.4-8.4Z" />
                  <path d="M5.25 5.25a3 3 0 0 0-3 3v10.5a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3V13.5a.75.75 0 0 0-1.5 0v5.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5V8.25a1.5 1.5 0 0 1 1.5-1.5h5.25a.75.75 0 0 0 0-1.5H5.25Z" />
                </svg>
              </button>
              <button
                onClick={() => setIsGroupModalOpen(true)}
                title="Create New Group"
                className="p-2 rounded-full hover:bg-gray-700/80 transition"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
                </svg>
              </button>
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className="p-2 rounded-full hover:bg-gray-700/80 transition"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10.5 6a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm0 6a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm0 6a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
                <div
                  className={`absolute top-full right-0 z-10 w-32 p-4 rounded-md bg-gray-800 border border-gray-700 text-gray-100 transition-all duration-300 ease-in-out ${
                    isMenuOpen
                      ? "opacity-100 translate-y-0 pointer-events-auto"
                      : "opacity-0 -translate-y-2 pointer-events-none"
                  }`}
                >
                  <p
                    onClick={() => {
                      navigate("/profile");
                      setIsMenuOpen(false);
                    }}
                    className="cursor-pointer text-sm hover:text-teal-400 transition-colors"
                  >
                    Edit Profile
                  </p>
                  <hr className="my-2 border-t border-gray-600" />
                  <p
                    onClick={() => {
                      logout();
                      setIsMenuOpen(false);
                    }}
                    className="cursor-pointer text-sm hover:text-red-400 transition-colors"
                  >
                    Logout
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-gray-800/80 rounded-full flex items-center gap-2 py-3 px-4 mt-5 hover:ring-2 hover:ring-teal-500 transition-all duration-300">
            <img src={assets.search_icon} alt="Search" className="w-3" />
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              type="text"
              className="bg-transparent border-none outline-none text-white text-xs placeholder-gray-400 flex-1"
              placeholder="Search conversations..."
            />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          {groqConversation && (
            <ConversationItem conversation={groqConversation} isPinned={true} />
          )}

          {/* This logic now correctly shows a loading state before displaying conversations. */}
          {isConversationsLoading ? (
            <p className="text-center text-gray-400 text-sm mt-4">
              Loading conversations...
            </p>
          ) : filteredConversations.length > 0 ? (
            filteredConversations.map((convo) => (
              <ConversationItem key={convo._id} conversation={convo} />
            ))
          ) : (
            <p className="text-center text-gray-400 text-sm mt-4">
              No other conversations. Start a new chat!
            </p>
          )}
        </div>
      </div>
    </>
  );
};

export default Sidebar;
