import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { AuthContext } from "./AuthContext";
import toast from "react-hot-toast";

// 📝 Create a context to hold all chat-related state and functions.
export const ChatContext = createContext();

// 📝 The provider component that will wrap the application to provide chat context.
export const ChatProvider = ({ children }) => {
  // 📌 Holds the list of all conversations for the logged-in user.
  const [conversations, setConversations] = useState([]);
  // 📌 The currently selected conversation object.
  const [selectedConversation, setSelectedConversation] = useState(null);
  // 📌 Stores the messages for the currently selected conversation.
  const [messages, setMessages] = useState([]);
  // 📌 Tracks if another user is typing in the selected conversation.
  const [isTyping, setIsTyping] = useState(false);
  // 📌 Indicates if the AI bot is processing a request to show a thinking indicator.
  const [isBotThinking, setIsBotThinking] = useState(false);

  /**
   * Manages the loading state for the initial fetch of conversations.
   * It's initialized to 'true' so that UI components (like the Sidebar)
   * can show a loading indicator immediately on app start, preventing a
   * flicker or an incorrect "no conversations" message.
   */
  const [isConversationsLoading, setIsConversationsLoading] = useState(true);

  // 📝 Refs for DOM elements and other values that don't trigger re-renders.
  const notificationSound = useRef(new Audio("/notification.mp3"));
  const botRequestStartTime = useRef(null);
  const selectedConversationRef = useRef(selectedConversation);

  const { authUser, socket, axios } = useContext(AuthContext);

  // 📝 Keep the ref updated with the latest selected conversation to avoid stale closures in socket handlers.
  useEffect(() => {
    selectedConversationRef.current = selectedConversation;
  }, [selectedConversation]);

  /**
   * Fetches all conversations for the authenticated user from the server.
   */
  const getConversations = useCallback(async () => {
    if (!axios || !authUser) return;
    setIsConversationsLoading(true); // Loading shuru karo
    try {
      const { data } = await axios.get("/api/conversations");
      if (data.success) {
        setConversations(data.conversations);
      }
    } catch (error) {
      console.error("Error in getConversations:", error.message);
    } finally {
      setIsConversationsLoading(false); // Hamesha loading khatam karo
    }
  }, [axios, authUser]);

  /**
   * Fetches all messages for a specific conversation and marks them as seen.
   */
  const getMessages = useCallback(
    async (conversationId) => {
      if (!axios || !socket) return;
      try {
        setIsBotThinking(false);
        const { data } = await axios.get(`/api/messages/${conversationId}`);
        if (data.success) {
          setMessages(data.messages);
          // 📌 Notify the server that messages in this conversation have been seen.
          socket.emit("markAsSeen", { conversationId });
          // 📌 Reset the unseen messages count for this conversation in the local state.
          setConversations((previousConversations) =>
            previousConversations.map((conversation) =>
              conversation._id === conversationId
                ? { ...conversation, unseenMessagesCount: 0 }
                : conversation
            )
          );
        }
      } catch (error) {
        toast.error(error.message);
      }
    },
    [axios, socket]
  );

  /**
   * Creates a new conversation (one-on-one or group) and sets it as the selected conversation.
   */
  const createConversation = useCallback(
    async ({ participantIds, groupName, groupBio, groupIcon }) => {
      if (!axios) return;
      try {
        const payload = { participantIds, groupName, groupBio };
        // 📌 If a group icon is provided, convert it to a base64 string for upload.
        if (groupIcon) {
          const reader = new FileReader();
          const promise = new Promise((resolve, reject) => {
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
          });
          reader.readAsDataURL(groupIcon);
          payload.groupIcon = await promise;
        }
        const { data } = await axios.post("/api/conversations/create", payload);
        if (data.success) {
          setSelectedConversation({
            ...data.conversation,
            unseenMessagesCount: 0,
          });
          return data.conversation;
        }
      } catch (error) {
        toast.error(
          error.response?.data?.message || "Failed to create conversation."
        );
      }
    },
    [axios]
  );

  /**
   * Updates a group's information with an optimistic UI approach.
   */
  const updateGroupInfo = useCallback(
    async (conversationId, updatedData, previewIcon) => {
      if (!axios) return;

      // 📌 Optimistically update the UI before the API call completes.
      const optimisticUpdate = (conversation) => ({
        ...conversation,
        ...updatedData,
        groupIcon: previewIcon || conversation.groupIcon,
      });

      setConversations((previousConversations) =>
        previousConversations.map((conversation) =>
          conversation._id === conversationId
            ? optimisticUpdate(conversation)
            : conversation
        )
      );
      if (selectedConversation?._id === conversationId) {
        setSelectedConversation(optimisticUpdate);
      }

      try {
        await axios.put(
          `/api/conversations/group/${conversationId}`,
          updatedData
        );
      } catch (error) {
        // 📌 If the API call fails, the state should be reverted (not implemented here, but toast is shown).
        toast.error(
          error.response?.data?.message || "Failed to update group info."
        );
      }
    },
    [axios, selectedConversation]
  );

  /**
   * Sends a message to the selected conversation.
   * Handles optimistic updates and special state for AI bot interactions.
   */
  const sendMessage = async (messageData, tempId) => {
    if (!axios || !selectedConversation) return;
    try {
      // 📌 If the conversation is with the AI bot, activate the "thinking" indicator.
      if (
        selectedConversation.participants.some(
          (participant) => participant.email === "groq@bot.com"
        )
      ) {
        setIsBotThinking(true);
        botRequestStartTime.current = Date.now();
      }
      await axios.post(`/api/messages/send/${selectedConversation._id}`, {
        ...messageData,
        tempId,
      });
    } catch (error) {
      toast.error("Failed to send message.");
      setIsBotThinking(false);
      // 📌 If sending fails, remove the optimistic message from the UI.
      setMessages((previousMessages) =>
        previousMessages.filter((message) => message._id !== tempId)
      );
    }
  };

  /**
   * Adds one or more participants to a group.
   */
  const addParticipant = useCallback(
    async (conversationId, userIdsToAdd) => {
      if (!axios) return;
      const toastId = toast.loading("Adding participant(s)...");
      try {
        const { data } = await axios.put(
          `/api/conversations/group/${conversationId}/add`,
          { userIdsToAdd }
        );
        if (data.success) {
          toast.success("Participant(s) added!", { id: toastId });
        }
      } catch (error) {
        toast.error(
          error.response?.data?.message || "Failed to add participant(s).",
          { id: toastId }
        );
        console.error(error);
      }
    },
    [axios]
  );

  /**
   * Removes a participant from a group.
   */
  const removeParticipant = useCallback(
    async (conversationId, userIdToRemove) => {
      if (!axios) return;
      const toastId = toast.loading("Removing participant...");
      try {
        await axios.put(`/api/conversations/group/${conversationId}/remove`, {
          userIdToRemove,
        });
        toast.success("Participant removed!", { id: toastId });
      } catch (error) {
        toast.error(
          error.response?.data?.message || "Failed to remove participant.",
          { id: toastId }
        );
        console.error(error);
      }
    },
    [axios]
  );

  /**
   * Deletes a group conversation entirely.
   */
  const deleteGroup = useCallback(
    async (conversationId) => {
      if (!axios) return;
      if (selectedConversationRef.current?._id === conversationId) {
        setSelectedConversation(null);
      }
      const toastId = toast.loading("Deleting group...");
      try {
        const { data } = await axios.delete(
          `/api/conversations/group/${conversationId}`
        );
        if (data.success) {
          toast.success("Group deleted successfully!", { id: toastId });
        } else {
          toast.error(data.message || "Failed to delete group.", {
            id: toastId,
          });
        }
      } catch (error) {
        toast.error(
          error.response?.data?.message || "Failed to delete group.",
          { id: toastId }
        );
        console.error(error);
      }
    },
    [axios]
  );

  /**
   * Allows the current user to leave a group conversation.
   */
  const leaveGroup = useCallback(
    async (conversationId) => {
      if (!axios) return;
      if (selectedConversationRef.current?._id === conversationId) {
        setSelectedConversation(null);
      }
      const toastId = toast.loading("Leaving group...");
      try {
        const { data } = await axios.put(
          `/api/conversations/group/${conversationId}/leave`
        );
        if (data.success) {
          toast.success("You have left the group.", { id: toastId });
        } else {
          toast.error(data.message || "Failed to leave group.", {
            id: toastId,
          });
        }
      } catch (error) {
        toast.error(error.response?.data?.message || "Failed to leave group.", {
          id: toastId,
        });
        console.error(error);
      }
    },
    [axios]
  );

  // 📝 Fetches initial conversations when the component mounts and the user is authenticated.
  useEffect(() => {
    if (socket && authUser) {
      getConversations();
    }
  }, [socket, authUser, getConversations]);

  // 📝 Resets all chat state when the user logs out.
  useEffect(() => {
    if (!authUser) {
      setConversations([]);
      setSelectedConversation(null);
      setMessages([]);
      setIsTyping(false);
      setIsBotThinking(false);
    }
  }, [authUser]);

  // 📝 This effect sets up all the real-time Socket.IO event listeners.
  useEffect(() => {
    if (!socket || !authUser) return;

    // 📌 Handles incoming new messages.
    const handleNewMessage = (newMessage) => {
      // 📌 When any new message arrives from the bot, hide the "is thinking..." indicator.
      if (newMessage.senderId.email === "groq@bot.com") {
        setIsBotThinking(false);
      }
      const isMyOwnMessage = newMessage.senderId._id === authUser._id;
      const currentConversationId = selectedConversationRef.current?._id;

      // 📌 Update the conversation list with the new last message and unread count.
      setConversations((previousConversations) => {
        let conversationToNotify = null;

        const updatedConversations = previousConversations.map(
          (conversation) => {
            if (conversation._id === newMessage.conversationId) {
              const isChatOpen =
                currentConversationId === newMessage.conversationId;
              const newUnseenCount =
                !isChatOpen && !isMyOwnMessage
                  ? (conversation.unseenMessagesCount || 0) + 1
                  : conversation.unseenMessagesCount;

              // 📌 If the message is not from the current user and the chat is not open, prepare a notification.
              if (!isMyOwnMessage && !isChatOpen) {
                notificationSound.current.play().catch(console.error);
                conversationToNotify = {
                  ...conversation,
                  unseenMessagesCount: newUnseenCount,
                };
              }

              return {
                ...conversation,
                lastMessage: {
                  text: newMessage.text || "Image",
                  sender: newMessage.senderId,
                },
                unseenMessagesCount: newUnseenCount,
                updatedAt: newMessage.createdAt,
              };
            }
            return conversation;
          }
        );

        // 📌 Logic to display stacked toast notifications for new messages.
        if (conversationToNotify) {
          const senderName = newMessage.senderId?.fullName || "Someone";
          const unseenCount = conversationToNotify.unseenMessagesCount;
          const toastId = conversationToNotify._id;
          let toastMessage = "";

          if (unseenCount > 1) {
            toastMessage = conversationToNotify.isGroupChat
              ? `${unseenCount} new messages in ${conversationToNotify.groupName}`
              : `${unseenCount} new messages from ${senderName}`;
          } else {
            toastMessage = conversationToNotify.isGroupChat
              ? `New message in ${conversationToNotify.groupName} from ${senderName}`
              : `New message from ${senderName}!`;
          }
          toast.success(toastMessage, { id: toastId });
        }

        // 📌 Re-sort conversations to bring the most recently active one to the top.
        return updatedConversations.sort(
          (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
        );
      });

      // 📌 Update the messages list if the new message belongs to the currently open conversation.
      if (currentConversationId === newMessage.conversationId) {
        if (isMyOwnMessage && newMessage.tempId) {
          // 📌 Replace the temporary message with the final one from the server.
          setMessages((previousMessages) =>
            previousMessages.map((message) =>
              message._id === newMessage.tempId ? newMessage : message
            )
          );
        } else if (!isMyOwnMessage) {
          // 📌 Add the new incoming message to the state and mark it as seen.
          setMessages((previousMessages) => [...previousMessages, newMessage]);
          socket.emit("markAsSeen", {
            conversationId: newMessage.conversationId,
          });
        }
      }
    };

    // 📌 Handles being added to a new conversation.
    const handleNewConversation = (newConversation) => {
      setConversations((previousConversations) => {
        if (previousConversations.find((c) => c._id === newConversation._id))
          return previousConversations;
        socket.emit("joinGroupRoom", {
          conversationId: newConversation._id,
        });
        return [newConversation, ...previousConversations].sort(
          (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
        );
      });
    };

    // 📌 Handles real-time updates to group information.
    const handleGroupUpdate = (updatedConversation) => {
      setConversations((previousConversations) =>
        previousConversations.map((conversation) =>
          conversation._id === updatedConversation._id
            ? updatedConversation
            : conversation
        )
      );
      if (selectedConversationRef.current?._id === updatedConversation._id) {
        setSelectedConversation(updatedConversation);
      }
    };

    // 📌 Handles being removed from a group or when a group is deleted.
    const handleConversationRemoved = (removedConversationId) => {
      toast("A group was removed or you have left.", { icon: "info" });
      setConversations((previousConversations) =>
        previousConversations.filter((c) => c._id !== removedConversationId)
      );
      if (selectedConversationRef.current?._id === removedConversationId) {
        setSelectedConversation(null);
      }
    };

    // 📌 Shows the typing indicator.
    const handleTyping = ({ conversationId }) => {
      if (selectedConversationRef.current?._id === conversationId) {
        setIsTyping(true);
      }
    };

    // 📌 Hides the typing indicator.
    const handleStopTyping = ({ conversationId }) => {
      if (selectedConversationRef.current?._id === conversationId) {
        setIsTyping(false);
      }
    };

    // 📌 Handles the start of a streamed response from the AI bot.
    const handleBotResponseStart = (starterMessage) => {
      if (
        selectedConversationRef.current?._id === starterMessage.conversationId
      ) {
        const elapsedTime = Date.now() - botRequestStartTime.current;
        const delay = Math.max(0, 500 - elapsedTime);
        setTimeout(() => {
          setIsBotThinking(false);
          setMessages((previousMessages) => [
            ...previousMessages,
            { ...starterMessage, isStreaming: true },
          ]);
        }, delay);
      }
    };

    // 📌 Appends incoming chunks to the streaming AI bot message.
    const handleBotResponseStream = ({ _id, chunk, conversationId }) => {
      if (selectedConversationRef.current?._id === conversationId) {
        setMessages((previousMessages) =>
          previousMessages.map((message) =>
            message._id.toString() === _id.toString()
              ? { ...message, text: message.text + chunk }
              : message
          )
        );
      }
    };

    // 📌 Finalizes the AI bot message once the stream has ended.
    const handleBotResponseEnd = ({ message, conversationId }) => {
      if (selectedConversationRef.current?._id === conversationId) {
        setMessages((previousMessages) =>
          previousMessages.map((msg) =>
            msg._id.toString() === message._id.toString() ? message : msg
          )
        );
      }
    };

    // 📌 Register all event listeners.
    socket.on("newMessage", handleNewMessage);
    socket.on("newConversation", handleNewConversation);
    socket.on("groupUpdate", handleGroupUpdate);
    socket.on("conversationRemoved", handleConversationRemoved);
    socket.on("typing", handleTyping);
    socket.on("stopTyping", handleStopTyping);
    socket.on("botResponseStart", handleBotResponseStart);
    socket.on("botResponseStream", handleBotResponseStream);
    socket.on("botResponseEnd", handleBotResponseEnd);

    // 📌 Cleanup function to remove listeners when the component unmounts.
    return () => {
      socket.off("newMessage", handleNewMessage);
      socket.off("newConversation", handleNewConversation);
      socket.off("groupUpdate", handleGroupUpdate);
      socket.off("conversationRemoved", handleConversationRemoved);
      socket.off("typing", handleTyping);
      socket.off("stopTyping", handleStopTyping);
      socket.off("botResponseStart", handleBotResponseStart);
      socket.off("botResponseStream", handleBotResponseStream);
      socket.off("botResponseEnd", handleBotResponseEnd);
    };
  }, [socket, authUser, getConversations]);

  // 📝 The value provided to all consuming components.
  const value = {
    messages,
    setMessages,
    conversations,
    setConversations,
    selectedConversation,
    setSelectedConversation,
    isTyping,
    setIsTyping,
    isBotThinking,
    isConversationsLoading,
    sendMessage,
    getMessages,
    createConversation,
    updateGroupInfo,
    addParticipant,
    removeParticipant,
    deleteGroup,
    leaveGroup,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};
