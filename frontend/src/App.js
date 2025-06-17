import { useState, useEffect, useRef } from "react";
import "./App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import axios from "axios";
import io from "socket.io-client";
import { Send, Users, MessageCircle, LogOut, User } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Auth Components
const AuthForm = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: ""
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const endpoint = isLogin ? "/login" : "/register";
      const data = isLogin 
        ? { email: formData.email, password: formData.password }
        : formData;

      const response = await axios.post(`${API}${endpoint}`, data);
      
      localStorage.setItem("token", response.data.access_token);
      localStorage.setItem("user", JSON.stringify(response.data.user));
      
      onLogin(response.data.user, response.data.access_token);
    } catch (err) {
      setError(err.response?.data?.detail || "An error occurred");
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            Chatz
          </h1>
          <p className="text-gray-600 mt-2">
            {isLogin ? "Welcome back!" : "Join the conversation"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <input
              type="text"
              placeholder="Username"
              value={formData.username}
              onChange={(e) => setFormData({...formData, username: e.target.value})}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              required
            />
          )}
          
          <input
            type="email"
            placeholder="Email"
            value={formData.email}
            onChange={(e) => setFormData({...formData, email: e.target.value})}
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            required
          />
          
          <input
            type="password"
            placeholder="Password"
            value={formData.password}
            onChange={(e) => setFormData({...formData, password: e.target.value})}
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            required
          />

          {error && (
            <div className="text-red-500 text-sm text-center">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white p-3 rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition duration-200 disabled:opacity-50"
          >
            {loading ? "Loading..." : (isLogin ? "Sign In" : "Sign Up")}
          </button>
        </form>

        <div className="text-center mt-6">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-purple-600 hover:text-purple-800 transition duration-200"
          >
            {isLogin ? "Need an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
};

// Chat Components
const UserList = ({ users, onSelectUser, selectedUser, currentUser }) => {
  return (
    <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-purple-600 to-pink-600">
        <h2 className="text-white font-semibold text-lg flex items-center gap-2">
          <Users size={20} />
          Contacts
        </h2>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {users.map((user) => (
          <div
            key={user.id}
            onClick={() => onSelectUser(user)}
            className={`p-4 cursor-pointer hover:bg-gray-50 border-b border-gray-100 transition duration-200 ${
              selectedUser?.id === user.id ? "bg-purple-50 border-purple-200" : ""
            }`}
          >
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold"
                style={{ backgroundColor: user.avatar_color }}
              >
                {user.username.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="font-medium text-gray-900">{user.username}</div>
                <div className="text-sm text-gray-500 flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-full ${user.is_online ? "bg-green-500" : "bg-gray-300"}`}></div>
                  {user.is_online ? "Online" : "Offline"}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const MessageBubble = ({ message, isOwn, sender }) => {
  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"} mb-4`}>
      <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${
        isOwn 
          ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white" 
          : "bg-gray-100 text-gray-800"
      }`}>
        {!isOwn && (
          <div className="text-xs font-medium mb-1" style={{ color: sender?.avatar_color }}>
            {sender?.username}
          </div>
        )}
        <div className="break-words">{message.content}</div>
        <div className={`text-xs mt-1 ${isOwn ? "text-purple-100" : "text-gray-500"}`}>
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
};

const ChatArea = ({ selectedUser, messages, onSendMessage, currentUser }) => {
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = (e) => {
    e.preventDefault();
    if (newMessage.trim() && selectedUser) {
      onSendMessage(newMessage, selectedUser.id);
      setNewMessage("");
    }
  };

  if (!selectedUser) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center text-gray-500">
          <MessageCircle size={64} className="mx-auto mb-4 text-gray-300" />
          <h3 className="text-xl font-semibold mb-2">Welcome to Chatz!</h3>
          <p>Select a contact to start chatting</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Chat Header */}
      <div className="p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-3">
          <div 
            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold"
            style={{ backgroundColor: selectedUser.avatar_color }}
          >
            {selectedUser.username.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="font-semibold text-gray-900">{selectedUser.username}</div>
            <div className="text-sm text-gray-500 flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${selectedUser.is_online ? "bg-green-500" : "bg-gray-300"}`}></div>
              {selectedUser.is_online ? "Online" : "Offline"}
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 bg-gradient-to-b from-purple-50 to-pink-50">
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            isOwn={message.sender_id === currentUser.id}
            sender={message.sender_id === currentUser.id ? currentUser : selectedUser}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <form onSubmit={handleSend} className="p-4 border-t border-gray-200 bg-white">
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 p-3 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <button
            type="submit"
            className="bg-gradient-to-r from-purple-500 to-pink-500 text-white p-3 rounded-full hover:from-purple-600 hover:to-pink-600 transition duration-200"
          >
            <Send size={20} />
          </button>
        </div>
      </form>
    </div>
  );
};

// Main Chat App
const ChatApp = ({ user, token, onLogout }) => {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    // Set up axios default headers
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

    // Fetch users
    fetchUsers();

    // Set up WebSocket connection
    const ws = new WebSocket(`${BACKEND_URL.replace('https', 'wss').replace('http', 'ws')}/ws/${user.id}`);
    
    ws.onopen = () => {
      console.log("WebSocket connected");
      setSocket(ws);
    };

    ws.onmessage = (event) => {
      const messageData = JSON.parse(event.data);
      if (messageData.type === "message") {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          sender_id: messageData.sender_id,
          receiver_id: messageData.receiver_id,
          content: messageData.content,
          timestamp: messageData.timestamp,
          is_read: false
        }]);
      }
    };

    ws.onclose = () => {
      console.log("WebSocket disconnected");
    };

    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [user.id, token]);

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${API}/users`);
      setUsers(response.data);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const fetchMessages = async (userId) => {
    try {
      const response = await axios.get(`${API}/messages/${userId}`);
      setMessages(response.data);
    } catch (error) {
      console.error("Error fetching messages:", error);
    }
  };

  const handleSelectUser = (selectedUser) => {
    setSelectedUser(selectedUser);
    fetchMessages(selectedUser.id);
  };

  const handleSendMessage = async (content, receiverId) => {
    try {
      const response = await axios.post(`${API}/messages`, {
        receiver_id: receiverId,
        content: content
      });

      // Add message to local state
      setMessages(prev => [...prev, response.data]);
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    if (socket) {
      socket.close();
    }
    onLogout();
  };

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MessageCircle size={32} />
          <h1 className="text-2xl font-bold">Chatz</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div 
              className="w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-sm"
              style={{ backgroundColor: user.avatar_color }}
            >
              {user.username.charAt(0).toUpperCase()}
            </div>
            <span className="font-medium">{user.username}</span>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 hover:bg-white hover:bg-opacity-20 rounded-full transition duration-200"
          >
            <LogOut size={20} />
          </button>
        </div>
      </div>

      {/* Chat Interface */}
      <div className="flex-1 flex overflow-hidden">
        <UserList 
          users={users}
          onSelectUser={handleSelectUser}
          selectedUser={selectedUser}
          currentUser={user}
        />
        <ChatArea
          selectedUser={selectedUser}
          messages={messages}
          onSendMessage={handleSendMessage}
          currentUser={user}
        />
      </div>
    </div>
  );
};

// Main App Component
function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);

  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");
    
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const handleLogin = (userData, accessToken) => {
    setUser(userData);
    setToken(accessToken);
  };

  const handleLogout = () => {
    setUser(null);
    setToken(null);
  };

  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={
            user && token ? 
              <ChatApp user={user} token={token} onLogout={handleLogout} /> : 
              <AuthForm onLogin={handleLogin} />
          } />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;