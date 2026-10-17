import * as Location from "expo-location";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";

import { describeError, nearbyEvents, type NearbyEvent } from "../../src/api";
import { AREAS, type Area } from "../../src/areas";
import {
    Banner,
    Chip,
    ChipRow,
    EmptyState,
    Screen,
    SectionTitle,
} from "../../src/components";
import { EventCard } from "../../src/EventCard";
import { useGames } from "../../src/games";

const RADII = [5, 10, 25];

export default function Discover() {
    const router = useRouter();
    const { byId } = useGames();
    const [area, setArea] = useState<Area>(AREAS[0]);
    const [radiusKm, setRadiusKm] = useState(10);
    const [events, setEvents] = useState<NearbyEvent[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            setEvents(await nearbyEvents(area.lat, area.lng, radiusKm));
        } catch (e) {
            setError(describeError(e));
        } finally {
            setLoading(false);
        }
    }, [area, radiusKm]);

    useFocusEffect(
        useCallback(() => {
            load();
        }, [load]),
    );

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

    return (
        <Screen refreshing={loading} onRefresh={load}>
            <SectionTitle>AREA</SectionTitle>
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

            <SectionTitle>DISTANCE</SectionTitle>
            <ChipRow>
                {RADII.map((r) => (
                    <Chip
                        key={r}
                        label={`${r} km`}
                        selected={radiusKm === r}
                        onPress={() => setRadiusKm(r)}
                    />
                ))}
            </ChipRow>

            <Banner text={error} />

            {!loading && !error && events.length === 0 ? (
                <EmptyState
                    icon="dice-outline"
                    title="No game nights nearby yet"
                    body={`Nothing within ${radiusKm} km of ${area.label}. Try a wider radius, or host one from the Host tab.`}
                />
            ) : null}

            {events.map((e) => (
                <EventCard
                    key={e.id}
                    event={e}
                    gameName={byId.get(e.game_id)?.name}
                    distanceKm={e.distance_km}
                    onPress={() => router.push(`/events/${e.id}`)}
                />
            ))}
        </Screen>
    );
}
