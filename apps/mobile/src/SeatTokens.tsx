import { StyleSheet, Text, View } from "react-native";

import { initials } from "./format";
import { colors, radius, space } from "./theme";

/**
 * Roll Call's signature: seats drawn as pieces at a table.
 * A taken seat is a solid light disc. An open seat is a green ring, so the
 * only colour on a screen is exactly the number of seats you could take.
 * A full table has no green at all.
 */

const MAX_IN_STRIP = 12;

function Seat({
  open,
  size,
  label,
}: {
  open: boolean;
  size: number;
  label?: string;
}) {
  return (
    <View
      style={[
        { width: size, height: size, borderRadius: size / 2 },
        open ? [styles.open, { borderWidth: size >= 24 ? 2 : 1.5 }] : styles.taken,
      ]}
    >
      {label ? <Text style={[styles.seatLabel, { fontSize: Math.round(size * 0.36) }]}>{label}</Text> : null}
    </View>
  );
}

/** A compact row of seats for lists. */
export function SeatStrip({ taken, capacity }: { taken: number; capacity: number }) {
  const shown = Math.min(capacity, MAX_IN_STRIP);
  const extra = capacity - shown;
  return (
    <View style={styles.strip} accessible accessibilityLabel={`${capacity - taken} of ${capacity} seats open`}>
      {Array.from({ length: shown }, (_, i) => (
        <Seat key={i} open={i >= taken} size={12} />
      ))}
      {extra > 0 ? <Text style={styles.extra}>+{extra}</Text> : null}
    </View>
  );
}

/**
 * The table seen from above: seats along both long sides, the game's name on
 * the table. Seat 1 is the host's; the viewer's seat is marked when they have one.
 */
export function TableView({
  taken,
  capacity,
  centre,
  hostName,
  myName,
}: {
  taken: number;
  capacity: number;
  centre?: string;
  hostName?: string | null;
  myName?: string | null;
}) {
  const size = capacity > 12 ? 24 : 32;
  const seats = Array.from({ length: capacity }, (_, i) => {
    let label: string | undefined;
    if (i === 0 && hostName) label = initials(hostName);
    if (i === 1 && myName && taken >= 2) label = initials(myName);
    return { open: i >= taken, label };
  });
  // Alternate sides so the table fills evenly: seats 1, 3, 5 on top; 2, 4, 6 below
  const top = seats.filter((_, i) => i % 2 === 0);
  const bottom = seats.filter((_, i) => i % 2 === 1);

  return (
    <View
      style={styles.table}
      accessible
      accessibilityLabel={`${taken} of ${capacity} seats taken, ${capacity - taken} open`}
    >
      <View style={styles.side}>
        {top.map((s, i) => (
          <Seat key={i} open={s.open} size={size} label={s.label} />
        ))}
      </View>
      <View style={styles.board}>
        {centre ? (
          <Text style={styles.boardText} numberOfLines={1}>
            {centre}
          </Text>
        ) : null}
      </View>
      <View style={styles.side}>
        {bottom.map((s, i) => (
          <Seat key={i} open={s.open} size={size} label={s.label} />
        ))}
        {/* Keep the bottom row's spacing the same as the top's when the count is odd */}
        {bottom.length < top.length ? <View style={{ width: size }} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { flexDirection: "row", alignItems: "center", gap: 4 },
  taken: { backgroundColor: colors.taken, alignItems: "center", justifyContent: "center" },
  open: { borderColor: colors.seat },
  seatLabel: { color: colors.onPrimary, fontWeight: "600" },
  extra: { fontSize: 12, color: colors.muted, fontWeight: "500" },
  table: { gap: space.sm },
  side: { flexDirection: "row", justifyContent: "space-evenly", alignItems: "center" },
  board: {
    height: 64,
    borderRadius: radius.inner,
    backgroundColor: colors.raised,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.lg,
  },
  boardText: { fontSize: 13, color: colors.faint, fontWeight: "500" },
});
