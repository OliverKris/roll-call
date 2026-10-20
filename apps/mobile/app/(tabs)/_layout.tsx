import { Ionicons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";

import { useAuth } from "../../src/auth";
import { colors } from "../../src/theme";
import type { IconName } from "../../src/ui";

/** Outline icon when idle, filled when selected, colored by our theme. */
function tabIcon(idle: IconName, active: IconName) {
  function TabIcon({ focused, size }: { focused: boolean; size: number }) {
    return <Ionicons name={focused ? active : idle} size={size} color={focused ? colors.ink : colors.faint} />;
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
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.faint,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.lineStrong },
        sceneStyle: { backgroundColor: colors.paper },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Discover", tabBarIcon: tabIcon("compass-outline", "compass") }}
      />
      <Tabs.Screen
        name="host"
        options={{ title: "Host", tabBarIcon: tabIcon("add-circle-outline", "add-circle") }}
      />
      <Tabs.Screen
        name="me"
        options={{ title: "Profile", tabBarIcon: tabIcon("person-circle-outline", "person-circle") }}
      />
    </Tabs>
  );
}
