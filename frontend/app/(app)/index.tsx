import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Switch,
} from "react-native";
import { useAppContext } from "../../context/AppContext";
import Toast from "react-native-toast-message";
import { Feather } from "@expo/vector-icons"; // Expo Vector Icons
import Message from "../../components/Message";
export default function Home() {
  const containerRef = useRef<ScrollView>(null);

  const {
    selectedChat,
    axios: customAxios,
    token,
    setUser,
    user,
    fetchUsersChats,
  } = useAppContext();

  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<"text" | "image">("text");
  const [isPublished, setIsPublished] = useState(false);
  const [lastSubmissionTime, setLastSubmissionTime] = useState(0);
  const [rateLimitUntil, setRateLimitUntil] = useState<number | null>(null);

  const requiredCredits = mode === "image" ? 2 : 1;
  const notEnoughCredits = user?.credits < requiredCredits;

  const onSubmit = async () => {
    // Check if we're still in rate limit cooldown
    const now = Date.now();
    if (rateLimitUntil && now < rateLimitUntil) {
      const remainingSeconds = Math.ceil((rateLimitUntil - now) / 1000);
      const remainingMinutes = Math.ceil(remainingSeconds / 60);
      Toast.show({ 
        type: "error", 
        text1: "Rate Limited",
        text2: `Please wait ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''} before trying again`,
        visibilityTime: 5000,
      });
      return;
    }

    // Prevent rapid submissions (throttle to once per 3 seconds)
    const timeSinceLastSubmission = now - lastSubmissionTime;
    const minDelay = 3000; // 3 seconds minimum between submissions

    if (timeSinceLastSubmission < minDelay && lastSubmissionTime > 0) {
      const remainingTime = Math.ceil((minDelay - timeSinceLastSubmission) / 1000);
      Toast.show({ 
        type: "info", 
        text1: `Please wait ${remainingTime} second${remainingTime > 1 ? 's' : ''} before sending another message` 
      });
      return;
    }

    if (!user) {
      Toast.show({ type: "error", text1: "Please login to continue" });
      return;
    }

    if (!selectedChat || !selectedChat._id) {
      Toast.show({ type: "error", text1: "Please select a chat first" });
      return;
    }

    if (!prompt.trim()) {
      Toast.show({ type: "error", text1: "Please enter a message" });
      return;
    }

    if (notEnoughCredits) {
      Toast.show({ type: "error", text1: "You don't have enough credits" });
      return;
    }

    if (loading) {
      Toast.show({ type: "info", text1: "Please wait for the current request to complete" });
      return;
    }

    setLoading(true);
    setLastSubmissionTime(now);
    const promptCopy = prompt.trim();
    const userMessage = {
      role: "user",
      content: promptCopy,
      timestamp: Date.now(),
      isImage: false,
    };
    
    setPrompt("");
    // Add user message optimistically
    setMessages((prev) => [...prev, userMessage]);

    try {
      const endpoint = `/api/message/${mode}`;
      const fullUrl = `${customAxios.defaults.baseURL || ''}${endpoint}`;
      console.log(`Sending ${mode} message request to: ${fullUrl}`);
      console.log(`Request payload:`, { chatId: selectedChat._id, promptLength: promptCopy.length, isPublished });
      
      const { data } = await customAxios.post(
        endpoint,
        { chatId: selectedChat._id, prompt: promptCopy, isPublished },
        { 
          headers: { Authorization: token },
          timeout: 60000, // 60 second timeout
        }
      );

      if (data.success) {
        // Add AI reply
        setMessages((prev) => [...prev, data.reply]);
        setUser((prev: any) => ({
          ...prev,
          credits: prev.credits - requiredCredits,
        }));
        // Refresh chats to get updated messages from server
        await fetchUsersChats({ preferredChatId: selectedChat._id });
      } else {
        Toast.show({ type: "error", text1: data.message || "Failed to get response" });
        // Remove the user message if request failed - remove the last user message
        setMessages((prev) => {
          const newMessages = [...prev];
          // Find and remove the last user message we just added
          for (let i = newMessages.length - 1; i >= 0; i--) {
            if (newMessages[i].role === "user" && newMessages[i].content === promptCopy) {
              newMessages.splice(i, 1);
              break;
            }
          }
          return newMessages;
        });
        setPrompt(promptCopy);
      }
    } catch (error: any) {
      console.error("Error sending message:", error);
      
      // Extract error message with better handling
      let errorMessage = "Something went wrong. Please try again.";
      const statusCode = error.response?.status;
      const errorData = error.response?.data;
      
      if (statusCode === 429) {
        // Rate limit error - show friendly message with retry suggestion
        const retryAfter = errorData?.retryAfter || 120;
        const minutes = Math.ceil(retryAfter / 60);
        const cooldownUntil = Date.now() + (retryAfter * 1000);
        setRateLimitUntil(cooldownUntil); // Set client-side rate limit cooldown
        
        errorMessage = `Rate limit exceeded. The API is temporarily unavailable. Please wait ${minutes} minute${minutes > 1 ? 's' : ''} before trying again.`;
      } else if (statusCode === 401 || statusCode === 403) {
        errorMessage = errorData?.message || "Authentication failed. Please login again.";
      } else if (statusCode === 400) {
        // Bad request - might be invalid prompt or API configuration
        errorMessage = errorData?.message || "Invalid request. Please check your message and try again.";
      } else if (statusCode === 500) {
        errorMessage = errorData?.message || "Server error. Please try again in a moment.";
      } else if (errorData?.message) {
        errorMessage = errorData.message;
      } else if (error.message) {
        errorMessage = error.message;
      }

      // Only show error if it's not a network timeout (which might be handled differently)
      if (!error.code || error.code !== 'ECONNABORTED') {
        Toast.show({
          type: "error",
          text1: "Request Failed",
          text2: errorMessage,
          visibilityTime: statusCode === 429 ? 6000 : 4000, // Show rate limit errors longer
        });
      }

      // Remove the user message if request failed - remove the last user message
      setMessages((prev) => {
        const newMessages = [...prev];
        // Find and remove the last user message we just added
        for (let i = newMessages.length - 1; i >= 0; i--) {
          if (newMessages[i].role === "user" && newMessages[i].content === promptCopy) {
            newMessages.splice(i, 1);
            break;
          }
        }
        return newMessages;
      });
      setPrompt(promptCopy);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedChat) setMessages(selectedChat.messages);
  }, [selectedChat]);

  useEffect(() => {
    containerRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  return (
    <View style={styles.container}>
      <ScrollView ref={containerRef} style={styles.messagesWrapper}>
        {messages.length === 0 && (
          <View style={styles.noMessages}>
            <Text style={styles.noMessagesText}>
              Hey, {user?.name}. Ready to dive in?
            </Text>
          </View>
        )}

        {messages.map((message, index) => (
          <Message key={`${message.timestamp}-${index}`} message={message} />
        ))}

        {loading && (
          <View style={styles.loadingWrapper}>
            <ActivityIndicator size="small" color="#000" />
          </View>
        )}
      </ScrollView>

      {mode === "image" && (
        <View style={styles.publishToggle}>
          <Text style={styles.publishText}>
            Publish Generated Image to Library
          </Text>
          <Switch
            value={isPublished}
            onValueChange={setIsPublished}
            disabled={notEnoughCredits}
          />
        </View>
      )}

      {notEnoughCredits && (
        <Text style={styles.credits}>Not enough credits</Text>
      )}

      <View style={styles.form}>
        <View style={styles.modeButtonsWrapper}>
          <TouchableOpacity
            style={[
              styles.modeButtonBase,
              mode === "text"
                ? styles.modeButtonActive
                : styles.modeButtonInactive,
            ]}
            onPress={() => setMode("text")}
            disabled={loading}
          >
            <Text
              style={mode === "text" ? { color: "#fff" } : { color: "#555" }}
            >
              Text
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.modeButtonBase,
              mode === "image"
                ? styles.modeButtonActive
                : styles.modeButtonInactive,
            ]}
            onPress={() => setMode("image")}
            disabled={loading}
          >
            <Text
              style={mode === "image" ? { color: "#fff" } : { color: "#555" }}
            >
              Image
            </Text>
          </TouchableOpacity>
        </View>

        <TextInput
          style={styles.promptInput}
          placeholder="Type Your prompt here"
          value={prompt}
          onChangeText={setPrompt}
          editable={!notEnoughCredits && !loading}
          multiline
        />

        <TouchableOpacity
          onPress={onSubmit}
          disabled={notEnoughCredits || loading || !prompt.trim()}
          style={[
            styles.sendButtonWrapper,
            (notEnoughCredits || loading || !prompt.trim()) && styles.sendButtonDisabled
          ]}
        >
          {loading ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Feather name="arrow-up" size={18} color="white" />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};



const styles = StyleSheet.create({
  container: { flex: 1, margin: 10, justifyContent: "space-between" },
  messagesWrapper: { flex: 1, marginBottom: 10 },
  noMessages: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  noMessagesText: { marginTop: 20, fontSize: 20, textAlign: "center" },
  loadingWrapper: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 10,
    marginLeft: 5,
  },
  publishToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 5,
  },
  publishText: { fontSize: 12, marginRight: 8 },
  credits: { color: "red", textAlign: "center", marginVertical: 5 },
  form: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 50,
    padding: 10,
    gap: 10,
    marginBottom:20
  },
  modeButtonsWrapper: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.6)",
    padding: 2,
    borderRadius: 50,
    gap: 5,
  },
  modeButtonBase: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 50,
  },
  modeButtonActive: { backgroundColor: "#000" },
  modeButtonInactive: { backgroundColor: "#fff" },
  promptInput: {
    flex: 1,
    fontSize: 14,
    paddingHorizontal: 10,
    backgroundColor: "#f0f0f0",
    borderRadius: 25,
  },
  sendButtonWrapper: {
    backgroundColor: "#000",
    padding: 10,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    backgroundColor: "#666",
    opacity: 0.6,
  },
});