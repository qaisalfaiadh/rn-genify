import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from "react-native";
import { useState, useEffect } from "react";
import { useAppContext } from "../context/AppContext";
import Toast from "react-native-toast-message";
import { router, Link, Redirect } from "expo-router";

export default function Login() {
  const { saveToken, user, loadingUser } = useAppContext();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (!loadingUser && user) {
      router.replace("/");
    }
  }, [user, loadingUser]);

  // Navigate to home when user is loaded after login
  useEffect(() => {
    if (!loadingUser && user && isLoggingIn) {
      router.replace("/");
      setIsLoggingIn(false);
    }
  }, [user, loadingUser, isLoggingIn]);

  const loginUser = async () => {
    if (!email || !password)
      return Toast.show({ type: "error", text1: "All fields required" });

    try {
      setIsLoggingIn(true);
      // replace with your login API
      const res = await fetch(
        process.env.EXPO_PUBLIC_SERVER_URL + "/api/user/login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        }
      );

      const data = await res.json();

      if (!data.success) {
        setIsLoggingIn(false);
        return Toast.show({ type: "error", text1: data.message });
      }

      await saveToken(data.token); // saves token & triggers user fetch
      // Navigation will happen automatically when user is loaded (via useEffect above)
    } catch (e) {
      setIsLoggingIn(false);
      Toast.show({ type: "error", text1: e.message });
    }
  };

  // Show loading while checking auth state
  if (loadingUser) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // Redirect if already logged in
  if (user) {
    return <Redirect href="/" />;
  }

  return (
    <View style={{ flex: 1, justifyContent: "center", padding: 20 }}>
      <Text style={{ fontSize: 28, marginBottom: 20 }}>Login</Text>

      <TextInput
        placeholder="Email"
        onChangeText={(text) => setEmail(text.toLowerCase())}
        value={email}
        keyboardType="email-address"
        autoCapitalize="none"
        style={{ backgroundColor: "#eee", padding: 12, marginBottom: 15 }}
      />

      <TextInput
        secureTextEntry
        placeholder="Password"
        onChangeText={setPassword}
        style={{ backgroundColor: "#eee", padding: 12, marginBottom: 15 }}
      />

      <TouchableOpacity
        onPress={loginUser}
        disabled={isLoggingIn}
        style={{ 
          backgroundColor: isLoggingIn ? "#666" : "#000", 
          padding: 15, 
          marginBottom: 15,
          opacity: isLoggingIn ? 0.6 : 1
        }}
      >
        {isLoggingIn ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={{ color: "#fff", textAlign: "center" }}>Login</Text>
        )}
      </TouchableOpacity>

      <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center" }}>
        <Text style={{ fontSize: 14, color: "#666" }}>Don't have an account? </Text>
        <Link href="/register" asChild>
          <TouchableOpacity>
            <Text style={{ fontSize: 14, color: "#000", fontWeight: "600" }}>Register</Text>
          </TouchableOpacity>
        </Link>
      </View>
    </View>
  );
}
