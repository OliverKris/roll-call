import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import {
    getMyProfile,
    myEvents,
    setMyGames,
    updateMyProfile,
    type MyEvent,
    type Profile,
} from "../../src/api";
import { useApiErrorHandler, useAuth } from "../../src/auth";
import {
    Banner,
    Button,
    Card,
    Chip,
    ChipRow,
    EmptyState,
    Field,
    Muted,
    Screen,
    SectionTitle,
} from "../../src/components";
import { EventCard } from "../../src/EventCard";
import { useGames } from "../../src/games";
import { colors } from "../../src/theme";

export default function Me() {
    const router = useRouter();
    const { token, userId, username, signOut } = useAuth();
    const handleError = useApiErrorHandler();
    const { games, byId } = useGames();

    const [profile, setProfile] = useState<Profile | null>(null);
    const [name, setName] = useState("");
    const [area, setArea] = useState("");
    const [owned, setOwned] = useState<Set<number>>(new Set());
    const [upcoming, setUpcoming] = useState<MyEvent[]>([]);
    const [loading, setLoading] = useState(false);
    const [busy, setBusy] = useState<"profile" | "games" | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    const load = useCallback(async () => {
        if (!token) return;
        setLoading(true);
        try {
            const [p, mine] = await Promise.all([
                getMyProfile(token),
                myEvents(token),
            ]);
            setProfile(p);
            setName(p.display_name);
            setArea(p.home_area ?? "");
            setOwned(new Set(p.game_ids));
            setUpcoming(mine);
            setError(null);
        } catch (e) {
            setError(handleError(e));
        } finally {
            setLoading(false);
        }
    }, [token, handleError]);

    useFocusEffect(
        useCallback(() => {
            load();
        }, [load]),
    );

    const gamesChanged = useMemo(() => {
        const saved = [...(profile?.game_ids ?? [])].sort().join(",");
        return saved !== [...owned].sort().join(",");
    }, [profile, owned]);

    const profileChanged =
        !!profile &&
        (name.trim() !== profile.display_name ||
            (area.trim() || null) !== profile.home_area);

    const toggle = (id: number) =>
        setOwned((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });

    const save = async (what: "profile" | "games") => {
        if (!token || !profile) return;
        setBusy(what);
        setError(null);
        setNotice(null);
        try {
            const updated =
                what === "profile"
                    ? await updateMyProfile(token, {
                          display_name: name.trim(),
                          home_area: area.trim() || null,
                          bio: profile.bio,
                      })
                    : await setMyGames(token, [...owned]);
            setProfile(updated);
            setOwned(new Set(updated.game_ids));
            setNotice(
                what === "profile" ? "Profile saved." : "Your games are saved.",
            );
        } catch (e) {
            setError(handleError(e));
        } finally {
            setBusy(null);
        }
    };

    const badgeFor = (e: MyEvent) =>
        e.host_user_id === userId
            ? { label: "Hosting", tone: "primary" as const }
            : e.my_status === "going"
              ? { label: "Going", tone: "success" as const }
              : { label: "Waitlisted", tone: "warning" as const };

    return (
        <Screen refreshing={loading} onRefresh={load}>
            <Banner text={error} />
            <Banner text={notice} tone="success" />

            <Card>
                <Text style={styles.name}>{profile?.display_name ?? "…"}</Text>
                <Muted>Signed in as {username}</Muted>
            </Card>

            <SectionTitle>PROFILE</SectionTitle>
            <Field label="Display name" value={name} onChangeText={setName} />
            <Field
                label="Home area"
                value={area}
                onChangeText={setArea}
                placeholder="e.g. Park Slope"
            />
            <Button
                label="Save profile"
                variant="secondary"
                onPress={() => save("profile")}
                disabled={!profileChanged || !name.trim()}
                loading={busy === "profile"}
            />

            <SectionTitle>GAMES I OWN</SectionTitle>
            <ChipRow>
                {games.map((g) => (
                    <Chip
                        key={g.id}
                        label={g.name}
                        selected={owned.has(g.id)}
                        onPress={() => toggle(g.id)}
                    />
                ))}
            </ChipRow>
            <Button
                label="Save games"
                variant="secondary"
                onPress={() => save("games")}
                disabled={!gamesChanged}
                loading={busy === "games"}
            />

            <SectionTitle>MY UPCOMING GAME NIGHTS</SectionTitle>
            {upcoming.length === 0 && !loading ? (
                <EmptyState
                    icon="calendar-outline"
                    title="Nothing planned yet"
                    body="Join a game night from Discover, or host your own."
                />
            ) : null}
            {upcoming.map((e) => (
                <EventCard
                    key={e.id}
                    event={e}
                    gameName={byId.get(e.game_id)?.name}
                    badge={badgeFor(e)}
                    onPress={() => router.push(`/events/${e.id}`)}
                />
            ))}

            <View style={styles.signOut}>
                <Button
                    label="Sign out"
                    variant="danger"
                    icon="log-out-outline"
                    onPress={signOut}
                />
            </View>
        </Screen>
    );
}

const styles = StyleSheet.create({
    name: { fontSize: 22, fontWeight: "700", color: colors.text },
    signOut: { marginTop: 24 },
});
