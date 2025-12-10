import {
  DrawerContentScrollView,
  DrawerItemList,
  DrawerContentComponentProps,
} from "@react-navigation/drawer";
import { View, Text, Image, StyleSheet, TouchableOpacity } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useAppContext } from "../context/AppContext";

export default function CustomDrawer(props: DrawerContentComponentProps) {
  const { user, logout } = useAppContext();

  return (
    <DrawerContentScrollView
      {...props}
      contentContainerStyle={{ flex: 1, paddingTop: 0 }}
    >
      {/* Top Logo + User Info */}
      <View style={styles.logoContainer}>
        <Image source={require("../assets/logo.png")} style={styles.logo} />

        {/* Username */}
        <Text style={styles.userName}>{user?.name || "User"}</Text>
      </View>

      {/* Drawer Screens */}
      <View style={{ flex: 1 }}>
        <DrawerItemList {...props} />
      </View>

      {/* Logout Button */}
      <View style={styles.logoutContainer}>
        <TouchableOpacity onPress={logout} style={styles.logoutButton}>
          <MaterialIcons name="logout" size={22} color="red" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </DrawerContentScrollView>
  );
}

const styles = StyleSheet.create({
  logoContainer: {
    padding: 20,
    marginBottom: 10,
    alignItems: "center",
  },
  logo: {
    width: 80,
    height: 80,
    resizeMode: "contain",
  },
  userName: {
    marginTop: 10,
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
  },
  logoutContainer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
  },
  logoutText: {
    fontSize: 16,
    color: "red",
    fontWeight: "600",
  },
});
