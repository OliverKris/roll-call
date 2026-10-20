import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { EventSummary } from "./api";
import { dateTile, formatDistance, formatTime, seatsSummary } from "./format";
import { SeatTokens } from "./SeatTokens";
import { colors, fonts, space, type } from "./theme";
import { Tag, type Tone } from "./ui";

/**
 * One game night in a list. `lead="time"` is for lists already grouped by day;
 * `lead="date"` shows a small calendar tile instead.
 */
export function EventRow({
  event,
  gameName,
  distanceKm,
  lead = "time",
  status,
  onPress,
}: {
  event: EventSummary;
  gameName?: string;
  distanceKm?: number;
  lead?: "time" | "date";
  status?: { label: string; tone: Tone };
  onPress: () => void;
}) {
  const full = event.seats_left <= 0;
  const tile = dateTile(event.starts_at);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${event.title}, ${gameName ?? "board game"}, ${formatTime(event.starts_at)}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {lead === "time" ? (
        <Text style={styles.time}>{formatTime(event.starts_at)}</Text>
      ) : (
        <View style={styles.tile}>
          <Text style={styles.tileMonth}>{tile.month}</Text>
          <Text style={styles.tileDay}>{tile.day}</Text>
        </View>
      )}

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {event.title}
          </Text>
          {status ? <Tag label={status.label} tone={status.tone} /> : null}
        </View>
        <Text style={styles.game} numberOfLines={1}>
          {gameName ?? "Board game"}
        </Text>
        <View style={styles.place}>
          <Ionicons name="location-outline" size={14} color={colors.slate} style={styles.placeIcon} />
          <Text style={[styles.placeText, styles.shrink]} numberOfLines={1}>
            {event.location_name}
          </Text>
          {distanceKm !== undefined ? (
            <Text style={styles.placeText}>{`, ${formatDistance(distanceKm)}`}</Text>
          ) : null}
        </View>
        <View style={styles.seats}>
          <SeatTokens taken={event.seats_taken} capacity={event.capacity} />
          <Text style={[styles.seatsText, full && styles.seatsFull]}>{seatsSummary(event)}</Text>
        </View>
      </View>

      <Ionicons name="chevron-forward" size={18} color={colors.faint} style={styles.chevron} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: 14,
    backgroundColor: colors.surface,
  },
  pressed: { backgroundColor: colors.paper },
  time: {
    fontFamily: fonts.displayMedium,
    fontSize: 15,
    lineHeight: 22,
    color: colors.ink,
    width: 64,
  },
  tile: {
    width: 48,
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    paddingVertical: 4,
  },
  tileMonth: { fontSize: 12, fontWeight: "600", color: colors.slate },
  tileDay: { fontFamily: fonts.display, fontSize: 22, lineHeight: 26, color: colors.ink },
  body: { flex: 1, gap: 3 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  title: { fontSize: 17, lineHeight: 22, fontWeight: "600", color: colors.ink, flexShrink: 1 },
  game: { ...type.secondary, color: colors.ink },
  place: { flexDirection: "row", alignItems: "center" },
  placeIcon: { marginRight: 4 },
  placeText: { ...type.caption, color: colors.slate },
  shrink: { flexShrink: 1 },
  seats: { flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: 6 },
  seatsText: { ...type.caption, color: colors.slate, fontWeight: "500" },
  seatsFull: { color: colors.waiting },
  chevron: { marginTop: 2 },
});
