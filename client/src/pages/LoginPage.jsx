import React, { useState, useContext } from "react";
import assets from "../assets/assets";
import { AuthContext } from "../../context/AuthContext";
import toast from "react-hot-toast";

/**
 * A page component for user authentication.
 * It handles both user sign-up and login, and includes an AI-powered bio generator.
 */
const LoginPage = () => {
  // State to toggle between "sign up" and "login" forms.
  const [currState, setCurrState] = useState("sign up");
  // State for the user's full name (used in sign-up).
  const [fullName, setFullName] = useState("");
  // State for the user's email address.
  const [email, setEmail] = useState("");
  // State for the user's password.
  const [password, setPassword] = useState("");
  // State for the user's bio (used in sign-up).
  const [bio, setBio] = useState("");
  // State to manage the loading indicator for the AI bio generation.
  const [isGenerating, setIsGenerating] = useState(false);

  // Destructures the login function and axios instance from the AuthContext.
  const { login, axios } = useContext(AuthContext);

  /**
   * Handles the form submission for both login and sign-up.
   * @param {React.FormEvent} event - The form submission event.
   */
  const onSubmitHandler = (event) => {
    event.preventDefault();
    const action = currState === "sign up" ? "signup" : "login";
    login(action, { fullName, email, password, bio });
  };

  /**
   * Sends a request to the backend to generate a user bio based on keywords.
   */
  const handleGenerateBio = async () => {
    if (!bio.trim()) {
      return toast.error(
        "Please enter some keywords in the bio field to generate from."
      );
    }
    setIsGenerating(true);
    try {
      const { data } = await axios.post("/api/ai/generate-bio", {
        keywords: bio,
      });
      if (data.success) {
        setBio(data.bio);
        toast.success("Bio generated successfully!");
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to generate bio.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center sm:justify-evenly gap-10 px-4 py-6 bg-gradient-to-br from-[#0f172a] to-[#1e293b]">
      <img
        src={assets.logo_big}
        alt="Logo"
        className="w-[min(30vw,250px)] drop-shadow-md hidden sm:block animate-fade-in"
      />

      <form
        onSubmit={onSubmitHandler}
        className="w-full sm:max-w-md border border-gray-700 p-8 rounded-2xl bg-white/10 text-white backdrop-blur-md shadow-2xl animate-fade-in transition-all duration-300"
      >
        <h2 className="text-3xl font-semibold flex justify-between items-center mb-6">
          {currState === "sign up" ? "Create Account" : "Login"}
        </h2>

        {/* Full Name input is only shown during sign-up. */}
        {currState === "sign up" && (
          <div className="mb-4">
            <label className="block text-sm text-gray-300 mb-1">
              Full Name
            </label>
            <input
              type="text"
              className="w-full p-3 rounded-md bg-[#1e293b] text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="John Doe"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>
        )}

        <div className="mb-4">
          <label className="block text-sm text-gray-300 mb-1">
            Email Address
          </label>
          <input
            type="email"
            className="w-full p-3 rounded-md bg-[#1e293b] text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm text-gray-300 mb-1">Password</label>
          <input
            type="password"
            className="w-full p-3 rounded-md bg-[#1e293b] text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {/* Bio input is only shown during sign-up. */}
        {currState === "sign up" && (
          <div className="mb-4">
            <label className="block text-sm text-gray-300 mb-1">Bio</label>
            <div className="relative">
              <textarea
                rows={4}
                className="w-full p-3 rounded-md bg-[#1e293b] text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none pr-32"
                placeholder="Write some keywords (e.g., 'Developer and cat lover') and let AI write your bio..."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                required
              ></textarea>
              <button
                type="button"
                onClick={handleGenerateBio}
                disabled={isGenerating}
                className="absolute bottom-3 right-3 px-3 py-1.5 bg-purple-600 text-xs font-semibold rounded-md hover:bg-purple-700 transition duration-300 disabled:bg-purple-800"
              >
                {isGenerating ? "Generating..." : "Generate with AI"}
              </button>
            </div>
          </div>
        )}

        <button
          type="submit"
          className="w-full py-3 mt-2 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-md text-white font-semibold hover:opacity-90 transition duration-300"
        >
          {currState === "sign up" ? "Create Account" : "Login"}
        </button>

        {/* Terms and conditions checkbox. */}
        <label className="flex items-center gap-2 mt-4 text-sm text-gray-400">
          <input type="checkbox" required />
          <span>I agree to the terms and privacy policy</span>
        </label>

        {/* Link to switch between login and sign-up forms. */}
        <p className="mt-6 text-sm text-gray-400 text-center">
          {currState === "sign up" ? (
            <>
              Already have an account?{" "}
              <span
                className="text-violet-400 cursor-pointer hover:underline"
                onClick={() => {
                  setCurrState("login");
                }}
              >
                Login here
              </span>
            </>
          ) : (
            <>
              Don’t have an account?{" "}
              <span
                className="text-violet-400 cursor-pointer hover:underline"
                onClick={() => {
                  setCurrState("sign up");
                }}
              >
                Sign up
              </span>
            </>
          )}
        </p>
      </form>
    </div>
  );
};

export default LoginPage;
