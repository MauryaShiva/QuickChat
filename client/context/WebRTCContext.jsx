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
import ringingOutgoingSound from "/ringing_outgoing.mp3";
import ringingIncomingSound from "/ringing_incoming.mp3";

export const WebRTCContext = createContext();

// A robust ICE configuration for better reliability, including TURN servers
// to bypass restrictive firewalls.
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

export const WebRTCProvider = ({ children }) => {
  const { socket } = useContext(AuthContext);
  const { selectedConversation } = useContext(ChatContext);

  // State Management
  const [callStatus, setCallStatus] = useState("idle"); // idle, outgoing, incoming, connected
  const [callData, setCallData] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);

  // Refs for stability
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const callTimeoutRef = useRef(null);
  const callStateRef = useRef(); // Ref to hold current state to avoid stale closures

  // Audio refs
  const outgoingSound = useRef(new Audio(ringingOutgoingSound));
  const incomingSound = useRef(new Audio(ringingIncomingSound));

  // Keep a ref to the latest state for use in callbacks
  useEffect(() => {
    callStateRef.current = { callStatus, callData, localStream };
  }, [callStatus, callData, localStream]);

  // Setup looping for ringing sounds
  useEffect(() => {
    outgoingSound.current.loop = true;
    incomingSound.current.loop = true;
  }, []);

  // Effect to manage ringing sounds based on call status
  useEffect(() => {
    const playSound = (sound) => {
      sound.currentTime = 0;
      sound.play().catch((err) => console.error("Error playing sound:", err));
    };
    const stopSound = (sound) => {
      sound.pause();
      sound.currentTime = 0;
    };

    if (callStatus === "outgoing") {
      stopSound(incomingSound.current);
      playSound(outgoingSound.current);
    } else if (callStatus === "incoming") {
      stopSound(outgoingSound.current);
      playSound(incomingSound.current);
    } else {
      // For "idle", "connected", etc., stop all sounds
      stopSound(outgoingSound.current);
      stopSound(incomingSound.current);
    }
  }, [callStatus]);

  // Keep localStreamRef updated
  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  /**
   * The single source of truth for cleaning up a call.
   * This function is now robust and ensures all states, streams, and connections are reset.
   */
  const cleanupCall = useCallback(() => {
    console.log("Cleaning up call state...");
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.onicecandidate = null;
      peerConnectionRef.current.ontrack = null;
      peerConnectionRef.current.onconnectionstatechange = null;
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    setLocalStream(null);
    setRemoteStream(null);
    setCallStatus("idle");
    setCallData(null);
    setIsMuted(false);
    setIsCameraOff(false);
  }, []);

  // Function to get user's media stream
  const getMedia = useCallback(
    async (constraints) => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        setLocalStream(stream);
        setIsCameraOff(!constraints.video);
        return stream;
      } catch (error) {
        toast.error("Could not access camera/microphone.");
        cleanupCall(); // Cleanup if media access fails
        return null;
      }
    },
    [cleanupCall]
  );

  /**
   * Creates and configures the RTCPeerConnection object.
   * This is the core of the WebRTC communication.
   */
  const createPeerConnection = useCallback(
    (remoteUserId) => {
      const pc = new RTCPeerConnection(ICE_SERVERS);

      pc.onicecandidate = (event) => {
        if (event.candidate && socket) {
          socket.emit("ice-candidate", {
            to: remoteUserId,
            candidate: event.candidate,
          });
        }
      };

      pc.ontrack = (event) => {
        // When the remote user's stream is received, update the state.
        setRemoteStream(event.streams[0]);
      };

      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        console.log("Connection state change:", state);
        // If connection fails or closes, perform a full cleanup.
        if (
          state === "failed" ||
          state === "closed" ||
          state === "disconnected"
        ) {
          toast.error("Call disconnected.");
          cleanupCall();
        }
      };

      return pc;
    },
    [socket, cleanupCall]
  );

  // Function to initiate a call to another user
  const callUser = useCallback(
    async (userIdToCall, isVideoCall) => {
      if (!socket || !selectedConversation) return;

      const userToCall = selectedConversation.participants.find(
        (p) => p._id === userIdToCall
      );
      if (!userToCall) return;

      cleanupCall(); // Start with a clean state
      const stream = await getMedia({ video: isVideoCall, audio: true });
      if (!stream) return;

      const remoteUserId = userToCall._id;
      peerConnectionRef.current = createPeerConnection(remoteUserId);
      stream.getTracks().forEach((track) => {
        peerConnectionRef.current.addTrack(track, stream);
      });

      try {
        const offer = await peerConnectionRef.current.createOffer();
        await peerConnectionRef.current.setLocalDescription(offer);

        setCallData({ to: userToCall, isVideo: isVideoCall });
        setCallStatus("outgoing");

        socket.emit("call-user", {
          to: remoteUserId,
          offer,
          isVideo: isVideoCall,
        });

        // Set a 30-second timeout for the call
        callTimeoutRef.current = setTimeout(() => {
          toast.error(`${userToCall.fullName} did not answer.`);
          endCall(); // Use endCall to notify the other user
        }, 30000);
      } catch (error) {
        console.error("Error creating call offer:", error);
        cleanupCall();
      }
    },
    [socket, selectedConversation, cleanupCall, getMedia, createPeerConnection]
  );

  // Function to answer an incoming call
  const answerCall = useCallback(async () => {
    const {
      from: remoteUserId,
      offer,
      isVideo,
    } = callStateRef.current.callData;
    if (!offer || !socket || !remoteUserId) return;

    // Immediately notify the caller that the call is being answered.
    socket.emit("call-answered", { to: remoteUserId });
    setCallStatus("connected"); // Update local UI instantly

    const stream = await getMedia({ video: isVideo, audio: true });
    if (!stream) {
      rejectCall();
      return;
    }

    peerConnectionRef.current = createPeerConnection(remoteUserId);
    stream
      .getTracks()
      .forEach((track) => peerConnectionRef.current.addTrack(track, stream));

    try {
      await peerConnectionRef.current.setRemoteDescription(
        new RTCSessionDescription(offer)
      );
      const answer = await peerConnectionRef.current.createAnswer();
      await peerConnectionRef.current.setLocalDescription(answer);

      // Send the technical answer to establish the P2P connection
      socket.emit("make-answer", { to: remoteUserId, answer });
    } catch (error) {
      console.error("Error answering call:", error);
      cleanupCall();
    }
  }, [socket, getMedia, createPeerConnection, cleanupCall]);

  /**
   * Ends the call and notifies the other user.
   * This is used for hanging up, timeouts, or rejections.
   */
  const endCall = useCallback(() => {
    const { callData } = callStateRef.current;
    if (callData) {
      // Determine the remote user's ID whether we are the caller or receiver
      const remoteUserId = callData.to?._id || callData.from;
      if (remoteUserId && socket) {
        socket.emit("end-call", { to: remoteUserId });
      }
    }
    cleanupCall();
  }, [socket, cleanupCall]);

  const rejectCall = useCallback(() => {
    const { from: remoteUserId } = callStateRef.current.callData;
    if (remoteUserId && socket) {
      socket.emit("reject-call", { to: remoteUserId });
    }
    cleanupCall();
  }, [socket, cleanupCall]);

  // Function to toggle microphone mute status
  const toggleMute = useCallback(() => {
    if (!localStreamRef.current) return;
    const enabled = !isMuted;
    localStreamRef.current.getAudioTracks().forEach((track) => {
      track.enabled = enabled;
    });
    setIsMuted(!enabled);
  }, [isMuted]);

  // Function to toggle camera on/off status
  const toggleCamera = useCallback(() => {
    if (!localStreamRef.current) return;
    const enabled = !isCameraOff;
    localStreamRef.current.getVideoTracks().forEach((track) => {
      track.enabled = enabled;
    });
    setIsCameraOff(!enabled);
  }, [isCameraOff]);

  // Main useEffect for handling all socket events
  useEffect(() => {
    if (!socket) return;

    const handleCallMade = (data) => {
      // Only accept a call if we are idle
      if (callStateRef.current.callStatus === "idle") {
        setCallData(data);
        setCallStatus("incoming");
      } else {
        // If busy, automatically reject the new call
        socket.emit("reject-call", { to: data.from });
      }
    };

    const handleCallAccepted = () => {
      // The receiver has answered, clear the timeout and update UI
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }
      setCallStatus("connected");
    };

    const handleAnswerMade = async (data) => {
      if (
        peerConnectionRef.current &&
        peerConnectionRef.current.signalingState !== "closed"
      ) {
        try {
          await peerConnectionRef.current.setRemoteDescription(
            new RTCSessionDescription(data.answer)
          );
        } catch (error) {
          console.error("Error setting remote description:", error);
        }
      }
    };

    const handleIceCandidateReceived = (data) => {
      if (peerConnectionRef.current && data.candidate) {
        try {
          peerConnectionRef.current.addIceCandidate(
            new RTCIceCandidate(data.candidate)
          );
        } catch (error) {
          console.error("Error adding ICE candidate:", error);
        }
      }
    };

    const handleUserDisconnected = ({ userId }) => {
      const { callStatus, callData } = callStateRef.current;
      const remoteUserId = callData?.to?._id || callData?.from;
      if (callStatus !== "idle" && remoteUserId === userId) {
        toast.error("The other user disconnected.");
        cleanupCall();
      }
    };

    // All listeners
    socket.on("call-made", handleCallMade);
    socket.on("call-accepted", handleCallAccepted);
    socket.on("answer-made", handleAnswerMade);
    socket.on("ice-candidate-received", handleIceCandidateReceived);
    socket.on("call-rejected", cleanupCall);
    socket.on("call-ended", cleanupCall); // The most important one for fixing ghost ringing
    socket.on("user-disconnected", handleUserDisconnected);

    return () => {
      // Cleanup all listeners
      socket.off("call-made", handleCallMade);
      socket.off("call-accepted", handleCallAccepted);
      socket.off("answer-made", handleAnswerMade);
      socket.off("ice-candidate-received", handleIceCandidateReceived);
      socket.off("call-rejected", cleanupCall);
      socket.off("call-ended", cleanupCall);
      socket.off("user-disconnected", handleUserDisconnected);
    };
  }, [socket, cleanupCall]);

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
