import { useFocusEffect, useRouter } from "expo-router";
import { Fragment, useCallback, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

import { describeError, nearbyEvents, type NearbyEvent } from "../../src/api";
import { AREAS, type Area } from "../../src/areas";
import { EventRow } from "../../src/EventRow";
import { groupByDay } from "../../src/format";
import { useGames } from "../../src/games";
import { currentArea } from "../../src/location";
import { space } from "../../src/theme";
import {
  Divider,
  EmptyState,
  Group,
  LargeTitle,
  Notice,
  Pill,
  PillScroller,
  Screen,
  Section,
  Segmented,
} from "../../src/ui";

const RADII = [
  { value: 5, label: "5 km" },
  { value: 10, label: "10 km" },
  { value: 25, label: "25 km" },
];

export default function Discover() {
  const router = useRouter();
  const { byId } = useGames();
  const [area, setArea] = useState<Area>(AREAS[0]);
  const [radiusKm, setRadiusKm] = useState(10);
  const [events, setEvents] = useState<NearbyEvent[]>([]);
  const [loaded, setLoaded] = useState(false);
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
      setLoaded(true);
    }
  }, [area, radiusKm]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const pickMyLocation = async () => {
    const result = await currentArea();
    if ("error" in result) setError(result.error);
    else setArea(result.area);
  };

  const days = useMemo(() => groupByDay(events), [events]);
  const where = area.label === "Near me" ? "you" : area.label;

  return (
    <Screen topInset refreshing={loading} onRefresh={load}>
      <LargeTitle title="Game nights" subtitle={`Within ${radiusKm} km of ${where}`} />

      <View style={styles.filters}>
        <PillScroller>
          <Pill
            label="Near me"
            icon="navigate"
            selected={area.label === "Near me"}
            onPress={pickMyLocation}
          />
          {AREAS.map((a) => (
            <Pill
              key={a.label}
              label={a.label}
              selected={area.label === a.label}
              onPress={() => setArea(a)}
            />
          ))}
        </PillScroller>
        <Segmented options={RADII} value={radiusKm} onChange={setRadiusKm} />
      </View>

      <Notice text={error} />

      {loaded && !error && events.length === 0 ? (
        <EmptyState
          icon="dice-outline"
          title="No game nights here yet"
          body={`Nobody has posted a game night within ${radiusKm} km of ${where}. Try a wider distance, or host the first one.`}
          action={{ label: "Host a game night", onPress: () => router.navigate("/host") }}
        />
      ) : null}

      {days.map((day) => (
        <Section key={day.label} title={day.label}>
          <Group>
            {day.items.map((e, i) => (
              <Fragment key={e.id}>
                {i > 0 ? <Divider inset={space.lg + 64 + space.md} /> : null}
                <EventRow
                  event={e}
                  gameName={byId.get(e.game_id)?.name}
                  distanceKm={e.distance_km}
                  onPress={() => router.push(`/events/${e.id}`)}
                />
              </Fragment>
            ))}
          </Group>
        </Section>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: { gap: space.md },
});
