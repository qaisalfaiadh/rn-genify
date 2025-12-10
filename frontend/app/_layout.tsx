import { Slot } from "expo-router";
import { AppContextProvider } from "../context/AppContext";
import Toast from "react-native-toast-message";

export default function RootLayout() {
  return (
    <AppContextProvider>
      <Slot />
      <Toast />
    </AppContextProvider>
  );
}
