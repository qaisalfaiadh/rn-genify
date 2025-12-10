import React, { createContext, useContext, useEffect, useState } from "react";
import axios from "axios";
import Toast from "react-native-toast-message";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";

// Create axios instance with baseURL
// Remove trailing slash from baseURL if present to avoid double slashes
const baseURL = process.env.EXPO_PUBLIC_SERVER_URL?.replace(/\/+$/, '') || '';
const axiosInstance = axios.create({
  baseURL: baseURL,
  timeout: 60000, // 60 second timeout
});

axios.defaults.baseURL = baseURL;

const AppContext = createContext();

export const AppContextProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [token, setToken] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  // ---------------------------
  // Load token from storage on app start
  // ---------------------------
  useEffect(() => {
    const loadToken = async () => {
      try {
        const storedToken = await AsyncStorage.getItem("token");
        if (storedToken) {
          setToken(storedToken);
        } else {
          setLoadingUser(false);
        }
      } catch (error) {
        console.error("Error loading token:", error);
        setLoadingUser(false);
      }
    };
    loadToken();
  }, []);

  // ---------------------------
  // Fetch user with token
  // ---------------------------
  const fetchUser = async (authToken) => {
    if (!authToken) {
      setUser(null);
      setLoadingUser(false);
      return;
    }

    try {
      const { data } = await axiosInstance.get("/api/user/data", {
        headers: { Authorization: authToken },
      });

      if (data.success) {
        setUser(data.user);
      } else {
        // Invalid token response - clear it
        setUser(null);
        setToken(null);
        await AsyncStorage.removeItem("token");
        Toast.show({ type: "error", text1: data.message || "Session expired" });
      }
    } catch (error) {
      // Handle invalid/expired token
      if (error.response?.status === 401 || error.response?.status === 501) {
        setUser(null);
        setToken(null);
        await AsyncStorage.removeItem("token");
        Toast.show({ type: "error", text1: "Session expired. Please login again." });
      } else {
        Toast.show({ type: "error", text1: error.message || "Failed to load user" });
      }
    } finally {
      setLoadingUser(false);
    }
  };

  // Watch token → load user
  useEffect(() => {
    if (token) {
      fetchUser(token);
    } else {
      setUser(null);
      setLoadingUser(false);
    }
  }, [token]);

  // ---------------------------
  // Fetch user chats
  // ---------------------------
  const fetchUsersChats = async ({ preferredChatId } = {}) => {
    try {
      const { data } = await axiosInstance.get("/api/chat/get", {
        headers: { Authorization: token },
      });

      if (!data.success) {
        Toast.show({ type: "error", text1: data.message });
        return;
      }

      setChats(data.chats);

      // Handle preferred chat
      if (preferredChatId) {
        const preferred = data.chats.find((c) => c._id === preferredChatId);
        if (preferred) {
          setSelectedChat(preferred);
          return;
        }
      }

      // Handle previously selected chat
      if (selectedChat) {
        const existing = data.chats.find((c) => c._id === selectedChat._id);
        if (existing) {
          setSelectedChat(existing);
          return;
        }
      }

      // Default chat
      setSelectedChat(data.chats.length ? data.chats[0] : null);
    } catch (error) {
      Toast.show({ type: "error", text1: error.message });
    }
  };

  // Refresh chats whenever user changes
  useEffect(() => {
    if (user) {
      fetchUsersChats();
    } else {
      setChats([]);
      setSelectedChat(null);
    }
  }, [user]);

  // ---------------------------
  // Create new chat
  // ---------------------------
  const createNewChat = async () => {
    try {
      if (!user) {
        Toast.show({ type: "info", text1: "Please login first" });
        return;
      }

      router.replace("/"); // Navigate home

      const { data } = await axiosInstance.post(
        "/api/chat/create",
        {},
        { headers: { Authorization: token } }
      );

      if (!data.success) {
        Toast.show({ type: "error", text1: data.message });
        return;
      }

      setSelectedChat(data.chat);
      fetchUsersChats({ preferredChatId: data.chat._id });
    } catch (error) {
      Toast.show({ type: "error", text1: error.message });
    }
  };

  // ---------------------------
  // Save token (for login/registration)
  // ---------------------------
  const saveToken = async (newToken) => {
    try {
      setLoadingUser(true); // Set loading while fetching user
      setToken(newToken);
      await AsyncStorage.setItem("token", newToken);
      // User will be fetched automatically by the token watcher effect
    } catch (error) {
      console.error("Error saving token:", error);
      Toast.show({ type: "error", text1: "Failed to save session" });
      setLoadingUser(false);
    }
  };

  // ---------------------------
  // Logout
  // ---------------------------
  const logout = async () => {
    setUser(null);
    setChats([]);
    setSelectedChat(null);
    setToken(null);
    await AsyncStorage.removeItem("token");
    router.replace("/login");
  };

  const value = {
    user,
    setUser,
    chats,
    selectedChat,
    setSelectedChat,
    loadingUser,
    fetchUsersChats,
    createNewChat,
    token,
    saveToken,
    logout,
    axios: axiosInstance, // Use the configured instance
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = () => useContext(AppContext);
