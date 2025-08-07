import React, { useContext, useEffect, useState, useRef } from "react";
import { WebRTCContext } from "../../context/WebRTCContext";
import { AuthContext } from "../../context/AuthContext";
import assets from "../assets/assets";

/**
 * Renders the user interface for video and audio calls.
 * This component handles all visual aspects of the call, including incoming,
 * outgoing, and connected states.
 */
const CallContainer = () => {
  // Destructures state and functions from the WebRTC and authentication contexts.
  const {
    callStatus,
    callData,
    localStream,
    remoteStream,
    answerCall,
    rejectCall,
    endCall,
    isMuted,
    toggleMute,
    isCameraOff,
    toggleCamera,
  } = useContext(WebRTCContext);
  const { onlineUsers } = useContext(AuthContext);

  // State to track the duration of a connected call.
  const [callDuration, setCallDuration] = useState(0);
  // State to control the visibility of the call controls overlay in video calls.
  const [showOverlay, setShowOverlay] = useState(true);
  // Reference to the timeout that hides the overlay.
  const overlayTimeoutRef = useRef(null);

  // References to the video and audio elements.
  const remoteVideoRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);

  // State and refs for handling the draggable picture-in-picture (PiP) window.
  const [isDragging, setIsDragging] = useState(false);
  const [pipPosition, setPipPosition] = useState({ x: 20, y: 20 });
  const dragStartOffset = useRef({ x: 0, y: 0 });

  // Effect to attach the remote media stream to the appropriate element.
  // This runs on every render to ensure the stream is correctly attached, especially after re-renders.
  useEffect(() => {
    // Determine the correct media element based on whether it's a video or audio call.
    const mediaElement = callData?.isVideo
      ? remoteVideoRef.current
      : remoteAudioRef.current;

    if (mediaElement && remoteStream) {
      // Only re-assign the stream if it's not already the source object to prevent unnecessary restarts.
      if (mediaElement.srcObject !== remoteStream) {
        mediaElement.srcObject = remoteStream;
        // Attempt to play the media automatically.
        mediaElement.play().catch((error) => {
          console.error("Media play failed:", error);
        });
      }
    }
  });

  // Effect to attach the local media stream to the local video element when a call is connected.
  useEffect(() => {
    if (callStatus === "connected" && localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, callStatus]);

  // Effect to manage the call duration timer.
  useEffect(() => {
    let timer;
    if (callStatus === "connected") {
      // Start a timer that increments the call duration every second.
      timer = setInterval(() => {
        setCallDuration((previousDuration) => previousDuration + 1);
      }, 1000);
    }
    // Cleanup function to clear the interval and reset duration when the call status changes.
    return () => {
      clearInterval(timer);
      setCallDuration(0);
    };
  }, [callStatus]);

  // Effect to automatically hide the video call overlay after a few seconds.
  useEffect(() => {
    if (callStatus === "connected" && callData?.isVideo && showOverlay) {
      // Clear any existing timeout.
      if (overlayTimeoutRef.current) {
        clearTimeout(overlayTimeoutRef.current);
      }
      // Set a new timeout to hide the overlay.
      overlayTimeoutRef.current = setTimeout(() => {
        setShowOverlay(false);
      }, 3500);
    }
    // Cleanup function to clear the timeout if the component unmounts or dependencies change.
    return () => clearTimeout(overlayTimeoutRef.current);
  }, [callStatus, callData?.isVideo, showOverlay]);

  /**
   * Formats a duration in seconds into a "MM:SS" string.
   * @param {number} seconds - The total duration in seconds.
   * @returns {string} The formatted duration string.
   */
  const formatDuration = (seconds) => {
    const minutes = Math.floor((seconds % 3600) / 60)
      .toString()
      .padStart(2, "0");
    const secs = (seconds % 60).toString().padStart(2, "0");
    return `${minutes}:${secs}`;
  };

  // Determines the correct user info object from the call data.
  const remoteUserInfo = callData?.to || callData?.callerInfo;

  // Reusable UI components for the call screen.
  const CallScreenUI = ({ children }) => (
    <div className="fixed inset-0 bg-slate-900 z-50 flex flex-col items-center justify-between p-8 transition-opacity duration-300">
      {children}
    </div>
  );
  const UserInfo = ({ name, status }) => (
    <div className="flex flex-col items-center text-white text-center mt-12">
      <img
        src={remoteUserInfo?.profilePic || assets.avatar_icon}
        alt="user"
        className="w-32 h-32 rounded-full object-cover border-4 border-white/20 shadow-2xl mb-6"
      />
      <h1 className="text-4xl font-bold tracking-wider">{name}</h1>
      <p className="text-lg text-gray-300 mt-2 animate-pulse">{status}</p>
    </div>
  );
  const CallControls = ({ children }) => (
    <div className="flex items-center justify-center gap-6 mb-8">
      {children}
    </div>
  );
  const ControlButton = ({
    onClick,
    icon,
    alt,
    colorClass = "bg-white/10 hover:bg-white/20",
    disabled = false,
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`p-4 rounded-full transition-all duration-200 text-white shadow-lg disabled:opacity-50 ${colorClass}`}
    >
      <img src={icon} alt={alt} className="w-7 h-7" />
    </button>
  );

  // Do not render anything if there is no active call.
  if (callStatus === "idle") return null;

  // Renders the full-screen video call interface.
  if (callStatus === "connected" && callData.isVideo) {
    return (
      <div
        className="fixed inset-0 bg-black z-50 select-none"
        onMouseMove={() => setShowOverlay(true)}
        onClick={() => setShowOverlay(true)}
      >
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />
        <video
          ref={localVideoRef}
          autoPlay
          muted
          playsInline
          style={{
            bottom: `${pipPosition.y}px`,
            right: `${pipPosition.x}px`,
            cursor: isDragging ? "grabbing" : "grab",
          }}
          className="absolute w-40 md:w-48 rounded-lg shadow-2xl border-2 border-white/30 bg-black/50"
        />
        <div
          className={`absolute inset-0 flex flex-col justify-between p-4 md:p-6 transition-opacity duration-300 ${
            showOverlay ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          <div className="flex items-center gap-4 text-white backdrop-blur-md bg-black/20 p-3 rounded-xl self-start">
            <img
              src={remoteUserInfo?.profilePic || assets.avatar_icon}
              alt="user"
              className="w-10 h-10 rounded-full object-cover"
            />
            <div>
              <h2 className="font-bold text-lg">{remoteUserInfo?.fullName}</h2>
              <p className="text-sm text-gray-200">
                {formatDuration(callDuration)}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-center gap-4 md:gap-6">
            <ControlButton
              onClick={toggleMute}
              icon={isMuted ? assets.mic_off_icon : assets.mic_icon}
              alt="Mute"
              colorClass={isMuted ? "bg-red-500" : "bg-black/40"}
            />
            <ControlButton
              onClick={endCall}
              icon={assets.phone_icon}
              alt="End Call"
              colorClass="bg-red-600 hover:bg-red-700 rotate-[135deg]"
            />
            <ControlButton
              onClick={toggleCamera}
              icon={isCameraOff ? assets.video_off_icon : assets.video_icon}
              alt="Camera"
              colorClass={isCameraOff ? "bg-red-500" : "bg-black/40"}
            />
          </div>
        </div>
      </div>
    );
  }

  // Renders the UI for audio calls and pre-call states (outgoing, incoming).
  return (
    <CallScreenUI>
      <audio ref={remoteAudioRef} autoPlay playsInline hidden />
      {callStatus === "outgoing" && (
        <UserInfo
          name={remoteUserInfo?.fullName}
          status={
            onlineUsers.includes(remoteUserInfo?._id)
              ? "Ringing..."
              : "Calling..."
          }
        />
      )}
      {callStatus === "incoming" && (
        <UserInfo name={remoteUserInfo?.fullName} status="Incoming Call..." />
      )}
      {callStatus === "connected" && (
        <UserInfo
          name={remoteUserInfo?.fullName}
          status={formatDuration(callDuration)}
        />
      )}
      <CallControls>
        {callStatus === "connected" && (
          <ControlButton
            onClick={toggleMute}
            icon={isMuted ? assets.mic_off_icon : assets.mic_icon}
            alt="Mute"
            colorClass={isMuted ? "bg-red-500" : "bg-white/10"}
          />
        )}
        {callStatus !== "incoming" && (
          <ControlButton
            onClick={endCall}
            icon={assets.phone_icon}
            alt="End Call"
            colorClass="bg-red-600 hover:bg-red-700 rotate-[135deg]"
          />
        )}
        {callStatus === "incoming" && (
          <>
            <ControlButton
              onClick={rejectCall}
              icon={assets.phone_icon}
              alt="Reject Call"
              colorClass="bg-red-600 hover:bg-red-700 rotate-[135deg]"
            />
            <ControlButton
              onClick={answerCall}
              icon={assets.phone_icon}
              alt="Accept Call"
              colorClass="bg-green-500 hover:bg-green-600"
            />
          </>
        )}
      </CallControls>
    </CallScreenUI>
  );
};

export default CallContainer;
