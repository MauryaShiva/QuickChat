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

// 🛡️ UPDATED: A more robust ICE configuration for better reliability.
// The `turns:` entry is excellent for bypassing restrictive firewalls.
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
  const { socket, authUser } = useContext(AuthContext);
  const { selectedConversation } = useContext(ChatContext);

  const [callStatus, setCallStatus] = useState("idle");
  const [callData, setCallData] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);

  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const outgoingSound = useRef(new Audio(ringingOutgoingSound));
  const incomingSound = useRef(new Audio(ringingIncomingSound));
  const callTimeoutRef = useRef(null);
  const callStateRef = useRef();

  useEffect(() => {
    callStateRef.current = { callStatus, callData };
  }, [callStatus, callData]);

  useEffect(() => {
    outgoingSound.current.loop = true;
    incomingSound.current.loop = true;
  }, []);

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
      outgoingSound.current.pause();
      outgoingSound.current.currentTime = 0;
      incomingSound.current.pause();
      incomingSound.current.currentTime = 0;
    }
  }, [callStatus]);

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

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
      const offer = await peerConnectionRef.current.createOffer({
        iceRestart: true,
      });
      await peerConnectionRef.current.setLocalDescription(offer);
      const remoteUserId =
        callStateRef.current.callData?.to?._id ||
        callStateRef.current.callData?.from;
      if (remoteUserId && socket) {
        socket.emit("renegotiate-call", { to: remoteUserId, offer });
      }
    } catch (error) {
      console.error("ICE Restart failed:", error);
      cleanupCall();
    }
  }, [socket, cleanupCall]);

  const createPeerConnection = useCallback(
    (remoteUserId) => {
      const peerConnection = new RTCPeerConnection(ICE_SERVERS);

      peerConnection.onicecandidate = (event) => {
        if (event.candidate && socket) {
          socket.emit("ice-candidate", {
            to: remoteUserId,
            candidate: event.candidate,
          });
        }
      };

      peerConnection.ontrack = (event) => {
        setRemoteStream(event.streams[0]);
      };

      // ✨ UPDATED: Using the more reliable `onconnectionstatechange` for monitoring.
      peerConnection.onconnectionstatechange = () => {
        const state = peerConnectionRef.current?.connectionState;
        if (state === "disconnected") {
          toast.error("Connection lost. Attempting to reconnect...");
          reconnectCall();
        }
        if (state === "failed" || state === "closed") {
          cleanupCall();
        }
      };

      return peerConnection;
    },
    [socket, cleanupCall, reconnectCall]
  );

  const callUser = useCallback(
    async (userIdToCall, isVideoCall) => {
      if (!userIdToCall || !socket || !selectedConversation) return;
      const userToCall = selectedConversation.participants.find(
        (p) => p._id === userIdToCall
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

  const rejectCall = useCallback(() => {
    if (callData?.from && socket) {
      socket.emit("reject-call", { to: callData.from });
    }
    cleanupCall();
  }, [callData, socket, cleanupCall]);

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
      // ✅ CORRECTED: Wrap offer in RTCSessionDescription for best practice.
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

  const endCall = useCallback(() => {
    const remoteUserId = callData?.to?._id || callData?.from;
    if (remoteUserId && socket) {
      socket.emit("end-call", { to: remoteUserId });
    }
    cleanupCall();
  }, [callData, socket, cleanupCall]);

  const toggleMute = useCallback(() => {
    if (!localStreamRef.current) return;
    localStreamRef.current
      .getAudioTracks()
      .forEach((track) => (track.enabled = !track.enabled));
    setIsMuted((previous) => !previous);
  }, []);

  const toggleCamera = useCallback(() => {
    if (!localStreamRef.current) return;
    localStreamRef.current
      .getVideoTracks()
      .forEach((track) => (track.enabled = !track.enabled));
    setIsCameraOff((previous) => !previous);
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleCallMade = (data) => {
      setCallData({ ...data });
      setCallStatus("incoming");
    };

    // ✅ CORRECTED: This function is now correctly defined and structured.
    const handleAnswerMade = async (data) => {
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }
      if (peerConnectionRef.current) {
        // Wrap answer in RTCSessionDescription for best practice.
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
      if (
        (callStatus === "outgoing" && callData?.to?._id === userId) ||
        (callStatus === "incoming" && callData?.from === userId) ||
        (callStatus === "connected" &&
          (callData?.to?._id === userId || callData?.from === userId))
      ) {
        toast.error("The other user disconnected.");
        cleanupCall();
      }
    };

    // ✨ NEW: Handlers for the ICE Restart (renegotiation) process.
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

    socket.on("call-made", handleCallMade);
    socket.on("answer-made", handleAnswerMade);
    socket.on("ice-candidate-received", handleIceCandidateReceived);
    socket.on("call-rejected", cleanupCall);
    socket.on("call-ended", cleanupCall);
    socket.on("call-missed", handleMissedCall);
    socket.on("user-disconnected", handleUserDisconnected);
    socket.on("renegotiate-call", handleRenegotiateCall);
    socket.on("renegotiate-answer", handleRenegotiateAnswer);

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
