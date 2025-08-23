import React, {
  createContext,
  useState,
  useRef,
  useEffect,
  useContext,
  useCallback,
  useMemo,
} from "react";
import toast from "react-hot-toast";
import { AuthContext } from "./AuthContext";
import { ChatContext } from "./ChatContext";

// Creates a new context for WebRTC-related state and functions.
export const WebRTCContext = createContext();

// 🛡️ UPDATED: Added a free TURN server for reliability on difficult networks.
// The `turns:` entry uses TLS over port 443, which is excellent for bypassing firewalls.
const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    {
      urls: ["turn:openrelay.metered.ca:80", "turns:openrelay.metered.ca:443"],
      username: "openrelayproject",
      credential: "openrelayproject",
    },
  ],
};

/**
 * Provides WebRTC functionality for video and audio calls.
 * Manages call state, media streams, and peer connections.
 * @param {{ children: React.ReactNode }} props
 */
export const WebRTCProvider = ({ children }) => {
  // Destructures state and functions from the authentication and chat contexts.
  const { socket, authUser } = useContext(AuthContext);
  const { selectedConversation } = useContext(ChatContext);

  // State for the current status of the call ('idle', 'outgoing', 'incoming', 'connected').
  const [callStatus, setCallStatus] = useState("idle");
  // State to hold data about the current call, like who is being called or who is calling.
  const [callData, setCallData] = useState(null);
  // State for the local user's media stream (video and/or audio).
  const [localStream, setLocalStream] = useState(null);
  // State for the remote user's media stream.
  const [remoteStream, setRemoteStream] = useState(null);
  // State to track if the local user's microphone is muted.
  const [isMuted, setIsMuted] = useState(false);
  // State to track if the local user's camera is turned off.
  const [isCameraOff, setIsCameraOff] = useState(false);

  // Reference to the RTCPeerConnection instance.
  const peerConnectionRef = useRef(null);
  // Reference to the local media stream to access it directly without causing re-renders.
  const localStreamRef = useRef(null);
  // References to the audio elements for call sounds.
  const outgoingSound = useRef(new Audio("/ringing_outgoing.mp3"));
  const incomingSound = useRef(new Audio("/ringing_incoming.mp3"));
  // Reference to the timeout for unanswered calls.
  const callTimeoutRef = useRef(null);
  // Reference to the latest call state to prevent stale state in socket handlers.
  const callStateRef = useRef();

  // Effect to keep the call state reference updated.
  useEffect(() => {
    callStateRef.current = { callStatus, callData };
  }, [callStatus, callData]);

  // Effect to set the loop property on audio elements once on mount.
  useEffect(() => {
    outgoingSound.current.loop = true;
    incomingSound.current.loop = true;
  }, []);

  // Centralized effect to manage playing and stopping call sounds based on call status.
  useEffect(() => {
    if (callStatus === "outgoing") {
      incomingSound.current.pause();
      outgoingSound.current.currentTime = 0;
      outgoingSound.current.play().catch(console.error);
    } else if (callStatus === "incoming") {
      outgoingSound.current.pause();
      incomingSound.current.currentTime = 0;
      incomingSound.current.play().catch(console.error);
    } else {
      // For 'connected', 'idle', or any other status, stop all sounds.
      outgoingSound.current.pause();
      outgoingSound.current.currentTime = 0;
      incomingSound.current.pause();
      incomingSound.current.currentTime = 0;
    }
  }, [callStatus]);

  // Effect to keep the local stream reference updated.
  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  /**
   * Resets all call-related state and cleans up resources.
   * This is used when a call ends, is rejected, or times out.
   */
  const cleanupCall = useCallback(() => {
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    localStreamRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setCallStatus("idle");
    setCallData(null);
    setIsMuted(false);
    setIsCameraOff(false);
  }, []);

  /**
   * Requests access to the user's camera and/or microphone.
   * @param {MediaStreamConstraints} constraints - Specifies whether to request video, audio, or both.
   * @returns {Promise<MediaStream|null>} The user's media stream on success, or null on failure.
   */
  const getMedia = useCallback(async (constraints) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);
      setIsCameraOff(!constraints.video);
      setIsMuted(false);
      return stream;
    } catch (error) {
      toast.error("Could not access camera/microphone.");
      return null;
    }
  }, []);

  // ✨ NEW: Function to handle automatic reconnection on network drops.
  const reconnectCall = useCallback(async () => {
    if (!peerConnectionRef.current) return;

    try {
      // Create a new offer with the iceRestart flag to renegotiate the connection.
      const offer = await peerConnectionRef.current.createOffer({
        iceRestart: true,
      });
      await peerConnectionRef.current.setLocalDescription(offer);

      const remoteUserId =
        callStateRef.current.callData?.to?._id ||
        callStateRef.current.callData?.from;
      if (remoteUserId && socket) {
        // Send the renegotiation offer to the other user.
        socket.emit("renegotiate-call", { to: remoteUserId, offer });
      }
    } catch (error) {
      console.error("ICE Restart failed:", error);
      cleanupCall(); // End the call if reconnection fails.
    }
  }, [socket, cleanupCall]);

  /**
   * Creates and configures a new RTCPeerConnection object.
   * @param {string} remoteUserId - The ID of the user to connect with.
   * @returns {RTCPeerConnection} The configured peer connection instance.
   */
  const createPeerConnection = useCallback(
    (remoteUserId) => {
      const peerConnection = new RTCPeerConnection(ICE_SERVERS);

      // Event handler for when an ICE candidate is generated.
      peerConnection.onicecandidate = (event) => {
        if (event.candidate && socket) {
          socket.emit("ice-candidate", {
            to: remoteUserId,
            candidate: event.candidate,
          });
        }
      };

      // Event handler for when a remote stream is added.
      peerConnection.ontrack = (event) => {
        setRemoteStream(event.streams[0]);
      };

      // ✨ UPDATED: Replaced `oniceconnectionstatechange` with the more modern and reliable `onconnectionstatechange`.
      // This provides a more accurate status of the connection.
      peerConnection.onconnectionstatechange = () => {
        const state = peerConnectionRef.current?.connectionState;
        if (state === "disconnected") {
          toast.error("Connection lost. Attempting to reconnect...");
          reconnectCall(); // Trigger automatic reconnection.
        }
        if (state === "failed" || state === "closed") {
          cleanupCall();
        }
      };

      return peerConnection;
    },
    [socket, cleanupCall, reconnectCall]
  );

  /**
   * Initiates a call to another user.
   * @param {string} userIdToCall - The ID of the user to call.
   * @param {boolean} isVideoCall - True for a video call, false for an audio call.
   */
  const callUser = useCallback(
    async (userIdToCall, isVideoCall) => {
      if (!userIdToCall || !socket || !selectedConversation) return;

      const userToCall = selectedConversation.participants.find(
        (participant) => participant._id === userIdToCall
      );
      if (!userToCall) return;

      cleanupCall();
      const stream = await getMedia({ video: isVideoCall, audio: true });
      if (!stream) return;

      peerConnectionRef.current = createPeerConnection(userIdToCall);
      stream
        .getTracks()
        .forEach((track) => peerConnectionRef.current.addTrack(track, stream));

      try {
        const offer = await peerConnectionRef.current.createOffer();
        await peerConnectionRef.current.setLocalDescription(offer);
        setCallData({ to: userToCall, isVideo: isVideoCall });
        setCallStatus("outgoing");
        socket.emit("call-user", {
          to: userIdToCall,
          offer,
          isVideo: isVideoCall,
        });

        // Set a timeout to end the call if it's not answered within 30 seconds.
        callTimeoutRef.current = setTimeout(() => {
          socket.emit("call-timeout", { to: userIdToCall });
          toast.error(`${userToCall.fullName} did not answer.`);
          cleanupCall();
        }, 30000);
      } catch (error) {
        cleanupCall();
      }
    },
    [selectedConversation, socket, getMedia, createPeerConnection, cleanupCall]
  );

  /**
   * Rejects an incoming call.
   */
  const rejectCall = useCallback(() => {
    if (callData?.from && socket) {
      socket.emit("reject-call", { to: callData.from });
    }
    cleanupCall();
  }, [callData, socket, cleanupCall]);

  /**
   * Answers an incoming call.
   */
  const answerCall = useCallback(async () => {
    if (!callData?.offer || !socket) return;
    const stream = await getMedia({ video: callData.isVideo, audio: true });
    if (!stream) {
      rejectCall();
      return;
    }

    peerConnectionRef.current = createPeerConnection(callData.from);
    stream
      .getTracks()
      .forEach((track) => peerConnectionRef.current.addTrack(track, stream));
    try {
      // ✨ UPDATED: It's best practice to wrap the description in a new RTCSessionDescription object.
      await peerConnectionRef.current.setRemoteDescription(
        new RTCSessionDescription(callData.offer)
      );
      const answer = await peerConnectionRef.current.createAnswer();
      await peerConnectionRef.current.setLocalDescription(answer);
      setCallStatus("connected");
      socket.emit("make-answer", { to: callData.from, answer });
    } catch (error) {
      cleanupCall();
    }
  }, [
    callData,
    socket,
    getMedia,
    createPeerConnection,
    cleanupCall,
    rejectCall,
  ]);

  /**
   * Ends the current call.
   */
  const endCall = useCallback(() => {
    const remoteUserId = callData?.to?._id || callData?.from;
    if (remoteUserId && socket) {
      socket.emit("end-call", { to: remoteUserId });
    }
    cleanupCall();
  }, [callData, socket, cleanupCall]);

  /**
   * Toggles the microphone on and off.
   */
  const toggleMute = useCallback(() => {
    if (!localStreamRef.current) return;
    localStreamRef.current
      .getAudioTracks()
      .forEach((track) => (track.enabled = !track.enabled));
    setIsMuted((previous) => !previous);
  }, []);

  /**
   * Toggles the camera on and off.
   */
  const toggleCamera = useCallback(() => {
    if (!localStreamRef.current) return;
    localStreamRef.current
      .getVideoTracks()
      .forEach((track) => (track.enabled = !track.enabled));
    setIsCameraOff((previous) => !previous);
  }, []);

  // Main effect for handling all real-time WebRTC signaling events via sockets.
  useEffect(() => {
    if (!socket) return;

    const handleCallMade = (data) => {
      setCallData({ ...data });
      setCallStatus("incoming");
    };
    const handleAnswerMade = async (data) => {
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }
      if (peerConnectionRef.current) {
        // ✨ UPDATED: Wrap the answer in a new RTCSessionDescription object for consistency.
        await peerConnectionRef.current.setRemoteDescription(
          new RTCSessionDescription(data.answer)
        );
        setCallStatus("connected");
      }
    };
    const handleIceCandidateReceived = (data) => {
      if (peerConnectionRef.current && data.candidate) {
        peerConnectionRef.current.addIceCandidate(
          new RTCIceCandidate(data.candidate)
        );
      }
    };
    const handleMissedCall = (data) => {
      cleanupCall();
      const callerName = data?.callerName || "Someone";
      toast.error(`Missed call from ${callerName}`);
    };
    const handleUserDisconnected = ({ userId }) => {
      const { callStatus, callData } = callStateRef.current;
      if (callStatus === "outgoing" && callData?.to?._id === userId) {
        toast.error(`Call failed. ${callData.to.fullName} is unavailable.`);
        cleanupCall();
      } else if (callStatus === "incoming" && callData?.from === userId) {
        cleanupCall();
      } else if (callStatus === "connected") {
        const remoteUserId = callData?.to?._id || callData?.from;
        if (remoteUserId === userId) {
          toast.error("Call ended. The other user disconnected.");
          cleanupCall();
        }
      }
    };

    // ✨ NEW: Handlers for the ICE Restart (renegotiation) process.
    // Remember to add corresponding `renegotiate-call` and `renegotiate-answer` events to your backend server!
    const handleRenegotiateCall = async (data) => {
      if (peerConnectionRef.current && data.offer) {
        await peerConnectionRef.current.setRemoteDescription(
          new RTCSessionDescription(data.offer)
        );
        const answer = await peerConnectionRef.current.createAnswer();
        await peerConnectionRef.current.setLocalDescription(answer);
        socket.emit("renegotiate-answer", { to: data.from, answer });
      }
    };
    const handleRenegotiateAnswer = async (data) => {
      if (peerConnectionRef.current && data.answer) {
        await peerConnectionRef.current.setRemoteDescription(
          new RTCSessionDescription(data.answer)
        );
      }
    };

    // Register all socket event listeners.
    socket.on("call-made", handleCallMade);
    socket.on("answer-made", handleAnswerMade);
    socket.on("ice-candidate-received", handleIceCandidateReceived);
    socket.on("call-rejected", cleanupCall);
    socket.on("call-ended", cleanupCall);
    socket.on("call-missed", handleMissedCall);
    socket.on("user-disconnected", handleUserDisconnected);
    socket.on("renegotiate-call", handleRenegotiateCall);
    socket.on("renegotiate-answer", handleRenegotiateAnswer);

    // Cleanup function to remove listeners on unmount.
    return () => {
      socket.off("call-made", handleCallMade);
      socket.off("answer-made", handleAnswerMade);
      socket.off("ice-candidate-received", handleIceCandidateReceived);
      socket.off("call-rejected", cleanupCall);
      socket.off("call-ended", cleanupCall);
      socket.off("call-missed", handleMissedCall);
      socket.off("user-disconnected", handleUserDisconnected);
      socket.off("renegotiate-call", handleRenegotiateCall);
      socket.off("renegotiate-answer", handleRenegotiateAnswer);
    };
  }, [socket, cleanupCall]);

  // Memoize the context value to prevent unnecessary re-renders of consumer components.
  const value = useMemo(
    () => ({
      callStatus,
      callData,
      localStream,
      remoteStream,
      isMuted,
      isCameraOff,
      callUser,
      answerCall,
      rejectCall,
      endCall,
      toggleMute,
      toggleCamera,
    }),
    [
      callStatus,
      callData,
      localStream,
      remoteStream,
      isMuted,
      isCameraOff,
      callUser,
      answerCall,
      rejectCall,
      endCall,
      toggleMute,
      toggleCamera,
    ]
  );

  return (
    <WebRTCContext.Provider value={value}>{children}</WebRTCContext.Provider>
  );
};
