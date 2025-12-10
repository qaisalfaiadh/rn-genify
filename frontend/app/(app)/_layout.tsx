import { Drawer } from "expo-router/drawer";
import { useAppContext } from "../../context/AppContext";
import { Redirect } from "expo-router";
import CustomDrawer from "../../components/CustomDrawer";
import { ActivityIndicator, View } from "react-native";

export default function AppLayout() {
  const { user, loadingUser } = useAppContext();

  // While loading user → show loader
  if (loadingUser) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // Not logged in → redirect
  if (!user) return <Redirect href="/login" />;

  return (
    <Drawer
      drawerContent={(props) => <CustomDrawer {...props} />}
      screenOptions={{
        drawerStyle: { backgroundColor: "#f9f9f9" },

        headerStyle: {
          backgroundColor: "#fff",
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 0,
        },
        headerTintColor: "#000",
        headerTitle: "",
        headerShown: true, // menu icon visible
      }}
    >
      <Drawer.Screen name="index" options={{ drawerLabel: "Home" }} />
      <Drawer.Screen name="library" options={{ drawerLabel: "Library" }} />
    </Drawer>
  );
}
