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

/**
 * Generates a human-readable date label (e.g., "Today", "Yesterday", "Jul 22, 2024").
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
 * Formats a date into a time string (e.g., "10:30 AM").
 * @param {string | Date} date - The date to format.
 * @returns {string} The formatted time label.
 */
const getTimeLabel = (date) => format(new Date(date), "h:mm a");

/**
 * Groups an array of messages by date, inserting date separator objects.
 * @param {Array<object>} messages - The array of message objects.
 * @returns {Array<object>} A new array with messages and date separators.
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
 * Formats a date into a "last seen" status string.
 * @param {string | Date} date - The last seen date.
 * @returns {string | null} The formatted status or null if no date is provided.
 */
const formatLastSeen = (date) => {
  if (!date) return null;
  const d = new Date(date);
  if (isToday(d)) return `last seen today at ${format(d, "p")}`;
  if (isYesterday(d)) return `last seen yesterday at ${format(d, "p")}`;
  return `last seen ${formatDistanceToNow(d)} ago`;
};

/**
 * The main component for displaying and interacting with a chat conversation.
 */
const ChatContainer = () => {
  // Destructures state and functions from the various contexts.
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

  // State for the message input field.
  const [text, setText] = useState("");
  // State for the image preview before sending.
  const [previewImage, setPreviewImage] = useState(null);
  // State to control the visibility of the emoji picker.
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  // State to control the visibility of the user profile modal.
  const [showProfileModal, setShowProfileModal] = useState(false);
  // State to control the visibility of the group info modal.
  const [showGroupInfoModal, setShowGroupInfoModal] = useState(false);

  // Refs for various DOM elements.
  const scrollEndRef = useRef(null); // For auto-scrolling to the bottom of the chat.
  const inputRef = useRef(null); // For focusing the text input.
  const typingTimeoutRef = useRef(null); // For managing the "stop typing" event.
  const emojiPickerRef = useRef(null); // For detecting clicks outside the emoji picker.

  // Memoized values for performance optimization.
  const isGroup = selectedConversation?.isGroupChat;
  const chatPartner = useMemo(() => {
    if (!selectedConversation || isGroup) return null;
    return selectedConversation.participants.find(
      (participant) => participant._id !== authUser._id
    );
  }, [selectedConversation, isGroup, authUser]);

  const isBot = chatPartner?.email === "groq@bot.com";

  const onlineMembersCount = useMemo(() => {
    if (!isGroup) return 0;
    return selectedConversation.participants.filter((participant) =>
      onlineUsers.includes(participant._id)
    ).length;
  }, [selectedConversation, onlineUsers, isGroup]);

  const chatName = isGroup
    ? selectedConversation?.groupName
    : chatPartner?.fullName;
  const chatIcon = isGroup
    ? selectedConversation?.groupIcon || assets.group_icon
    : chatPartner?.profilePic || assets.avatar_icon;

  // Effect to handle clicks outside the emoji picker to close it.
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

  // Effect to fetch messages when a new conversation is selected.
  useEffect(() => {
    if (selectedConversation) getMessages(selectedConversation._id);
  }, [selectedConversation, getMessages]);

  // Effect to scroll to the bottom of the chat when new messages arrive or typing status changes.
  useEffect(() => {
    if (scrollEndRef.current) {
      scrollEndRef.current.scrollIntoView({ behavior: "auto" });
    }
  }, [messages, isTyping, isBotThinking]);

  // Effect to handle sending "typing" and "stop typing" socket events.
  useEffect(() => {
    if (!socket || !selectedConversation || isBot || !text.trim()) return;

    const typingData = { conversationId: selectedConversation._id };
    socket.emit("typing", typingData);

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("stopTyping", typingData);
    }, 1000);

    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [text, socket, selectedConversation, isBot]);

  // Memoize the grouped messages to prevent re-computation on every render.
  const grouped = useMemo(() => groupMessagesByDate(messages), [messages]);

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
   * It performs an optimistic update to the UI for a faster user experience.
   * @param {React.FormEvent} event - The form submission event.
   */
  const handleSend = async (event) => {
    event?.preventDefault?.();
    if (!text.trim() && !previewImage) return;

    // Clear any pending "stop typing" timeouts.
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (socket && selectedConversation)
      socket.emit("stopTyping", { conversationId: selectedConversation._id });

    const tempId = `temp_${Date.now()}`;
    const payload = {};
    if (text.trim()) payload.text = text.trim();
    if (previewImage) payload.image = previewImage;

    // Create a temporary message object for the optimistic update.
    const optimisticMessage = {
      _id: tempId,
      senderId: authUser,
      text: payload.text || "",
      image: payload.image || null,
      createdAt: new Date().toISOString(),
      isOptimistic: true,
      conversationId: selectedConversation._id,
    };

    setMessages((previousMessages) => [...previousMessages, optimisticMessage]);
    setText("");
    setPreviewImage(null);

    // Send the actual message to the server.
    await sendMessage(payload, tempId);
  };

  /**
   * Handles the Enter key press to send a message, unless Shift is also pressed.
   * @param {React.KeyboardEvent} event - The keydown event.
   */
  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend(event);
    }
  };

  /**
   * Handles the selection of an image file, validates it, and sets the preview.
   * @param {React.ChangeEvent<HTMLInputElement>} event - The file input change event.
   */
  const handleImageChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => setPreviewImage(reader.result);
    reader.readAsDataURL(file);
  };

  const removePreviewImage = () => setPreviewImage(null);

  /**
   * Appends the selected emoji to the text input.
   * @param {object} emojiObject - The emoji data from the picker.
   */
  const handleEmojiClick = (emojiObject) => {
    setText((previousInput) => previousInput + emojiObject.emoji);
    setShowEmojiPicker(false);
  };

  // Render a placeholder if no conversation is selected.
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

  const isOnline = onlineUsers.includes(chatPartner?._id);

  return (
    <>
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
        {/* Chat Header */}
        <div className="sticky top-0 z-10 backdrop-blur-lg bg-slate-900/50 flex items-center gap-4 p-4 border-b border-slate-700 shadow-sm">
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
              {!isGroup && isOnline && (
                <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-slate-800"></span>
              )}
            </div>
            <div className="flex-1 text-slate-100 min-w-0">
              <div className="font-semibold text-lg tracking-wide truncate">
                {chatName}
              </div>
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
          <button
            className="hover:bg-slate-700 p-2 rounded-full transition md:hidden"
            onClick={() => setSelectedConversation(null)}
          >
            <img src={assets.arrow_icon} alt="Back" className="w-6" />
          </button>
        </div>

        {/* Messages Area */}
        <div className="flex-1 px-4 py-6 overflow-y-auto bg-slate-700">
          {grouped.map((item, index) => {
            if (item.type === "date") {
              return (
                <div key={`date-${index}`} className="flex justify-center my-4">
                  <div className="bg-slate-800 text-slate-300 text-xs px-4 py-1 rounded-full shadow">
                    {item.label}
                  </div>
                </div>
              );
            }
            const isMine = item.senderId._id === authUser._id;
            return (
              <div
                key={item._id || index}
                className={`group flex items-end gap-2 mb-2 ${
                  isMine ? "justify-end" : "justify-start"
                }`}
              >
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
                    {!isMine && isGroup && (
                      <span className="text-xs text-indigo-300 ml-2">
                        {item.senderId.fullName}
                      </span>
                    )}
                    <div
                      className={
                        "max-w-sm min-w-0 flex flex-col shadow-sm px-3 py-2 min-h-[42px] " +
                        (isMine
                          ? "bg-indigo-600 text-slate-50 rounded-2xl rounded-br-none"
                          : "bg-slate-600 text-slate-200 rounded-2xl rounded-bl-none")
                      }
                    >
                      {item.image && (
                        <img
                          src={item.image}
                          alt="message"
                          className="max-w-[250px] rounded-lg mb-1 object-cover"
                        />
                      )}
                      {item.text &&
                        (item.senderId.email === "groq@bot.com" ? (
                          <ReactMarkdown components={{ code: CodeBlock }}>
                            {item.text}
                          </ReactMarkdown>
                        ) : (
                          <div className="whitespace-pre-line break-words">
                            <Linkify componentDecorator={linkDecorator}>
                              {item.text}
                            </Linkify>
                          </div>
                        ))}
                      {!item.isStreaming && (
                        <span className="text-[10px] opacity-80 mt-1 self-end">
                          {getTimeLabel(item.createdAt || Date.now())}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
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
          <div ref={scrollEndRef} />
        </div>

        {/* Message Input Form */}
        <div className="relative">
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
              <div className="flex items-center bg-slate-800 rounded-2xl shadow">
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
                <input
                  type="file"
                  id="image"
                  accept="image/png, image/jpeg"
                  hidden
                  onChange={handleImageChange}
                />
                <label htmlFor="image" className="cursor-pointer mx-2">
                  <img src={assets.gallery_icon} alt="Attach" className="w-6" />
                </label>
              </div>
            </div>
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
 * A custom component to render links found by Linkify.
 * @param {string} decoratedHref - The URL of the link.
 * @param {string} decoratedText - The text content of the link.
 * @param {string} key - A unique key for the element.
 * @returns {React.ReactElement} An anchor tag.
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
 * A custom component to render code blocks for ReactMarkdown.
 * @param {object} props - Props passed by ReactMarkdown.
 * @returns {React.ReactElement} A syntax-highlighted code block.
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
