import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import type { EventSummary } from "./api";
import { Badge, Card, type IconName, type Tone } from "./components";
import { formatWhen, seatsLabel } from "./format";
import { colors } from "./theme";

function Meta({ icon, text }: { icon: IconName; text: string }) {
    return (
        <View style={styles.meta}>
            <Ionicons name={icon} size={14} color={colors.muted} />
            <Text style={styles.metaText} numberOfLines={1}>
                {text}
            </Text>
        </View>
    );
}

export function EventCard({
    event,
    gameName,
    distanceKm,
    badge,
    onPress,
}: {
    event: EventSummary;
    gameName?: string;
    distanceKm?: number;
    badge?: { label: string; tone: Tone };
    onPress: () => void;
}) {
    const full = event.seats_left <= 0;
    const where =
        distanceKm !== undefined
            ? `${event.location_name} · ${distanceKm} km away`
            : event.location_name;

    return (
        <Card onPress={onPress}>
            <View style={styles.top}>
                <Text style={styles.title} numberOfLines={1}>
                    {event.title}
                </Text>
                {badge ? <Badge label={badge.label} tone={badge.tone} /> : null}
            </View>
            <Text style={styles.game}>
                {gameName ?? `Game #${event.game_id}`}
            </Text>
            <Meta icon="time-outline" text={formatWhen(event.starts_at)} />
            <Meta icon="location-outline" text={where} />
            <View style={styles.bottom}>
                <Badge
                    label={seatsLabel(event)}
                    tone={full ? "warning" : "success"}
                />
            </View>
        </Card>
    );
}

const styles = StyleSheet.create({
    top: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
    },
    title: {
        fontSize: 17,
        fontWeight: "600",
        color: colors.text,
        flexShrink: 1,
    },
    game: { color: colors.primary, fontWeight: "500" },
    meta: { flexDirection: "row", alignItems: "center", gap: 6 },
    metaText: { color: colors.muted, fontSize: 13, flexShrink: 1 },
    bottom: { marginTop: 4 },
});
