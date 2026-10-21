import { useFocusEffect, useRouter } from "expo-router";
import { Fragment, useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { Notification } from "../../src/api";
import { formatTime, timeAgo } from "../../src/format";
import { useInbox } from "../../src/inbox";
import { colors, space, type } from "../../src/theme";
import {
  Bar,
  BlockError,
  Card,
  EmptyBlock,
  rowPressedStyle,
  Rule,
  Screen,
  ScreenTitle,
  Section,
  SectionLabel,
} from "../../src/ui";

const MARK = 14;
const ROW_INSET = space.lg + MARK + space.md;

/**
 * Each notice carries the seat it is about, in the same marks as the table:
 * a light disc is a seat filled, a green ring a seat that opened, a dashed
 * ring someone waiting.
 */
function SeatMark({ kind }: { kind: string }) {
  if (kind === "seat_given_up" || kind === "seat_offered") return <View style={[styles.mark, styles.markOpen]} />;
  if (kind === "waitlist_joined") return <View style={[styles.mark, styles.markWaiting]} />;
  return <View style={[styles.mark, styles.markTaken]} />;
}

function NotificationRow({ n, now, onPress }: { n: Notification; now: number; onPress: () => void }) {
  const unread = !n.read_at;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${unread ? "Unread. " : ""}${n.title}. ${n.body}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && rowPressedStyle]}
    >
      <View style={styles.markLane}>
        <SeatMark kind={n.kind} />
      </View>
      <View style={styles.body}>
        <Text style={[styles.body1, unread && styles.unread]}>{n.body}</Text>
        <Text style={styles.meta} numberOfLines={1}>
          {n.title}
        </Text>
      </View>
      <View style={styles.trail}>
        <Text style={styles.time}>{timeAgo(n.created_at, now)}</Text>
        {unread ? <View style={styles.dot} /> : null}
      </View>
    </Pressable>
  );
}

/** Inbox answers: what changed at my tables since I last looked? */
export default function InboxScreen() {
  const router = useRouter();
  const { inbox, error, refreshedAt, refresh, read, readAll } = useInbox();
  const [refreshing, setRefreshing] = useState(false);

  const pull = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const open = (n: Notification) => {
    void read(n.id);
    if (n.event_id !== null) router.push(`/events/${n.event_id}`);
  };

  const items = inbox?.items ?? [];
  const fresh = items.filter((n) => !n.read_at);
  const earlier = items.filter((n) => n.read_at);
  const unread = inbox?.unread_count ?? 0;
  const now = refreshedAt ?? 0;

  let subtitle = "Seats taken, given up and opened at your tables";
  if (inbox && refreshedAt !== null) {
    subtitle = `${unread === 0 ? "All read" : `${unread} unread`} · updated ${formatTime(new Date(refreshedAt).toISOString())}`;
  }

  const list = (rows: Notification[]) => (
    <Card>
      {rows.map((n, i) => (
        <Fragment key={n.id}>
          {i > 0 ? <Rule inset={ROW_INSET} /> : null}
          <NotificationRow n={n} now={now} onPress={() => open(n)} />
        </Fragment>
      ))}
    </Card>
  );

  return (
    <Screen topInset refreshing={refreshing} onRefresh={pull}>
      <ScreenTitle
        title="Inbox"
        subtitle={subtitle}
        action={unread > 0 ? { label: "Mark all read", onPress: () => void readAll() } : undefined}
      />

      {error ? (
        <Card>
          <BlockError
            text={
              refreshedAt === null
                ? `Couldn't load your inbox. ${error}`
                : `Couldn't check for new updates. Showing what loaded at ${formatTime(new Date(refreshedAt).toISOString())}.`
            }
            onRetry={pull}
          />
        </Card>
      ) : null}

      {!inbox && !error ? (
        <Card>
          {[0, 1, 2].map((i) => (
            <Fragment key={i}>
              {i > 0 ? <Rule inset={ROW_INSET} /> : null}
              <View style={styles.row}>
                <View style={styles.markLane}>
                  <View style={[styles.mark, styles.markSkeleton]} />
                </View>
                <View style={[styles.body, styles.skeletonBody]}>
                  <Bar width="75%" height={15} />
                  <Bar width="45%" height={13} />
                </View>
              </View>
            </Fragment>
          ))}
        </Card>
      ) : null}

      {inbox && items.length === 0 ? (
        <Card>
          <EmptyBlock
            text="Nothing yet. When players take or give up seats at your tables, or a seat opens up for you, it shows up here."
            action={{ label: "Host a game night", onPress: () => router.navigate("/host") }}
          />
        </Card>
      ) : null}

      {fresh.length > 0 ? (
        <Section>
          <SectionLabel label="New" />
          {list(fresh)}
        </Section>
      ) : null}

      {earlier.length > 0 ? (
        <Section>
          <SectionLabel label="Earlier" />
          {list(earlier)}
        </Section>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: 14,
    minHeight: 68,
  },
  markLane: { width: MARK, paddingTop: 4 },
  mark: { width: MARK, height: MARK, borderRadius: MARK / 2 },
  markTaken: { backgroundColor: colors.taken },
  markOpen: { borderWidth: 2, borderColor: colors.seat },
  markWaiting: { borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.waiting },
  markSkeleton: { backgroundColor: colors.raised },
  body: { flex: 1, gap: 2 },
  skeletonBody: { gap: 8, paddingTop: 2 },
  body1: { ...type.body, color: colors.muted },
  unread: { color: colors.text, fontWeight: "500" },
  meta: { ...type.label, color: colors.muted },
  trail: { alignItems: "flex-end", gap: 8, paddingTop: 2 },
  time: { ...type.label, ...type.tabular, color: colors.muted },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.text },
});
