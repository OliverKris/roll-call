import { Ionicons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";

import { useAuth } from "../../src/auth";
import type { IconName } from "../../src/components";
import { colors } from "../../src/theme";

/** Tab icon colored by our theme rather than the tab bar's color value. */
function tabIcon(name: IconName) {
    function TabIcon({ focused, size }: { focused: boolean; size: number }) {
        return (
            <Ionicons
                name={name}
                size={size}
                color={focused ? colors.primary : colors.muted}
            />
        );
    }
    return TabIcon;
}

export default function TabsLayout() {
    const { token, ready } = useAuth();
    if (!ready) return null;
    if (!token) return <Redirect href="/login" />;

    return (
        <Tabs
            screenOptions={{
                tabBarActiveTintColor: colors.primary,
                tabBarInactiveTintColor: colors.muted,
                headerShadowVisible: false,
                headerStyle: { backgroundColor: colors.bg },
                headerTitleStyle: { fontWeight: "700" },
                sceneStyle: { backgroundColor: colors.bg },
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: "Discover",
                    tabBarIcon: tabIcon("compass-outline"),
                }}
            />
            <Tabs.Screen
                name="host"
                options={{
                    title: "Host",
                    tabBarIcon: tabIcon("add-circle-outline"),
                }}
            />
            <Tabs.Screen
                name="me"
                options={{
                    title: "Me",
                    tabBarIcon: tabIcon("person-circle-outline"),
                }}
            />
        </Tabs>
    );
}
