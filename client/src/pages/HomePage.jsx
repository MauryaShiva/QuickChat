import React, { useContext } from "react";
import Sidebar from "../components/Sidebar";
import ChatContainer from "../components/ChatContainer";
import RightSidebar from "../components/RightSidebar";
import { ChatContext } from "../../context/ChatContext";

/**
 * The main page of the application, which lays out the primary chat interface.
 * It uses a grid layout to display the sidebar, main chat container, and right sidebar.
 */
const HomePage = () => {
  // Destructures the selectedConversation from the ChatContext to dynamically adjust the layout.
  const { selectedConversation } = useContext(ChatContext);

  return (
    // The main container for the entire page with a dark background.
    <div className="bg-gray-900 w-full h-screen sm:p-8">
      <div
        className={`backdrop-blur-xl border border-gray-700 rounded-2xl overflow-hidden h-full grid grid-cols-1 relative 
          md:grid-cols-[minmax(320px,_1fr)_2.5fr] 
          ${
            // The layout dynamically changes to a three-column grid on extra-large screens
            // only when a conversation is selected, making room for the RightSidebar.
            selectedConversation
              ? "xl:grid-cols-[minmax(350px,_1fr)_3fr_minmax(300px,_1fr)]"
              : ""
          }
        `}
      >
        <Sidebar />
        <ChatContainer />
        <RightSidebar />
      </div>
    </div>
  );
};

export default HomePage;
