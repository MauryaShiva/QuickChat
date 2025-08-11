import React, { useState, useContext, useRef } from "react";
import assets from "../assets/assets";
import { AuthContext } from "../../context/AuthContext";
import toast from "react-hot-toast";

const LoginPage = () => {
  // State to manage whether the form is for "sign up" or "login".
  const [currentState, setCurrentState] = useState("sign up");
  // State to hold the user's full name input.
  const [fullName, setFullName] = useState("");
  // State to hold the user's email input.
  const [email, setEmail] = useState("");
  // State to hold the user's password input.
  const [password, setPassword] = useState("");
  // State to hold the user's bio input.
  const [bio, setBio] = useState("");
  // State to track if the AI bio generation is in progress.
  const [isGenerating, setIsGenerating] = useState(false);
  // State to track if the form submission is in progress.
  const [isSubmitting, setIsSubmitting] = useState(false);
  // State to control the visibility of the loading overlay.
  const [showLoader, setShowLoader] = useState(false);
  // A ref to hold the timeout ID for the loader, allowing it to be cleared.
  const loaderTimeoutRef = useRef(null);

  // Accessing the login function and axios instance from the authentication context.
  const { login, axios } = useContext(AuthContext);

  /**
   * Handles the form submission for both login and signup.
   * @param {React.FormEvent<HTMLFormElement>} event - The form submission event.
   */
  const onSubmitHandler = async (event) => {
    event.preventDefault(); // Prevents the default form submission behavior.
    setIsSubmitting(true);

    // Shows the loader only if the network request takes longer than 300ms.
    loaderTimeoutRef.current = setTimeout(() => {
      setShowLoader(true);
    }, 300);

    // Determine the API endpoint based on the current form state.
    const action = currentState === "sign up" ? "signup" : "login";
    // Call the login function from context with user data.
    await login(action, { fullName, email, password, bio });

    // Cleans up after the request is complete.
    clearTimeout(loaderTimeoutRef.current); // Prevents the loader from showing if the request was fast.
    setIsSubmitting(false);
    setShowLoader(false);
  };

  /**
   * Handles the AI-powered bio generation.
   */
  const handleGenerateBio = async () => {
    // Validates that the bio field is not empty before making an API call.
    if (!bio.trim()) {
      return toast.error(
        "Please enter some keywords in the bio field to generate from."
      );
    }
    setIsGenerating(true);
    try {
      // Makes a POST request to the server to generate a bio.
      const { data } = await axios.post("/api/ai/generate-bio", {
        keywords: bio,
      });
      // Updates the bio state and shows a success message if the request is successful.
      if (data.success) {
        setBio(data.bio);
        toast.success("Bio generated successfully!");
      } else {
        // Shows an error message from the server if the request fails.
        toast.error(data.message);
      }
    } catch (error) {
      // Handles network or server errors.
      toast.error(error.response?.data?.message || "Failed to generate bio.");
    } finally {
      // Ensures the generating state is reset regardless of the outcome.
      setIsGenerating(false);
    }
  };

  return (
    <>
      {/* A loading overlay that appears during slow network requests. */}
      {showLoader && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm">
          <div className="text-white text-lg font-semibold">Loading...</div>
        </div>
      )}

      {/* Main container for the login page. */}
      <div className="min-h-screen w-full flex items-center justify-center sm:justify-evenly gap-10 px-4 py-6 bg-gradient-to-br from-[#0f172a] to-[#1e293b]">
        {/* Application Logo - hidden on small screens. */}
        <img
          src={assets.logo_big}
          alt="Logo"
          className="w-[min(30vw,250px)] drop-shadow-md hidden sm:block animate-fade-in"
        />

        {/* The main login/signup form. */}
        <form
          onSubmit={onSubmitHandler}
          className="w-full sm:max-w-md border border-gray-700 p-8 rounded-2xl bg-white/10 text-white backdrop-blur-md shadow-2xl animate-fade-in transition-all duration-300"
        >
          {/* Form Title: Changes between "Create Account" and "Login". */}
          <h2 className="text-3xl font-semibold flex justify-between items-center mb-6">
            {currentState === "sign up" ? "Create Account" : "Login"}
          </h2>

          {/* Full Name input field - only shown during "sign up". */}
          {currentState === "sign up" && (
            <div className="mb-4">
              <label className="block text-sm text-gray-300 mb-1">
                Full Name
              </label>
              <input
                type="text"
                className="w-full p-3 rounded-md bg-[#1e293b] text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="John Doe"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                required
              />
            </div>
          )}

          {/* Email Address input field. */}
          <div className="mb-4">
            <label className="block text-sm text-gray-300 mb-1">
              Email Address
            </label>
            <input
              type="email"
              className="w-full p-3 rounded-md bg-[#1e293b] text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          {/* Password input field. */}
          <div className="mb-4">
            <label className="block text-sm text-gray-300 mb-1">Password</label>
            <input
              type="password"
              className="w-full p-3 rounded-md bg-[#1e293b] text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>

          {/* Bio textarea with AI generation - only shown during "sign up". */}
          {currentState === "sign up" && (
            <div className="mb-4">
              <label className="block text-sm text-gray-300 mb-1">Bio</label>
              <div className="relative">
                <textarea
                  rows={4}
                  className="w-full p-3 rounded-md bg-[#1e293b] text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none pr-32"
                  placeholder="Write some keywords (e.g., 'Developer and cat lover') and let AI write your bio..."
                  value={bio}
                  onChange={(event) => setBio(event.target.value)}
                  required
                ></textarea>
                <button
                  type="button" // Prevents form submission.
                  onClick={handleGenerateBio}
                  disabled={isGenerating} // Disables button while generating.
                  className="absolute bottom-3 right-3 px-3 py-1.5 bg-purple-600 text-xs font-semibold rounded-md hover:bg-purple-700 transition duration-300 disabled:bg-purple-800"
                >
                  {isGenerating ? "Generating..." : "Generate with AI"}
                </button>
              </div>
            </div>
          )}

          {/* Main submit button. */}
          <button
            type="submit"
            disabled={isSubmitting} // Disables the button during form submission.
            className="w-full py-3 mt-2 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-md text-white font-semibold hover:opacity-90 transition duration-300 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {/* Dynamically changes button text based on submission and form state. */}
            {isSubmitting
              ? "Processing..."
              : currentState === "sign up"
              ? "Create Account"
              : "Login"}
          </button>

          {/* Terms and conditions agreement checkbox. */}
          <label className="flex items-center gap-2 mt-4 text-sm text-gray-400">
            <input type="checkbox" required />
            <span>I agree to the terms and privacy policy</span>
          </label>

          {/* A toggle to switch between the login and signup forms. */}
          <p className="mt-6 text-sm text-gray-400 text-center">
            {currentState === "sign up" ? (
              <>
                Already have an account?{" "}
                <span
                  className="text-violet-400 cursor-pointer hover:underline"
                  onClick={() => {
                    setCurrentState("login");
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
                    setCurrentState("sign up");
                  }}
                >
                  Sign up
                </span>
              </>
            )}
          </p>
        </form>
      </div>
    </>
  );
};

export default LoginPage;
