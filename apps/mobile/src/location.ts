import * as Location from "expo-location";

import type { Area } from "./areas";

/** Ask for the device location. Returns an Area, or an error message for the user. */
export async function currentArea(): Promise<{ area: Area } | { error: string }> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      return { error: "Location access is off. Choose an area instead, or allow location in Settings." };
    }
    const pos = await Location.getCurrentPositionAsync({});
    return { area: { label: "Near me", lat: pos.coords.latitude, lng: pos.coords.longitude } };
  } catch {
    return { error: "Couldn't find your location. Choose an area instead." };
  }
}
