/**
 * @file ChatContainer.jsx
 * @description This component renders the main chat interface, including the header,
 * message list, and message input form. It handles message sending, typing indicators,
 * and integration with various contexts for state management.
 */

import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { format, isToday, isYesterday, formatDistanceToNow } from "date-fns";
import toast from "react-hot-toast";
import assets from "../assets/assets";
import { ChatContext } from "../../context/ChatContext.jsx";
import { AuthContext } from "../../context/AuthContext.jsx";
import { WebRTCContext } from "../../context/WebRTCContext.jsx";
import EmojiPicker from "emoji-picker-react";
import Linkify from "react-linkify";
import UserProfileModal from "./UserProfileModal";
import GroupInfoModal from "./GroupInfoModal";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import TextareaAutosize from "react-textarea-autosize";

// --- Helper Functions ---

/**
 * Generates a user-friendly date label (e.g., "Today", "Yesterday", "Aug 9, 2025").
 * @param {string | Date} date - The date to format.
 * @returns {string} The formatted date label.
 */
const getDateLabel = (date) => {
  const d = new Date(date);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);
  const sameDay = (a, b) =>
    a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear();
  if (sameDay(d, today)) return "Today";
  if (sameDay(d, yesterday)) return "Yesterday";
  return format(d, "MMM d, yyyy");
};

/**
 * Formats a date into a time string (e.g., "9:30 PM").
 * @param {string | Date} date - The date to format.
 * @returns {string} The formatted time label.
 */
const getTimeLabel = (date) => format(new Date(date), "h:mm a");

/**
 * Groups an array of messages by date, inserting date separator objects.
 * @param {Array<Object>} messages - The array of message objects.
 * @returns {Array<Object>} An array containing messages and date separators.
 */
const groupMessagesByDate = (messages) => {
  if (!messages) return [];
  const output = [];
  let lastLabel = "";
  for (const message of messages) {
    const label = getDateLabel(message.createdAt);
    if (label !== lastLabel) {
      output.push({ type: "date", label, id: `date-${label}` });
      lastLabel = label;
    }
    output.push({ type: "message", ...message });
  }
  return output;
};

/**
 * Formats a user's last seen timestamp into a human-readable string.
 * @param {string | Date} date - The last seen date.
 * @returns {string | null} The formatted string or null if no date is provided.
 */
const formatLastSeen = (date) => {
  if (!date) return null;
  const d = new Date(date);
  if (isToday(d)) return `last seen today at ${format(d, "p")}`;
  if (isYesterday(d)) return `last seen yesterday at ${format(d, "p")}`;
  return `last seen ${formatDistanceToNow(d)} ago`;
};

/**
 * The main component for the chat view.
 */
