import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from "react-native";
import { useState, useEffect } from "react";
import { useAppContext } from "../context/AppContext";
import Toast from "react-native-toast-message";
import { router, Link, Redirect } from "expo-router";

export default function Register() {
  const { saveToken, user, loadingUser } = useAppContext();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (!loadingUser && user) {
      router.replace("/");
    }
  }, [user, loadingUser]);

  // Navigate to home when user is loaded after registration
  useEffect(() => {
    if (!loadingUser && user && isRegistering) {
      router.replace("/");
      setIsRegistering(false);
    }
  }, [user, loadingUser, isRegistering]);

  const registerUser = async () => {
    if (!name || !email || !password)
      return Toast.show({ type: "error", text1: "All fields required" });

    try {
      setIsRegistering(true);
      const res = await fetch(
        process.env.EXPO_PUBLIC_SERVER_URL + "/api/user/register",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        }
      );

      const data = await res.json();

      if (!data.success) {
        setIsRegistering(false);
        return Toast.show({ type: "error", text1: data.message });
      }

      await saveToken(data.token); // saves token & triggers user fetch
      // Navigation will happen automatically when user is loaded (via useEffect above)
    } catch (e) {
      setIsRegistering(false);
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
      <Text style={{ fontSize: 28, marginBottom: 20 }}>Register</Text>

      <TextInput
        placeholder="Name"
        onChangeText={setName}
        value={name}
        style={{ backgroundColor: "#eee", padding: 12, marginBottom: 15 }}
      />

      <TextInput
        placeholder="Email"
        onChangeText={setEmail}
        value={email}
        keyboardType="email-address"
        autoCapitalize="none"
        style={{ backgroundColor: "#eee", padding: 12, marginBottom: 15 }}
      />

      <TextInput
        secureTextEntry
        placeholder="Password"
        onChangeText={setPassword}
        value={password}
        style={{ backgroundColor: "#eee", padding: 12, marginBottom: 15 }}
      />

      <TouchableOpacity
        onPress={registerUser}
        disabled={isRegistering}
        style={{ 
          backgroundColor: isRegistering ? "#666" : "#000", 
          padding: 15, 
          marginBottom: 15,
          opacity: isRegistering ? 0.6 : 1
        }}
      >
        {isRegistering ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={{ color: "#fff", textAlign: "center" }}>Register</Text>
        )}
      </TouchableOpacity>

      <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center" }}>
        <Text style={{ fontSize: 14, color: "#666" }}>Already have an account? </Text>
        <Link href="/login" asChild>
          <TouchableOpacity>
            <Text style={{ fontSize: 14, color: "#000", fontWeight: "600" }}>Login</Text>
          </TouchableOpacity>
        </Link>
      </View>
    </View>
  );
}


