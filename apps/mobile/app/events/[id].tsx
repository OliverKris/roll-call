import { Ionicons } from "@expo/vector-icons";
import {
    Redirect,
    Stack,
    useFocusEffect,
    useLocalSearchParams,
} from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import {
    getEvent,
    getMyRsvp,
    joinEvent,
    leaveEvent,
    type EventSummary,
    type Rsvp,
} from "../../src/api";
import { useApiErrorHandler, useAuth } from "../../src/auth";
import {
    Badge,
    Banner,
    Button,
    Card,
    Muted,
    Screen,
    SeatsBar,
    type IconName,
} from "../../src/components";
import { formatWhen, seatsLabel } from "../../src/format";
import { useGames } from "../../src/games";
import { colors } from "../../src/theme";

function Row({ icon, text }: { icon: IconName; text: string }) {
    return (
        <View style={styles.row}>
            <Ionicons name={icon} size={18} color={colors.muted} />
            <Text style={styles.rowText}>{text}</Text>
        </View>
    );
}

export default function EventDetail() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const eventId = Number(id);
    const { token, userId } = useAuth();
    const handleError = useApiErrorHandler();
    const { byId } = useGames();

    const [event, setEvent] = useState<EventSummary | null>(null);
    const [rsvp, setRsvp] = useState<Rsvp | null>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    const load = useCallback(async () => {
        if (!token) return;
        setLoading(true);
        try {
            const [e, r] = await Promise.all([
                getEvent(eventId),
                getMyRsvp(token, eventId),
            ]);
            setEvent(e);
            setRsvp(r);
            setError(null);
        } catch (e) {
            setError(handleError(e));
        } finally {
            setLoading(false);
        }
    }, [eventId, token, handleError]);

    useFocusEffect(
        useCallback(() => {
            load();
        }, [load]),
    );

    if (!token) return <Redirect href="/login" />;

    const act = async (fn: () => Promise<string>) => {
        setBusy(true);
        setError(null);
        setNotice(null);
        try {
            setNotice(await fn());
            await load();
        } catch (e) {
            setError(handleError(e));
        } finally {
            setBusy(false);
        }
    };

    const join = () =>
        act(async () => {
            const r = await joinEvent(token, eventId);
            return r.status === "going"
                ? "You're in! See you there."
                : "It's full, so you're on the waitlist. You'll get the next open seat.";
        });

    const leave = () =>
        act(async () => {
            await leaveEvent(token, eventId);
            return rsvp?.status === "waitlisted"
                ? "You left the waitlist."
                : "You gave up your seat.";
        });

    const game = event ? byId.get(event.game_id) : undefined;
    const isHost = !!event && event.host_user_id === userId;
    const full = !!event && event.seats_left <= 0;

    return (
        <Screen refreshing={loading} onRefresh={load}>
            <Stack.Screen options={{ title: event?.title ?? "Game night" }} />
            <Banner text={error} />
            <Banner text={notice} tone="success" />

            {event ? (
                <>
                    <Card>
                        <Text style={styles.title}>{event.title}</Text>
                        <Text style={styles.game}>
                            {game?.name ?? `Game #${event.game_id}`}
                        </Text>
                        {game ? (
                            <Muted>
                                {game.min_players}–{game.max_players} players ·
                                about {game.play_time_minutes} min
                            </Muted>
                        ) : null}
                        <View style={styles.rows}>
                            <Row
                                icon="time-outline"
                                text={formatWhen(event.starts_at)}
                            />
                            <Row
                                icon="location-outline"
                                text={event.location_name}
                            />
                        </View>
                        {event.description ? (
                            <Text style={styles.desc}>{event.description}</Text>
                        ) : null}
                    </Card>

                    <Card>
                        <View style={styles.seatsHeader}>
                            <Text style={styles.seatsTitle}>Seats</Text>
                            <Badge
                                label={seatsLabel(event)}
                                tone={full ? "warning" : "success"}
                            />
                        </View>
                        <SeatsBar
                            taken={event.seats_taken}
                            capacity={event.capacity}
                        />
                        <Muted>
                            {event.seats_taken} of {event.capacity} taken
                        </Muted>
                    </Card>

                    {isHost ? (
                        <Card>
                            <Badge label="You're hosting" tone="primary" />
                            <Muted>
                                Players can join until the table is full. After
                                that they join the waitlist.
                            </Muted>
                        </Card>
                    ) : rsvp ? (
                        <>
                            <Card>
                                <Badge
                                    label={
                                        rsvp.status === "going"
                                            ? "You're going"
                                            : "You're on the waitlist"
                                    }
                                    tone={
                                        rsvp.status === "going"
                                            ? "success"
                                            : "warning"
                                    }
                                />
                            </Card>
                            <Button
                                label={
                                    rsvp.status === "going"
                                        ? "Give up my seat"
                                        : "Leave waitlist"
                                }
                                variant="danger"
                                onPress={leave}
                                loading={busy}
                            />
                        </>
                    ) : (
                        <Button
                            label={
                                full
                                    ? "Join the waitlist"
                                    : "Join this game night"
                            }
                            icon={
                                full
                                    ? "hourglass-outline"
                                    : "checkmark-circle-outline"
                            }
                            onPress={join}
                            loading={busy}
                        />
                    )}
                </>
            ) : null}
        </Screen>
    );
}

const styles = StyleSheet.create({
    title: { fontSize: 24, fontWeight: "700", color: colors.text },
    game: { fontSize: 16, color: colors.primary, fontWeight: "600" },
    rows: { gap: 8, marginTop: 8 },
    row: { flexDirection: "row", alignItems: "center", gap: 8 },
    rowText: { color: colors.text, fontSize: 15, flexShrink: 1 },
    desc: { marginTop: 8, color: colors.text, lineHeight: 20 },
    seatsHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    seatsTitle: { fontWeight: "600", fontSize: 16, color: colors.text },
});
