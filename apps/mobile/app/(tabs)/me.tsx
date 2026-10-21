import { useFocusEffect, useRouter } from "expo-router";
import { Fragment, useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { getMyProfile, myEvents, type MyEvent, type Profile } from "../../src/api";
import { useApiErrorHandler, useAuth } from "../../src/auth";
import { EVENT_ROW_INSET, EventRow } from "../../src/EventRow";
import { useGames } from "../../src/games";
import { colors, space, type } from "../../src/theme";
import {
  Avatar,
  Bar,
  BlockError,
  Body,
  Card,
  EmptyBlock,
  ListRow,
  Rule,
  Screen,
  Section,
  SectionLabel,
  TextButton,
  type Tone,
} from "../../src/ui";

/** Profile answers: what am I playing next? */
export default function Me() {
  const router = useRouter();
  const { token, userId, username, signOut } = useAuth();
  const handleError = useApiErrorHandler();
  const { byId } = useGames();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [upcoming, setUpcoming] = useState<MyEvent[] | null>(null);
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

  const isHosting = (e: MyEvent) => e.host_user_id === userId;
  const statusFor = (e: MyEvent): { label: string; tone: Tone } => {
    if (isHosting(e)) return { label: "Hosting", tone: "neutral" };
    if (e.my_status === "going") return { label: "Going", tone: "positive" };
    return { label: "Waitlist", tone: "waiting" };
  };

  // The three counts are computed from the same list shown below them
  const rows = upcoming ?? [];
  const hosting = rows.filter(isHosting).length;
  const going = rows.filter((e) => !isHosting(e) && e.my_status === "going").length;
  const waiting = rows.filter((e) => !isHosting(e) && e.my_status === "waitlisted").length;

  const ownedGames = (profile?.game_ids ?? []).map((id) => byId.get(id)?.name).filter((n): n is string => !!n);
  const name = profile?.display_name ?? username ?? "";

  return (
    <Screen topInset refreshing={loading && !!profile} onRefresh={load}>
      <View style={styles.header}>
        <Avatar name={name || "?"} size={56} />
        <View style={styles.headerText}>
          {profile ? (
            <>
              <Text style={styles.name} numberOfLines={1} accessibilityRole="header">
                {name}
              </Text>
              <Text style={styles.area}>{profile.home_area ?? "No neighborhood set"}</Text>
            </>
          ) : (
            <>
              <Bar width="60%" height={24} />
              <Bar width="40%" height={15} />
            </>
          )}
        </View>
        <TextButton label="Edit" onPress={() => router.push("/profile/edit")} />
      </View>

      {error ? (
        <Card>
          <BlockError text={`Couldn't load your profile. ${error}`} onRetry={load} />
        </Card>
      ) : null}

      <Card>
        <View style={styles.counts}>
          {[
            { label: "Going", value: going },
            { label: "Waitlist", value: waiting },
            { label: "Hosting", value: hosting },
          ].map((c, i) => (
            <Fragment key={c.label}>
              {i > 0 ? <View style={styles.countRule} /> : null}
              <View style={styles.count}>
                <Text style={styles.countLabel}>{c.label}</Text>
                {upcoming ? <Text style={styles.countValue}>{c.value}</Text> : <Bar width={20} height={24} />}
              </View>
            </Fragment>
          ))}
        </View>
      </Card>

      <Section>
        <SectionLabel label="Coming up" />
        <Card>
          {upcoming && rows.length === 0 ? (
            <EmptyBlock
              text="Nothing on your calendar. Game nights you host or join show up here."
              action={{ label: "Find a game night", onPress: () => router.navigate("/") }}
            />
          ) : (
            rows.map((e, i) => (
              <Fragment key={e.id}>
                {i > 0 ? <Rule inset={EVENT_ROW_INSET} /> : null}
                <EventRow
                  event={e}
                  lead="date"
                  gameName={byId.get(e.game_id)?.name}
                  status={statusFor(e)}
                  onPress={() => router.push(`/events/${e.id}`)}
                />
              </Fragment>
            ))
          )}
        </Card>
      </Section>

      <Section>
        <SectionLabel label="Games I own" action={{ label: "Edit", onPress: () => router.push("/profile/edit") }} />
        <Card padded>
          {ownedGames.length > 0 ? (
            <Body>{ownedGames.join(", ")}</Body>
          ) : (
            <Body muted>Add the games you own so hosts know what you could bring.</Body>
          )}
        </Card>
      </Section>

      <Section>
        <SectionLabel label="Account" />
        <Card>
          <ListRow label="Signed in as" value={username ?? ""} />
          <Rule inset={space.lg} />
          <ListRow label="Sign out" onPress={signOut} destructive />
        </Card>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: space.md, paddingTop: space.md },
  headerText: { flex: 1, gap: 4 },
  name: { ...type.title, color: colors.text },
  area: { ...type.body, color: colors.muted },
  counts: { flexDirection: "row", paddingVertical: space.md },
  count: { flex: 1, paddingHorizontal: space.lg, gap: 2 },
  countRule: { width: 1, backgroundColor: colors.rule },
  countLabel: { ...type.label, color: colors.muted },
  countValue: { ...type.figure, color: colors.text },
});
