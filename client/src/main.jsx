import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "../context/AuthContext.jsx";
import { ChatProvider } from "../context/ChatContext.jsx";
import { WebRTCProvider } from "../context/WebRTCContext.jsx";

/**
 * This is the main entry point for the React application.
 * It sets up the root of the application and wraps it with necessary context providers.
 */
createRoot(document.getElementById("root")).render(
  // BrowserRouter provides routing capabilities to the entire application.
  <BrowserRouter>
    {/* AuthProvider manages user authentication state (e.g., user data, token). */}
    <AuthProvider>
      {/* ChatProvider manages all chat-related state (e.g., conversations, messages). */}
      <ChatProvider>
        {/* WebRTCProvider manages the state and logic for video and audio calls. */}
        <WebRTCProvider>
          <App />
        </WebRTCProvider>
      </ChatProvider>
    </AuthProvider>
  </BrowserRouter>
);
