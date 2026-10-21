import { Pressable, StyleSheet, Text, View } from "react-native";

import type { EventSummary } from "./api";
import { formatDistance, formatTime, seatsOpen } from "./format";
import { SeatStrip } from "./SeatTokens";
import { colors, space, type } from "./theme";
import { Bar, Pill, rowPressedStyle, type Tone } from "./ui";

const LEAD_WIDTH = 68;
export const EVENT_ROW_INSET = space.lg + LEAD_WIDTH + space.md;

/**
 * One game night in a list: when, what, where, and its seats.
 * `lead="time"` is for lists already grouped by day; `lead="date"` adds the day.
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
  const d = new Date(event.starts_at);
  const full = event.seats_left <= 0;
  const game = gameName ?? "Board game";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${event.title}, ${game}, ${formatTime(event.starts_at)}, ${seatsOpen(event)}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && rowPressedStyle]}
    >
      <View style={styles.lead}>
        {lead === "date" ? (
          <>
            <Text style={styles.leadMain}>
              {d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </Text>
            <Text style={styles.leadSub}>{formatTime(event.starts_at)}</Text>
          </>
        ) : (
          <Text style={styles.leadMain}>{formatTime(event.starts_at)}</Text>
        )}
      </View>

      <View style={styles.body}>
        <View style={styles.titleLine}>
          <Text style={styles.title} numberOfLines={1}>
            {event.title}
          </Text>
          {status ? <Pill label={status.label} tone={status.tone} /> : null}
        </View>
        <Text style={styles.meta} numberOfLines={1}>
          {game} · {event.location_name}
        </Text>
        <View style={styles.seats}>
          <SeatStrip taken={event.seats_taken} capacity={event.capacity} />
          <Text style={[styles.seatsText, !full && styles.seatsOpen]}>{seatsOpen(event)}</Text>
          {distanceKm !== undefined ? (
            <Text style={styles.distance}>· {formatDistance(distanceKm)}</Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

/** The same row at its real size, with bars where the values will land. */
export function EventRowSkeleton() {
  return (
    <View style={styles.row} accessibilityElementsHidden>
      <View style={styles.lead}>
        <Bar width={56} height={16} />
      </View>
      <View style={[styles.body, styles.skeletonBody]}>
        <Bar width="70%" height={16} />
        <Bar width="85%" height={13} />
        <Bar width={120} height={12} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: 14,
    minHeight: 84,
  },
  lead: { width: LEAD_WIDTH, gap: 2 },
  leadMain: { ...type.body, ...type.tabular, fontWeight: "600", color: colors.text },
  leadSub: { ...type.label, ...type.tabular, color: colors.muted },
  body: { flex: 1, gap: 3 },
  skeletonBody: { gap: 8, paddingTop: 2 },
  titleLine: { flexDirection: "row", alignItems: "center", gap: space.sm },
  title: { ...type.body, fontWeight: "600", color: colors.text, flexShrink: 1 },
  meta: { ...type.label, color: colors.muted },
  seats: { flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: 5 },
  seatsText: { ...type.label, ...type.tabular, color: colors.muted, fontWeight: "500" },
  seatsOpen: { color: colors.text },
  distance: { ...type.label, ...type.tabular, color: colors.muted, marginLeft: -4 },
});
