import React from "react";
import assets from "../assets/assets";

/**
 * A modal component to display a user's profile information.
 * @param {{
 * user: object | null;
 * onClose: () => void;
 * }} props
 */
const UserProfileModal = ({ user, onClose }) => {
  // Do not render the component if no user data is provided.
  if (!user) return null;

  return (
    // The main backdrop for the modal. It's semi-transparent and closes the modal when clicked.
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* The modal's content container. Clicking inside does not close the modal. */}
      <div
        className="bg-slate-800 border border-slate-700 rounded-2xl shadow-xl w-full max-w-sm text-center p-8 flex flex-col items-center gap-4 animate-fade-in"
        onClick={(event) => event.stopPropagation()} // Prevents the backdrop's onClick from firing.
      >
        <img
          src={user.profilePic || assets.avatar_icon}
          alt={user.fullName}
          className="w-32 h-32 rounded-full object-cover border-4 border-violet-500 shadow-lg"
        />
        <h2 className="text-3xl font-bold text-white mt-2">{user.fullName}</h2>
        <p className="text-sm text-gray-400">{user.email}</p>
        <p className="text-gray-300 mt-2 text-base">{user.bio}</p>
        <button
          onClick={onClose}
          className="mt-6 bg-violet-600 hover:bg-violet-700 text-white font-semibold py-2 px-6 rounded-full transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
};

export default UserProfileModal;
