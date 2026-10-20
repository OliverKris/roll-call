import {
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_700Bold,
  useFonts,
} from "@expo-google-fonts/bricolage-grotesque";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider } from "../src/auth";
import { colors, fonts } from "../src/theme";

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ BricolageGrotesque_600SemiBold, BricolageGrotesque_700Bold });

  // Wait for the fonts so titles never flash in the system font
  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShadowVisible: false,
            headerStyle: { backgroundColor: colors.paper },
            headerTintColor: colors.ink,
            headerTitleStyle: { fontFamily: fonts.displayMedium },
            headerBackButtonDisplayMode: "minimal",
            contentStyle: { backgroundColor: colors.paper },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false, animation: "fade" }} />
          <Stack.Screen name="events/[id]" options={{ title: "" }} />
          <Stack.Screen
            name="profile/edit"
            options={{ title: "Edit profile", presentation: "modal" }}
          />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
