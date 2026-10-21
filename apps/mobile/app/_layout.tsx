import { BricolageGrotesque_700Bold, useFonts } from "@expo-google-fonts/bricolage-grotesque";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider } from "../src/auth";
import { InboxProvider } from "../src/inbox";
import { colors } from "../src/theme";

export default function RootLayout() {
  // Only the wordmark uses Bricolage; wait for it so the name never flashes in another face
  const [fontsLoaded] = useFonts({ BricolageGrotesque_700Bold });
  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <InboxProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShadowVisible: false,
              headerStyle: { backgroundColor: colors.ground },
              headerTintColor: colors.text,
              headerTitleStyle: { fontSize: 17, fontWeight: "600", color: colors.text },
              headerBackButtonDisplayMode: "minimal",
              contentStyle: { backgroundColor: colors.ground },
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="login" options={{ headerShown: false, animation: "fade" }} />
            <Stack.Screen name="events/[id]" options={{ title: "" }} />
            <Stack.Screen name="profile/edit" options={{ title: "Edit profile", presentation: "modal" }} />
          </Stack>
        </InboxProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
