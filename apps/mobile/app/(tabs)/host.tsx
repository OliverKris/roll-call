import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { createEvent } from "../../src/api";
import { AREAS, type Area } from "../../src/areas";
import { useApiErrorHandler, useAuth } from "../../src/auth";
import {
    Banner,
    Button,
    Chip,
    ChipRow,
    Field,
    Muted,
    Screen,
    SectionTitle,
} from "../../src/components";
import { useGames } from "../../src/games";
import { colors, radius } from "../../src/theme";

const HOURS = [17, 18, 19, 20, 21];

function dayOptions() {
    return Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() + i + 1);
        return {
            offset: i + 1,
            label: d.toLocaleDateString(undefined, {
                weekday: "short",
                day: "numeric",
            }),
        };
    });
}

const hourLabel = (h: number) => `${h > 12 ? h - 12 : h} PM`;

export default function Host() {
    const router = useRouter();
    const { token } = useAuth();
    const handleError = useApiErrorHandler();
    const { games } = useGames();
    const days = useMemo(() => dayOptions(), []);

    const [title, setTitle] = useState("");
    const [gameId, setGameId] = useState<number | null>(null);
    const [dayOffset, setDayOffset] = useState(1);
    const [hour, setHour] = useState(19);
    const [locationName, setLocationName] = useState("");
    const [area, setArea] = useState<Area>(AREAS[0]);
    const [capacity, setCapacity] = useState(4);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const pickMyLocation = async () => {
        try {
            const { status } =
                await Location.requestForegroundPermissionsAsync();
            if (status !== "granted") {
                setError(
                    "Location permission was denied. Pick an area instead.",
                );
                return;
            }
            const pos = await Location.getCurrentPositionAsync({});
            setError(null);
            setArea({
                label: "Near me",
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
            });
        } catch {
            setError("Couldn't get your location. Pick an area instead.");
        }
    };

    const submit = async () => {
        if (!token) return;
        if (!title.trim() || !gameId || !locationName.trim()) {
            setError("Add a title, pick a game, and say where you're playing.");
            return;
        }
        const starts = new Date();
        starts.setDate(starts.getDate() + dayOffset);
        starts.setHours(hour, 0, 0, 0);

        setBusy(true);
        setError(null);
        try {
            const created = await createEvent(token, {
                title: title.trim(),
                game_id: gameId,
                starts_at: starts.toISOString(),
                location_name: locationName.trim(),
                latitude: area.lat,
                longitude: area.lng,
                capacity,
            });
            setTitle("");
            setLocationName("");
            router.push(`/events/${created.id}`);
        } catch (e) {
            setError(handleError(e));
        } finally {
            setBusy(false);
        }
    };

    return (
        <Screen>
            <Banner text={error} />

            <Field
                label="Title"
                value={title}
                onChangeText={setTitle}
                placeholder="Catan & snacks"
            />

            <SectionTitle>GAME</SectionTitle>
            <ChipRow>
                {games.map((g) => (
                    <Chip
                        key={g.id}
                        label={g.name}
                        selected={gameId === g.id}
                        onPress={() => setGameId(g.id)}
                    />
                ))}
            </ChipRow>

            <SectionTitle>DAY</SectionTitle>
            <ChipRow>
                {days.map((d) => (
                    <Chip
                        key={d.offset}
                        label={d.label}
                        selected={dayOffset === d.offset}
                        onPress={() => setDayOffset(d.offset)}
                    />
                ))}
            </ChipRow>

            <SectionTitle>TIME</SectionTitle>
            <ChipRow>
                {HOURS.map((h) => (
                    <Chip
                        key={h}
                        label={hourLabel(h)}
                        selected={hour === h}
                        onPress={() => setHour(h)}
                    />
                ))}
            </ChipRow>

            <Field
                label="Where"
                value={locationName}
                onChangeText={setLocationName}
                placeholder="Brooklyn Board Game Cafe"
            />
            <ChipRow>
                <Chip
                    label="Near me"
                    icon="navigate-outline"
                    selected={area.label === "Near me"}
                    onPress={pickMyLocation}
                />
                {AREAS.map((a) => (
                    <Chip
                        key={a.label}
                        label={a.label}
                        selected={area.label === a.label}
                        onPress={() => setArea(a)}
                    />
                ))}
            </ChipRow>

            <SectionTitle>SEATS (INCLUDING YOU)</SectionTitle>
            <View style={styles.stepper}>
                <Button
                    label="−"
                    variant="secondary"
                    onPress={() => setCapacity((c) => Math.max(2, c - 1))}
                />
                <Text style={styles.count}>{capacity}</Text>
                <Button
                    label="+"
                    variant="secondary"
                    onPress={() => setCapacity((c) => Math.min(20, c + 1))}
                />
            </View>
            <Muted>
                When it fills up, new players join a waitlist automatically.
            </Muted>

            <Button
                label="Post game night"
                icon="megaphone-outline"
                onPress={submit}
                loading={busy}
            />
        </Screen>
    );
}

const styles = StyleSheet.create({
    stepper: {
        flexDirection: "row",
        alignItems: "center",
        gap: 16,
        backgroundColor: colors.card,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 8,
        alignSelf: "flex-start",
    },
    count: {
        fontSize: 20,
        fontWeight: "700",
        minWidth: 28,
        textAlign: "center",
        color: colors.text,
    },
});
