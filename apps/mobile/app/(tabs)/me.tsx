import { useFocusEffect, useRouter } from "expo-router";
import { Fragment, useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { getMyProfile, myEvents, type MyEvent, type Profile } from "../../src/api";
import { useApiErrorHandler, useAuth } from "../../src/auth";
import { EventRow } from "../../src/EventRow";
import { useGames } from "../../src/games";
import { colors, space, type } from "../../src/theme";
import {
  Avatar,
  Body,
  Button,
  Divider,
  EmptyState,
  Group,
  ListRow,
  Notice,
  Screen,
  Section,
  type Tone,
} from "../../src/ui";

export default function Me() {
  const router = useRouter();
  const { token, userId, username, signOut } = useAuth();
  const handleError = useApiErrorHandler();
  const { byId } = useGames();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [upcoming, setUpcoming] = useState<MyEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [p, mine] = await Promise.all([getMyProfile(token), myEvents(token)]);
      setProfile(p);
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

  const statusFor = (e: MyEvent): { label: string; tone: Tone } => {
    if (e.host_user_id === userId) return { label: "Hosting", tone: "neutral" };
    if (e.my_status === "going") return { label: "Going", tone: "positive" };
    return { label: "Waitlist", tone: "waiting" };
  };

  const ownedGames = (profile?.game_ids ?? [])
    .map((id) => byId.get(id)?.name)
    .filter((n): n is string => !!n);

  return (
    <Screen topInset refreshing={loading} onRefresh={load}>
      <View style={styles.header}>
        <Avatar name={profile?.display_name ?? username ?? "?"} id={userId} size={72} />
        <View style={styles.headerText}>
          <Text style={styles.name} numberOfLines={2}>
            {profile?.display_name ?? " "}
          </Text>
          <Text style={styles.area}>{profile?.home_area ?? "No neighborhood set"}</Text>
        </View>
      </View>
      <Button label="Edit profile" variant="secondary" onPress={() => router.push("/profile/edit")} />

      <Notice text={error} />

      <Section title="Coming up">
        {upcoming.length === 0 && !loading ? (
          <EmptyState
            icon="calendar-outline"
            title="Nothing on your calendar"
            body="Game nights you host or join will show up here."
            action={{ label: "Find a game night", onPress: () => router.navigate("/") }}
          />
        ) : (
          <Group>
            {upcoming.map((e, i) => (
              <Fragment key={e.id}>
                {i > 0 ? <Divider inset={space.lg + 48 + space.md} /> : null}
                <EventRow
                  event={e}
                  lead="date"
                  gameName={byId.get(e.game_id)?.name}
                  status={statusFor(e)}
                  onPress={() => router.push(`/events/${e.id}`)}
                />
              </Fragment>
            ))}
          </Group>
        )}
      </Section>

      <Section title="Games I own" action={{ label: "Edit", onPress: () => router.push("/profile/edit") }}>
        {ownedGames.length > 0 ? (
          <Body>{ownedGames.join(", ")}</Body>
        ) : (
          <Body muted>Add the games you own so hosts know what you can bring.</Body>
        )}
      </Section>

      <Section title="Account">
        <Group>
          <View style={styles.signedIn}>
            <Text style={styles.signedInLabel}>Signed in as</Text>
            <Text style={styles.signedInValue}>{username}</Text>
          </View>
          <Divider />
          <ListRow icon="log-out-outline" label="Sign out" onPress={signOut} destructive />
        </Group>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: space.lg, paddingTop: space.lg },
  headerText: { flex: 1, gap: 2 },
  name: { ...type.title, color: colors.ink },
  area: { ...type.secondary, color: colors.slate },
  signedIn: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: space.lg,
    paddingVertical: 14,
  },
  signedInLabel: { ...type.body, color: colors.ink },
  signedInValue: { ...type.body, color: colors.slate },
});
