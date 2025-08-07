import { createContext, useState, useEffect } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { io } from "socket.io-client";

// Creates the authentication context to be used by child components.
export const AuthContext = createContext(null);

// Defines the base URL for the backend API, falling back to a local default.
const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
// Sets the base URL for all subsequent Axios requests.
axios.defaults.baseURL = backendUrl;

/**
 * Provides authentication state (user, token) and related functions
 * (login, logout, updateProfile) to its children components.
 * Also manages WebSocket connection for real-time features.
 * @param {{ children: React.ReactNode }} props
 */
export const AuthProvider = ({ children }) => {
  // State for the JWT authentication token.
  const [token, setToken] = useState(localStorage.getItem("token") || null);
  // State for the authenticated user's data.
  const [authUser, setAuthUser] = useState(null);
  // State for tracking currently online users via WebSocket.
  const [onlineUsers, setOnlineUsers] = useState([]);
  // State for the active WebSocket instance.
  const [socket, setSocket] = useState(null);
  // State to manage loading during the initial authentication check.
  const [loading, setLoading] = useState(true);

  // Effect to check for an existing token in localStorage on initial app load.
  useEffect(() => {
    const checkInitialAuth = async () => {
      // Retrieve the token from local storage.
      const storedToken = localStorage.getItem("token");
      if (storedToken) {
        // If a token exists, set it as the default header for all Axios requests.
        axios.defaults.headers.common["token"] = storedToken;
        try {
          // Verify the token with the backend to get fresh user data.
          const { data } = await axios.get("/api/auth/check");
          if (data.success) {
            // If the token is valid, set the authenticated user.
            setAuthUser(data.user);
          } else {
            // If the token is invalid, clear it from storage and state.
            localStorage.removeItem("token");
            setToken(null);
            setAuthUser(null);
          }
        } catch (error) {
          // If the check fails, log the error and clear auth state.
          console.error("Initial auth check failed", error);
          localStorage.removeItem("token");
          setToken(null);
          setAuthUser(null);
        }
      }
      // The initial check is complete, so stop showing the loading indicator.
      setLoading(false);
    };

    checkInitialAuth();
  }, []); // The empty dependency array ensures this runs only once on mount.

  /**
   * Handles both user login and signup operations.
   * @param {'login' | 'signup'} mode - The operation to perform.
   * @param {object} body - The request payload (e.g., email, password).
   * @returns {Promise<boolean>} - True on success, false on failure.
   */
  const login = async (mode, body) => {
    try {
      const url = mode === "signup" ? "/api/auth/signup" : "/api/auth/login";
      const { data } = await axios.post(url, body);

      if (!data.success) {
        toast.error(data.message);
        return false;
      }

      // On success, update the auth state and local storage.
      setAuthUser(data.user);
      setToken(data.token);
      localStorage.setItem("token", data.token);
      axios.defaults.headers.common["token"] = data.token;

      toast.success(data.message);
      return true;
    } catch (error) {
      // Display an error message from the server response or a generic one.
      toast.error(error.response?.data?.message || error.message);
      return false;
    }
  };

  /**
   * Logs out the user by clearing all authentication data.
   * @param {boolean} [showToast=true] - Whether to show a success notification.
   */
  const logout = (showToast = true) => {
    localStorage.removeItem("token");
    setToken(null);
    setAuthUser(null);
    // Remove the token from default Axios headers.
    delete axios.defaults.headers.common["token"];
    if (showToast) toast.success("Logged out successfully");
  };

  /**
   * Updates the authenticated user's profile information.
   * @param {object} body - The updated user data.
   * @returns {Promise<boolean>} - True on success, false on failure.
   */
  const updateProfile = async (body) => {
    try {
      const { data } = await axios.put("/api/auth/update-profile", body);
      if (!data.success) {
        toast.error(data.message);
        return false;
      }
      // Instantly update user info in the state for a responsive UI.
      setAuthUser(data.user);
      toast.success("Profile updated successfully");
      return true;
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
      return false;
    }
  };

  // Effect to manage the WebSocket connection based on authentication status.
  useEffect(() => {
    // Establish a WebSocket connection only if a user is authenticated.
    if (authUser) {
      // Connect to the socket server, passing the user's ID for identification.
      const newSocket = io(backendUrl, {
        query: { userId: authUser._id },
      });

      setSocket(newSocket);

      // Listen for the 'onlineUsers' event to update the list of online users.
      newSocket.on("onlineUsers", (users) => {
        setOnlineUsers(users);
      });

      // Cleanup function: runs when authUser changes or the component unmounts.
      return () => {
        newSocket.close(); // Close the connection to prevent memory leaks.
        setSocket(null);
      };
    } else {
      // If there is no authenticated user, ensure any existing socket is closed.
      if (socket) {
        socket.close();
        setSocket(null);
      }
    }
  }, [authUser]); // This effect re-runs whenever the authenticated user changes.

  // The value object provided to all context consumers.
  const value = {
    axios,
    authUser,
    setAuthUser, // Exposing setAuthUser allows other parts of the app to modify user state if needed.
    onlineUsers,
    socket,
    token,
    loading,
    login,
    logout,
    updateProfile,
  };

  // Display a loading indicator while the initial authentication check is in progress.
  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-900 text-white">
        Loading...
      </div>
    );
  }

  // Render the provider, making the auth context available to all children.
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
