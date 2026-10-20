import { StyleSheet, Text, View } from "react-native";

import { colors, pieces } from "./theme";

const MAX_SHOWN = 12;

/**
 * Seats drawn as player pieces: taken seats are filled in player colors,
 * open seats are dashed outlines.
 */
export function SeatTokens({
  taken,
  capacity,
  size = "sm",
}: {
  taken: number;
  capacity: number;
  size?: "sm" | "lg";
}) {
  const d = size === "lg" ? 30 : 14;
  const gap = size === "lg" ? 8 : 4;
  const shown = Math.min(capacity, MAX_SHOWN);
  const extra = capacity - shown;

  return (
    <View
      style={[styles.row, { gap }]}
      accessible
      accessibilityLabel={`${taken} of ${capacity} seats taken`}
    >
      {Array.from({ length: shown }, (_, i) => {
        const filled = i < taken;
        return (
          <View
            key={i}
            style={[
              { width: d, height: d, borderRadius: d / 2 },
              filled
                ? [styles.filled, { backgroundColor: pieces[i % pieces.length] }]
                : styles.empty,
              size === "lg" && filled && styles.filledLarge,
            ]}
          />
        );
      })}
      {extra > 0 ? <Text style={styles.extra}>+{extra}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", flexWrap: "wrap" },
  // A darker lower edge makes the disc read as a physical wooden piece
  filled: { borderBottomWidth: 2, borderBottomColor: "rgba(0,0,0,0.22)" },
  filledLarge: { borderBottomWidth: 4 },
  empty: { borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.faint },
  extra: { fontSize: 13, color: colors.slate, fontWeight: "600" },
});
