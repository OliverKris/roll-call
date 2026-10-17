import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider } from "../src/auth";
import { colors } from "../src/theme";

export default function RootLayout() {
    return (
        <SafeAreaProvider>
            <AuthProvider>
                <StatusBar style="dark" />
                <Stack
                    screenOptions={{
                        headerShadowVisible: false,
                        headerStyle: { backgroundColor: colors.bg },
                        headerTintColor: colors.text,
                        contentStyle: { backgroundColor: colors.bg },
                    }}
                >
                    <Stack.Screen
                        name="(tabs)"
                        options={{ headerShown: false }}
                    />
                    <Stack.Screen
                        name="login"
                        options={{ headerShown: false }}
                    />
                    <Stack.Screen
                        name="events/[id]"
                        options={{ title: "Game night" }}
                    />
                </Stack>
            </AuthProvider>
        </SafeAreaProvider>
    );
}
