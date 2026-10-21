import { Ionicons } from "@expo/vector-icons";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AREAS, type Area } from "./areas";
import { colors, radius, space, type } from "./theme";
import { Button, Segmented } from "./ui";

export const RADII = [
  { value: 5, label: "5 km" },
  { value: 10, label: "10 km" },
  { value: 25, label: "25 km" },
];

/** The switcher in Discover's top bar: where to look, and how far. */
export function AreaButton({ area, radiusKm, onPress }: { area: Area; radiusKm: number; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Searching within ${radiusKm} km of ${area.label}. Change`}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Ionicons name={area.label === "Near me" ? "navigate-outline" : "location-outline"} size={15} color={colors.text} />
      <Text style={styles.buttonLabel} numberOfLines={1}>
        {area.label} · {radiusKm} km
      </Text>
      <Ionicons name="chevron-down" size={14} color={colors.muted} />
    </Pressable>
  );
}

export function AreaSheet({
  visible,
  area,
  radiusKm,
  onPickArea,
  onPickMyLocation,
  onPickRadius,
  onClose,
}: {
  visible: boolean;
  area: Area;
  radiusKm: number;
  onPickArea: (a: Area) => void;
  onPickMyLocation: () => void;
  onPickRadius: (km: number) => void;
  onClose: () => void;
}) {
  const options: { label: string; icon: "navigate-outline" | "location-outline"; onPress: () => void }[] = [
    { label: "Near me", icon: "navigate-outline", onPress: onPickMyLocation },
    ...AREAS.map((a) => ({ label: a.label, icon: "location-outline" as const, onPress: () => onPickArea(a) })),
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close" />
      <SafeAreaView edges={["bottom"]} style={styles.sheet}>
        <View style={styles.grabber} />
        <Text style={styles.title} accessibilityRole="header">
          Where to look
        </Text>

        <View style={styles.list}>
          {options.map((o, i) => {
            const on = o.label === area.label;
            return (
              <Pressable
                key={o.label}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                onPress={o.onPress}
                style={({ pressed }) => [styles.option, i > 0 && styles.optionRule, pressed && styles.optionPressed]}
              >
                <Ionicons name={o.icon} size={18} color={colors.muted} />
                <Text style={styles.optionLabel}>{o.label}</Text>
                {on ? <Ionicons name="checkmark" size={20} color={colors.text} /> : null}
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>Distance</Text>
        <Segmented options={RADII} value={radiusKm} onChange={onPickRadius} />

        <View style={styles.done}>
          <Button label="Done" onPress={onClose} />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 36,
    maxWidth: 210,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.raised,
  },
  buttonLabel: { fontSize: 14, fontWeight: "500", color: colors.text, flexShrink: 1 },
  pressed: { opacity: 0.7 },
  scrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    gap: space.md,
  },
  grabber: {
    alignSelf: "center",
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.control,
    marginBottom: space.sm,
  },
  title: { ...type.heading, color: colors.text },
  list: { backgroundColor: colors.raised, borderRadius: radius.inner, overflow: "hidden" },
  option: { flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg, minHeight: 50 },
  optionRule: { borderTopWidth: 1, borderTopColor: colors.surface },
  optionPressed: { backgroundColor: colors.control },
  optionLabel: { ...type.body, color: colors.text, flex: 1 },
  label: { ...type.label, color: colors.muted, fontWeight: "500", marginTop: space.sm },
  done: { paddingTop: space.sm, paddingBottom: space.md },
});
