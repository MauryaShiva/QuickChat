# 🚀 QuickChat - Real-Time Chat Application

**Live Demo:** [**https://quick-chat-opal-nu.vercel.app/**](https://quick-chat-opal-nu.vercel.app/)

-----

## 📝 Introduction

QuickChat is a modern, full-stack, real-time messaging application built with the MERN stack (MongoDB, Express, React, Node.js). It offers a seamless communication experience with features like one-on-one chats, group conversations, real-time video/audio calls, and an integrated AI assistant powered by Groq. The application is designed to be fast, responsive, and user-friendly, providing a complete solution for modern communication needs.

-----

## ✨ Key Features

  * **👥 Real-Time Messaging:** Instant one-on-one and group messaging powered by Socket.IO.
  * **🔒 Secure Authentication:** JWT-based user authentication with password hashing using `bcrypt`.
  * **🧩 Group Chat Management:**
      * Create, edit, and delete groups.
      * Add or remove participants (Admin only).
      * Leave groups.
  * **📞 WebRTC Video & Audio Calls:** High-quality, peer-to-peer video and audio calls for one-on-one conversations.
  * **🤖 AI Assistant (Groq Bot):**
      * Conversational AI with memory (retains context from recent messages).
      * AI-powered bio generation for user profiles and groups.
  * **🟢 Real-Time Presence:** See which users are currently online.
  * **✍️ Typing Indicators:** Know when the other person is typing in one-on-one chats.
  * **✔️ Read Receipts:** Real-time "seen" status for messages in both one-on-one and group chats.
  * **🔔 Smart Notifications:** Get aggregated toast notifications for new messages, just like WhatsApp.
  * **🖼️ Image Sharing:** Upload and share images in any chat, stored securely on Cloudinary.
  * **📱 Responsive Design:** A clean and modern user interface that works seamlessly on all devices.

-----

## 🛠️ Tech Stack

### **Backend**

  * **Framework:** Node.js & Express.js
  * **Database:** MongoDB & Mongoose
  * **Real-Time:** Socket.IO
  * **Authentication:** JSON Web Token (JWT)
  * **Image Storage:** Cloudinary
  * **AI:** Groq AI
  * **Calls:** WebRTC (for signaling)

### **Frontend**

  * **Library:** React.js & Vite
  * **Styling:** Tailwind CSS
  * **Routing:** React Router
  * **State Management:** Context API
  * **Real-Time:** Socket.IO Client
  * **Notifications:** React Hot Toast

### **Deployment**

  * **Frontend:** Vercel
  * **Backend:** Render

-----

## 🚀 Getting Started

Follow these instructions to set up and run the project locally on your machine.

### **Prerequisites**

  * Node.js (v18 or later)
  * MongoDB (You can use a local instance or a free cloud instance from [MongoDB Atlas](https://www.mongodb.com/cloud/atlas))
  * A [Cloudinary](https://cloudinary.com/) account for image storage.
  * A [Groq AI](https://groq.com/) account for the AI assistant.

### **1. Clone the Repository**

```bash
git clone https://github.com/MauryaShiva/QuickChat.git
cd QuickChat
```

### **2. Setup the Backend (`server`)**

```bash
# Navigate to the server directory
cd server

# Install dependencies
npm install

# Create a .env file
cp .env.example .env
```

Now, open the `server/.env` file and add your secret keys:

```env
MONGO_URI="your_mongodb_connection_string"
JWT_SECRET="your_jwt_secret_key"
CLOUDINARY_CLOUD_NAME="your_cloudinary_cloud_name"
CLOUDINARY_API_KEY="your_cloudinary_api_key"
CLOUDINARY_API_SECRET="your_cloudinary_api_secret"
GROQ_API_KEY="your_groq_api_key"
PORT=5000
```

### **3. Setup the Frontend (`client`)**

```bash
# Navigate to the client directory from the root
cd ../client

# Install dependencies
npm install

# Create a .env file
cp .env.example .env
```

The `client/.env` file should contain the URL of your backend server:

```env
VITE_BACKEND_URL="http://localhost:5000"
```

### **4. Run the Application**

You will need two separate terminals to run both the backend and frontend servers.

  * **In the `server` directory, run:**

    ```bash
    npm run server
    ```

  * **In the `client` directory, run:**

    ```bash
    npm run dev
    ```

Your application should now be running at `http://localhost:5173`.

-----

## 🌐 Deployment

This project is configured for a professional, scalable deployment:

  * The **Frontend (`client`)** is deployed on **Vercel**.
  * The **Backend (`server`)** is deployed on **Render**.

To deploy, import your GitHub repository into both Vercel and Render and add the required environment variables in each platform's project settings.