const ChatContainer = () => {
  // --- Contexts ---
  const {
    messages,
    setMessages,
    selectedConversation,
    setSelectedConversation,
    sendMessage,
    getMessages,
    isTyping,
    isBotThinking,
  } = useContext(ChatContext);
  const { authUser, onlineUsers, socket } = useContext(AuthContext);
  const { callUser } = useContext(WebRTCContext);

  // --- State Management ---
  const [text, setText] = useState(""); // Current text in the input field
  const [previewImage, setPreviewImage] = useState(null); // Base64 preview of image to be sent
  const [showEmojiPicker, setShowEmojiPicker] = useState(false); // Controls emoji picker visibility
  const [showProfileModal, setShowProfileModal] = useState(false); // Controls user profile modal visibility
  const [showGroupInfoModal, setShowGroupInfoModal] = useState(false); // Controls group info modal visibility

  // --- Refs ---
  const scrollEndRef = useRef(null); // Ref to an element at the end of the message list for auto-scrolling
  const inputRef = useRef(null); // Ref to the message input textarea
  const typingTimeoutRef = useRef(null); // Ref to manage the timeout for "stopTyping" event
  const emojiPickerRef = useRef(null); // Ref to the emoji picker container for detecting outside clicks

  // --- Memoized Values ---
  // Determines if the current chat is a group chat.
  const isGroup = selectedConversation?.isGroupChat;

  // Memoizes the chat partner object to prevent recalculation on every render.
  const chatPartner = useMemo(() => {
    if (!selectedConversation || isGroup) return null;
    return selectedConversation.participants.find(
      (participant) => participant._id !== authUser._id
    );
  }, [selectedConversation, isGroup, authUser]);

  // Determines if the chat partner is the AI bot.
  const isBot = chatPartner?.email === "groq@bot.com";

  // Calculates the number of online members in a group chat.
  const onlineMembersCount = useMemo(() => {
    if (!isGroup) return 0;
    return selectedConversation.participants.filter((participant) =>
      onlineUsers.includes(participant._id)
    ).length;
  }, [selectedConversation, onlineUsers, isGroup]);

  // --- Computed Chat Properties ---
  const chatName = isGroup
    ? selectedConversation?.groupName
    : chatPartner?.fullName;
  const chatIcon = isGroup
    ? selectedConversation?.groupIcon || assets.group_icon
    : chatPartner?.profilePic || assets.avatar_icon;

  // --- Effects ---
  // Effect to close the emoji picker when clicking outside of it.
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(event.target)
      ) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [emojiPickerRef]);

  // Effect to fetch messages when the selected conversation changes.
  useEffect(() => {
    if (selectedConversation) getMessages(selectedConversation._id);
  }, [selectedConversation, getMessages]);

  // Effect to automatically scroll to the latest message.
  useEffect(() => {
    if (scrollEndRef.current) {
      scrollEndRef.current.scrollIntoView({ behavior: "auto" });
    }
  }, [messages, isTyping, isBotThinking]);

  /**
   * Effect to manage the "typing" indicator.
   * This adds an input event listener to the textarea to emit "typing" and "stopTyping" socket events.
   * It's optimized to run only when the conversation changes, not on every keystroke, preventing re-renders.
   */
  useEffect(() => {
    if (!socket || !selectedConversation || isBot) return;

    const handleInput = () => {
      const typingData = { conversationId: selectedConversation._id };
      socket.emit("typing", typingData);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit("stopTyping", typingData);
      }, 1000);
    };

    const inputElement = inputRef.current;
    if (inputElement) {
      inputElement.addEventListener("input", handleInput);
    }

    return () => {
      if (inputElement) {
        inputElement.removeEventListener("input", handleInput);
      }
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [socket, selectedConversation, isBot]);

  // Memoizes the grouped messages to avoid re-computation on every render.
  const grouped = useMemo(() => groupMessagesByDate(messages), [messages]);

  // --- Event Handlers ---

  /**
   * Copies the given text to the clipboard and shows a toast notification.
   * @param {string} textToCopy - The text to be copied.
   */
  const handleCopyText = (textToCopy) => {
    navigator.clipboard.writeText(textToCopy).then(
      () => toast.success("Copied to clipboard!"),
      () => toast.error("Failed to copy.")
    );
  };

  /**
   * Handles sending a message (text and/or image).
   * It creates an optimistic message for instant UI update and then calls the API.
   * @param {React.FormEvent<HTMLFormElement>} event - The form submission event.
   */
  const handleSend = async (event) => {
    event?.preventDefault?.(); // Use optional chaining for events not from forms.
    if (!text.trim() && !previewImage) return;

    // Stop the "typing" indicator immediately on send.
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (socket && selectedConversation)
      socket.emit("stopTyping", { conversationId: selectedConversation._id });

    // Create a temporary ID for the optimistic message.
    const tempId = `temp_${Date.now()}`;
    const payload = {};
    if (text.trim()) payload.text = text.trim();
    if (previewImage) payload.image = previewImage;

    // Create an optimistic message to display in the UI instantly.
    const optimisticMessage = {
      _id: tempId,
      senderId: authUser,
      text: payload.text || "",
      image: payload.image || null,
      createdAt: new Date().toISOString(),
      isOptimistic: true, // Flag to identify this message, can be used for styling (e.g., pending icon).
      conversationId: selectedConversation._id,
    };

    setMessages((previousMessages) => [...previousMessages, optimisticMessage]);
    setText("");
    setPreviewImage(null);

    // Send the actual message and update it once the server responds.
    await sendMessage(payload, tempId);
  };

  /**
   * Handles the 'Enter' key press to send a message, unless 'Shift' is also pressed.
   * @param {React.KeyboardEvent<HTMLTextAreaElement>} event - The keydown event.
   */
  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend(event);
    }
  };

  /**
   * Handles image selection from the file input, validates it, and sets the preview.
   * @param {React.ChangeEvent<HTMLInputElement>} event - The change event from the file input.
   */
  const handleImageChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewImage(reader.result);
      inputRef.current.focus();
    };
    reader.readAsDataURL(file);
  };

  /**
   * Removes the selected image preview.
   */
  const removePreviewImage = () => {
    setPreviewImage(null);
    inputRef.current.focus();
  };

  /**
   * Appends the selected emoji to the text input.
   * @param {Object} emojiObject - The object containing emoji data from the picker.
   */
  const handleEmojiClick = (emojiObject) => {
    setText((previousInput) => previousInput + emojiObject.emoji);
    setShowEmojiPicker(false);
    inputRef.current.focus();
  };

  // --- Render Logic ---

  // Render a welcome/placeholder screen if no conversation is selected.
  if (!selectedConversation) {
    return (
      <div className="flex flex-col justify-center items-center h-full gap-4 text-center bg-slate-800">
        <img src={assets.logo_icon} className="max-w-16" alt="Logo" />
        <p className="text-lg font-medium text-slate-300">
          Select a chat to start messaging
        </p>
      </div>
    );
  }

  // Check if the chat partner is currently online.
  const isOnline = onlineUsers.includes(chatPartner?._id);

  return (
    <>
      {/* --- Modals --- */}
      {showProfileModal && chatPartner && (
        <UserProfileModal
          user={chatPartner}
          onClose={() => setShowProfileModal(false)}
        />
      )}
      {showGroupInfoModal && isGroup && (
        <GroupInfoModal onClose={() => setShowGroupInfoModal(false)} />
      )}

      <div className="h-full w-full bg-slate-800 flex flex-col rounded-3xl shadow-2xl overflow-hidden">
        {/* --- Chat Header --- */}
        <div className="flex-shrink-0 sticky top-0 z-10 backdrop-blur-lg bg-slate-900/50 flex items-center gap-4 p-4 border-b border-slate-700 shadow-sm">
          {/* User/Group Info section */}
          <div
            className="flex items-center gap-4 cursor-pointer"
            onClick={() =>
              isGroup ? setShowGroupInfoModal(true) : setShowProfileModal(true)
            }
          >
            <div className="relative">
              <img
                src={chatIcon}
                className="w-10 h-10 rounded-full border-2 border-indigo-500 shadow-md object-cover"
                alt={chatName}
              />
              {/* Online status indicator */}
              {!isGroup && isOnline && (
                <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-slate-800"></span>
              )}
            </div>
            <div className="flex-1 text-slate-100 min-w-0">
              <div className="font-semibold text-lg tracking-wide truncate">
                {chatName}
              </div>
              {/* Sub-header text: online status, typing indicator, or member count */}
              <div className="text-xs text-slate-400 h-4 truncate">
                {isGroup ? (
                  `${onlineMembersCount} of ${selectedConversation.participants.length} members online`
                ) : isTyping ? (
                  <span className="text-emerald-400 animate-pulse">
                    typing...
                  </span>
                ) : isOnline ? (
                  "online"
                ) : isBot ? (
                  <span className="text-indigo-400">AI Assistant</span>
                ) : (
                  chatPartner && formatLastSeen(chatPartner.lastSeen)
                )}
              </div>
            </div>
          </div>
          <div className="flex-grow" />
          {/* Action buttons: Voice and Video Call */}
          <div className="flex items-center gap-2 text-slate-200">
            {!isGroup && !isBot && (
              <>
                <button
                  onClick={() => callUser(chatPartner._id, false)}
                  title="Voice Call"
                  className="hover:bg-slate-700 p-2 rounded-full transition"
                >
                  <img
                    src={assets.phone_icon}
                    alt="Voice Call"
                    className="w-6 h-6"
                  />
                </button>
                <button
                  onClick={() => callUser(chatPartner._id, true)}
                  title="Video Call"
                  className="hover:bg-slate-700 p-2 rounded-full transition"
                >
                  <img
                    src={assets.video_icon}
                    alt="Video Call"
                    className="w-6 h-6"
                  />
                </button>
              </>
            )}
          </div>
          {/* Back button for mobile view */}
          <button
            className="hover:bg-slate-700 p-2 rounded-full transition md:hidden"
            onClick={() => setSelectedConversation(null)}
          >
            <img src={assets.arrow_icon} alt="Back" className="w-6" />
          </button>
        </div>

        {/* --- Message List --- */}
        <div className="flex-1 px-4 py-6 overflow-y-auto bg-slate-700">
          {grouped.map((item, index) => {
            // Render a date separator
            if (item.type === "date") {
              return (
                <div key={`date-${index}`} className="flex justify-center my-4">
                  <div className="bg-slate-800 text-slate-300 text-xs px-4 py-1 rounded-full shadow">
                    {item.label}
                  </div>
                </div>
              );
            }
            // Render a message
            const isMine = item.senderId._id === authUser._id;
            return (
              <div
                key={item._id || index}
                className={`group flex items-end gap-2 mb-2 ${
                  isMine ? "justify-end" : "justify-start"
                }`}
              >
                {/* Copy button for own messages (appears on hover) */}
                {isMine && item.text && !item.isStreaming && (
                  <button
                    onClick={() => handleCopyText(item.text)}
                    className="opacity-0 group-hover:opacity-50 transition-opacity"
                  >
                    <img
                      src={assets.copy_icon}
                      alt="Copy"
                      className="w-4 h-4"
                    />
                  </button>
                )}
                <div
                  className={`flex items-start gap-3 ${
                    isMine ? "justify-end" : "justify-start"
                  }`}
                >
                  {/* Sender's avatar for group/bot messages */}
                  {!isMine && (isGroup || isBot) && (
                    <img
                      src={item.senderId.profilePic || assets.avatar_icon}
                      alt={item.senderId.fullName}
                      className="w-6 h-6 rounded-full self-end mb-1"
                    />
                  )}
                  <div
                    className={`flex flex-col gap-1 ${
                      isMine ? "items-end" : "items-start"
                    }`}
                  >
                    {/* Sender's name in group chats */}
                    {!isMine && isGroup && (
                      <span className="text-xs text-indigo-300 ml-2">
                        {item.senderId.fullName}
                      </span>
                    )}
                    {/* Message bubble */}
                    <div
                      className={
                        "max-w-sm min-w-0 flex flex-col shadow-sm px-3 py-2 min-h-[42px] " +
                        (isMine
                          ? "bg-indigo-600 text-slate-50 rounded-2xl rounded-br-none"
                          : "bg-slate-600 text-slate-200 rounded-2xl rounded-bl-none")
                      }
                    >
                      {/* Image content */}
                      {item.image && (
                        <img
                          src={item.image}
                          alt="message"
                          className="max-w-[250px] rounded-lg mb-1 object-cover"
                        />
                      )}
                      {/* Text content */}
                      {item.text &&
                        (item.senderId.email === "groq@bot.com" ? (
                          // Render Markdown for bot messages
                          <ReactMarkdown components={{ code: CodeBlock }}>
                            {item.text}
                          </ReactMarkdown>
                        ) : (
                          // Render plain text with link detection for user messages
                          <div className="whitespace-pre-line break-words">
                            <Linkify componentDecorator={linkDecorator}>
                              {item.text}
                            </Linkify>
                          </div>
                        ))}
                      {/* Timestamp */}
                      {!item.isStreaming && (
                        <span className="text-[10px] opacity-80 mt-1 self-end">
                          {getTimeLabel(item.createdAt || Date.now())}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {/* Copy button for others' messages (appears on hover) */}
                {!isMine && item.text && !item.isStreaming && (
                  <button
                    onClick={() => handleCopyText(item.text)}
                    className="opacity-0 group-hover:opacity-50 transition-opacity"
                  >
                    <img
                      src={assets.copy_icon}
                      alt="Copy"
                      className="w-4 h-4"
                    />
                  </button>
                )}
              </div>
            );
          })}
          {/* "Typing..." indicator */}
          {isTyping && !isGroup && (
            <div className="flex mb-2 justify-start">
              <div className="flex max-w-[75%] items-end relative">
                <div className="bg-slate-600 text-slate-200 rounded-2xl rounded-bl-none p-3 flex items-center shadow">
                  <span className="dot animate-bounce text-slate-400">.</span>
                  <span className="dot animate-bounce text-slate-400 [animation-delay:0.2s]">
                    .
                  </span>
                  <span className="dot animate-bounce text-slate-400 [animation-delay:0.4s]">
                    .
                  </span>
                </div>
              </div>
            </div>
          )}
          {/* "Bot is thinking..." indicator */}
          {isBotThinking && (
            <div className="group flex items-end gap-2 mb-2 justify-start">
              <div className="flex max-w-[75%] items-end relative gap-2">
                <img
                  src={chatIcon}
                  alt="bot avatar"
                  className="w-6 h-6 rounded-full self-end mb-1"
                />
                <div className="min-w-0 flex flex-col shadow-sm px-3 py-2 min-h-[42px] justify-center bg-slate-600 text-slate-200 rounded-2xl rounded-bl-none">
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-medium text-slate-300">
                      is thinking
                    </span>
                    <span className="dot animate-bounce text-slate-400">.</span>
                    <span className="dot animate-bounce text-slate-400 [animation-delay:0.2s]">
                      .
                    </span>
                    <span className="dot animate-bounce text-slate-400 [animation-delay:0.4s]">
                      .
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
          {/* Anchor for auto-scrolling */}
          <div ref={scrollEndRef} />
        </div>

        {/* --- Message Input Form --- */}
        <div className="relative flex-shrink-0">
          {/* Emoji Picker */}
          <div
            ref={emojiPickerRef}
            className="absolute bottom-full left-4 mb-2 z-20"
          >
            {showEmojiPicker && (
              <div className="bg-slate-900/70 backdrop-blur-lg border border-slate-700 rounded-2xl shadow-lg overflow-hidden">
                <EmojiPicker
                  onEmojiClick={handleEmojiClick}
                  theme="dark"
                  emojiStyle="native"
                  height={400}
                  width={350}
                  lazyLoadEmojis={true}
                />
              </div>
            )}
          </div>
          <form
            onSubmit={handleSend}
            className="bg-slate-900/50 px-4 py-4 flex items-start gap-3 border-t border-slate-700"
          >
            <div className="flex-1 flex flex-col gap-2">
              {/* Image Preview */}
              {previewImage && (
                <div className="flex items-center bg-slate-800 rounded-lg px-3 py-2 mb-2">
                  <img
                    src={previewImage}
                    alt="preview"
                    className="w-14 h-14 object-cover rounded shadow border border-slate-600"
                  />
                  <button
                    type="button"
                    className="text-red-400 hover:bg-red-800/40 rounded px-3 py-1 ml-4 text-xs transition"
                    onClick={removePreviewImage}
                  >
                    Remove
                  </button>
                </div>
              )}
              {/* Main input bar */}
              <div className="flex items-center bg-slate-800 rounded-2xl shadow">
                {/* Emoji button */}
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="p-3 text-slate-400 hover:text-slate-100 transition"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-6 h-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="1.5"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15.182 15.182a4.5 4.5 0 0 1-6.364 0M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM9 9.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm6 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z"
                    />
                  </svg>
                </button>
                {/* Textarea for message input */}
                <TextareaAutosize
                  ref={inputRef}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message..."
                  className="flex-1 bg-transparent text-sm p-3 border-none rounded-2xl outline-none text-slate-100 placeholder-slate-400 resize-none"
                  maxRows={5}
                  autoFocus
                />
                {/* Hidden file input for images */}
                <input
                  type="file"
                  id="image"
                  accept="image/png, image/jpeg"
                  hidden
                  onChange={handleImageChange}
                />
                {/* Image attachment button */}
                <label htmlFor="image" className="cursor-pointer mx-2">
                  <img src={assets.gallery_icon} alt="Attach" className="w-6" />
                </label>
              </div>
            </div>
            {/* Send button */}
            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-700 transition p-3 rounded-full disabled:opacity-40 self-end"
              disabled={(!text.trim() && !previewImage) || isBotThinking}
            >
              <img src={assets.send_button} alt="Send" className="w-6 h-6" />
            </button>
          </form>
        </div>
      </div>
    </>
  );
};

/**
 * A custom component decorator for react-linkify to style links.
 */
const linkDecorator = (decoratedHref, decoratedText, key) => (
  <a
    target="_blank"
    rel="noopener noreferrer"
    href={decoratedHref}
    key={key}
    className="text-sky-400 hover:underline"
  >
    {decoratedText}
  </a>
);

/**
 * A custom component for rendering code blocks in Markdown with syntax highlighting.
 * It handles both inline code and fenced code blocks.
 */
const CodeBlock = ({ node, inline, className, children, ...props }) => {
  const match = /language-(\w+)/.exec(className || "");
  return !inline ? (
    <SyntaxHighlighter
      style={vscDarkPlus}
      language={match ? match[1] : "text"}
      PreTag="div"
      {...props}
    >
      {String(children).replace(/\n$/, "")}
    </SyntaxHighlighter>
  ) : (
    <code
      className="bg-slate-900 text-emerald-300 rounded px-1.5 py-1"
      {...props}
    >
      {children}
    </code>
  );
};

export default ChatContainer;
