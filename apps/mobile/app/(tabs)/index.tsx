import { useFocusEffect, useRouter } from "expo-router";
import { Fragment, useCallback, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

import { describeError, nearbyEvents, type NearbyEvent } from "../../src/api";
import { AREAS, type Area } from "../../src/areas";
import { AreaButton, AreaSheet } from "../../src/AreaSheet";
import { EVENT_ROW_INSET, EventRow, EventRowSkeleton } from "../../src/EventRow";
import { groupByDay, isSameDay, openSeatsPhrase } from "../../src/format";
import { useGames } from "../../src/games";
import { currentArea } from "../../src/location";
import { space } from "../../src/theme";
import {
  Bar,
  BlockError,
  Card,
  Chip,
  ChipScroller,
  EmptyBlock,
  Notice,
  Rule,
  Screen,
  ScreenTitle,
  Section,
  SectionLabel,
  Wordmark,
} from "../../src/ui";

type Filter = "all" | "today" | "open";

/** Discover answers one question: is there a seat for me near here, soon? */
export default function Discover() {
  const router = useRouter();
  const { byId } = useGames();
  const [area, setArea] = useState<Area>(AREAS[0]);
  const [radiusKm, setRadiusKm] = useState(10);
  const [filter, setFilter] = useState<Filter>("all");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [events, setEvents] = useState<NearbyEvent[]>([]);
  const [now, setNow] = useState<number | null>(null); // when the list was loaded
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const next = await nearbyEvents(area.lat, area.lng, radiusKm);
      setEvents(next);
      setError(null);
      setNow(Date.now());
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
    setSheetOpen(false);
    const result = await currentArea();
    if ("error" in result) setLocationError(result.error);
    else {
      setLocationError(null);
      setArea(result.area);
    }
  };

  // Every count on screen comes from the rows loaded for this area and distance
  const counts = useMemo(() => {
    const today = now === null ? [] : events.filter((e) => isSameDay(e.starts_at, now));
    return {
      all: events.length,
      today: today.length,
      open: events.filter((e) => e.seats_left > 0).length,
      openToday: today.reduce((sum, e) => sum + Math.max(0, e.seats_left), 0),
      openAll: events.reduce((sum, e) => sum + Math.max(0, e.seats_left), 0),
    };
  }, [events, now]);

  const shown = useMemo(() => {
    if (filter === "today" && now !== null) return events.filter((e) => isSameDay(e.starts_at, now));
    if (filter === "open") return events.filter((e) => e.seats_left > 0);
    return events;
  }, [events, filter, now]);

  const days = useMemo(() => groupByDay(shown), [shown]);
  const where = area.label === "Near me" ? "you" : area.label;
  const loaded = now !== null;

  // The finding: the line under the title says what's open soonest
  let finding = `Looking within ${radiusKm} km of ${where}`;
  if (loaded && events.length === 0) finding = `Nothing posted within ${radiusKm} km of ${where} yet`;
  else if (loaded && counts.today > 0) finding = `${openSeatsPhrase(counts.openToday)} today within ${radiusKm} km`;
  else if (loaded) finding = `Nothing today. ${openSeatsPhrase(counts.openAll)} coming up within ${radiusKm} km`;

  const emptyText =
    filter === "today"
      ? `No game nights today within ${radiusKm} km of ${where}.`
      : filter === "open"
        ? `Every table within ${radiusKm} km is full. You can still join a waitlist from All.`
        : `Nobody has posted a game night within ${radiusKm} km of ${where}. Try a wider distance, or host the first one.`;

  return (
    <Screen topInset refreshing={loading && loaded} onRefresh={load}>
      <View style={styles.topBar}>
        <Wordmark />
        <AreaButton area={area} radiusKm={radiusKm} onPress={() => setSheetOpen(true)} />
      </View>

      <View style={styles.head}>
        <ScreenTitle title="Game nights" subtitle={finding} />
        <ChipScroller>
          <Chip label="All" count={loaded ? counts.all : undefined} selected={filter === "all"} onPress={() => setFilter("all")} />
          <Chip label="Today" count={loaded ? counts.today : undefined} selected={filter === "today"} onPress={() => setFilter("today")} />
          <Chip
            label="Open seats"
            count={loaded ? counts.open : undefined}
            selected={filter === "open"}
            onPress={() => setFilter("open")}
          />
        </ChipScroller>
      </View>

      <Notice text={locationError} />

      {error ? (
        <Card>
          <BlockError text={`Couldn't load game nights. ${error}`} onRetry={load} />
        </Card>
      ) : null}

      {!loaded && !error ? (
        <Section>
          <View style={styles.labelBar}>
            <Bar width={64} height={13} />
          </View>
          <Card>
            {[0, 1, 2].map((i) => (
              <Fragment key={i}>
                {i > 0 ? <Rule inset={EVENT_ROW_INSET} /> : null}
                <EventRowSkeleton />
              </Fragment>
            ))}
          </Card>
        </Section>
      ) : null}

      {loaded && shown.length === 0 ? (
        <Card>
          <EmptyBlock
            text={emptyText}
            action={filter === "all" ? { label: "Host a game night", onPress: () => router.navigate("/host") } : undefined}
          />
        </Card>
      ) : null}

      {days.map((day) => (
        <Section key={day.label}>
          <SectionLabel label={day.label} />
          <Card>
            {day.items.map((e, i) => (
              <Fragment key={e.id}>
                {i > 0 ? <Rule inset={EVENT_ROW_INSET} /> : null}
                <EventRow
                  event={e}
                  gameName={byId.get(e.game_id)?.name}
                  distanceKm={e.distance_km}
                  onPress={() => router.push(`/events/${e.id}`)}
                />
              </Fragment>
            ))}
          </Card>
        </Section>
      ))}

      <AreaSheet
        visible={sheetOpen}
        area={area}
        radiusKm={radiusKm}
        onPickArea={(a) => {
          setLocationError(null);
          setArea(a);
        }}
        onPickMyLocation={pickMyLocation}
        onPickRadius={setRadiusKm}
        onClose={() => setSheetOpen(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.md,
    minHeight: 52,
  },
  head: { gap: space.lg, marginTop: -space.md },
  labelBar: { minHeight: 24, justifyContent: "center" },
});
