import { Ionicons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";

import { useAuth } from "../../src/auth";
import { useInbox } from "../../src/inbox";
import { colors } from "../../src/theme";
import type { IconName } from "../../src/ui";

/** Outline icons throughout; the selected tab is marked by brightness alone. */
function tabIcon(name: IconName) {
  function TabIcon({ focused }: { focused: boolean }) {
    return <Ionicons name={name} size={22} color={focused ? colors.text : colors.faint} />;
  }
  return TabIcon;
}

export default function TabsLayout() {
  const { token, ready } = useAuth();
  const { inbox } = useInbox();
  if (!ready) return null;
  if (!token) return <Redirect href="/login" />;

  const unread = inbox?.unread_count ?? 0;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.faint,
        tabBarLabelStyle: { fontSize: 12, fontWeight: "500" },
        tabBarStyle: { backgroundColor: colors.ground, borderTopColor: colors.rule, borderTopWidth: 1 },
        tabBarBadgeStyle: { backgroundColor: colors.badge, color: "#FFFFFF", fontSize: 11, fontWeight: "600" },
        sceneStyle: { backgroundColor: colors.ground },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Discover", tabBarIcon: tabIcon("compass-outline") }} />
      <Tabs.Screen name="host" options={{ title: "Host", tabBarIcon: tabIcon("add-circle-outline") }} />
      <Tabs.Screen
        name="inbox"
        options={{
          title: "Inbox",
          tabBarIcon: tabIcon("notifications-outline"),
          tabBarBadge: unread > 0 ? (unread > 99 ? "99+" : unread) : undefined,
        }}
      />
      <Tabs.Screen name="me" options={{ title: "Profile", tabBarIcon: tabIcon("person-outline") }} />
    </Tabs>
  );
}
