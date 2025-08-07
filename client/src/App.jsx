import React, { useContext } from "react";
import { Route, Routes, Navigate } from "react-router-dom";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import ProfilePage from "./pages/ProfilePage";
import { Toaster } from "react-hot-toast";
import { AuthContext } from "../context/AuthContext";
import { WebRTCContext } from "../context/WebRTCContext";
import CallContainer from "./components/CallContainer";

/**
 * The root component of the application.
 * It sets up the main routing and conditionally renders the call interface.
 */
const App = () => {
  // Destructures state from the authentication and WebRTC contexts.
  const { authUser } = useContext(AuthContext);
  const { callStatus } = useContext(WebRTCContext);

  return (
    <div className="bg-[url('./src/assets/bgImage.svg')] bg-contain">
      {/* The Toaster component is responsible for displaying all toast notifications. */}
      <Toaster />

      {/* The CallContainer is rendered globally whenever a call is active (i.e., status is not 'idle'). */}
      {/* This ensures the call UI persists even when navigating between pages. */}
      {callStatus !== "idle" && <CallContainer />}

      <Routes>
        {/* The home page is protected. It only renders if a user is authenticated. */}
        {/* Otherwise, it redirects the user to the login page. */}
        <Route
          path="/"
          element={authUser ? <HomePage /> : <Navigate to="/login" />}
        />
        {/* The login page is only accessible to unauthenticated users. */}
        {/* If an authenticated user tries to access it, they are redirected to the home page. */}
        <Route
          path="/login"
          element={!authUser ? <LoginPage /> : <Navigate to="/" />}
        />
        {/* The profile page is also a protected route. */}
        <Route
          path="/profile"
          element={authUser ? <ProfilePage /> : <Navigate to="/login" />}
        />
      </Routes>
    </div>
  );
};

export default App;
