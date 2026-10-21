import { API_URL, CLIENT_ID, KEYCLOAK_URL, REALM } from "./config";

export type Game = {
  id: number;
  name: string;
  min_players: number;
  max_players: number;
  play_time_minutes: number;
};

export type Profile = {
  user_id: string;
  display_name: string;
  home_area: string | null;
  bio: string | null;
  game_ids: number[];
  created_at: string;
  updated_at: string;
};

export type PublicProfile = {
  user_id: string;
  display_name: string;
  home_area: string | null;
  game_ids: number[];
};

export type EventSummary = {
  id: number;
  host_user_id: string;
  title: string;
  description: string | null;
  game_id: number;
  starts_at: string;
  location_name: string;
  latitude: number;
  longitude: number;
  capacity: number;
  seats_taken: number;
  seats_left: number;
  status: string;
  created_at: string;
};

export type RsvpStatus = "going" | "waitlisted";
export type NearbyEvent = EventSummary & { distance_km: number };
export type MyEvent = EventSummary & { my_status: RsvpStatus };
export type Rsvp = { event_id: number; user_id: string; status: RsvpStatus; joined_at: string };

export type NewEvent = {
  title: string;
  description?: string;
  game_id: number;
  starts_at: string;
  location_name: string;
  latitude: number;
  longitude: number;
  capacity: number;
};

export class ApiError extends Error {
  constructor(
    public status: number,
    public detail: unknown,
  ) {
    super(`HTTP ${status}`);
  }
}

type Options = { token?: string | null; json?: unknown; form?: Record<string, string> };

function formEncode(data: Record<string, string>): string {
  return Object.entries(data)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
}

async function request<T>(method: string, url: string, { token, json, form }: Options = {}): Promise<T> {
  const headers: Record<string, string> = {};
  let body: string | undefined;
  if (token) headers.Authorization = `Bearer ${token}`;
  if (json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(json);
  }
  if (form) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    body = formEncode(form);
  }

  let res: Response;
  try {
    res = await fetch(url, { method, headers, body });
  } catch (e) {
    throw new ApiError(0, String(e));
  }
  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let parsed: unknown = text;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    // Non-JSON body, e.g. the gateway's HTML error pages
  }
  if (!res.ok) throw new ApiError(res.status, parsed);
  return parsed as T;
}

const api = (path: string) => `${API_URL}${path}`;

// ---------- auth ----------

export const login = (username: string, password: string) =>
  request<{ access_token: string; expires_in: number }>(
    "POST",
    `${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/token`,
    { form: { grant_type: "password", client_id: CLIENT_ID, username, password, scope: "openid" } },
  );

// ---------- catalog ----------

export const listGames = () => request<Game[]>("GET", api("/games"));

// ---------- events ----------

export const nearbyEvents = (lat: number, lng: number, radiusKm: number) =>
  request<NearbyEvent[]>("GET", api(`/events/nearby?lat=${lat}&lng=${lng}&radius_km=${radiusKm}`));

export const getEvent = (id: number) => request<EventSummary>("GET", api(`/events/${id}`));

export const createEvent = (token: string, data: NewEvent) =>
  request<EventSummary>("POST", api("/events"), { token, json: data });

export async function getMyRsvp(token: string, id: number): Promise<Rsvp | null> {
  try {
    return await request<Rsvp>("GET", api(`/events/${id}/rsvp`), { token });
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export const joinEvent = (token: string, id: number) =>
  request<Rsvp>("POST", api(`/events/${id}/rsvp`), { token });

export const leaveEvent = (token: string, id: number) =>
  request<void>("DELETE", api(`/events/${id}/rsvp`), { token });

export const myEvents = (token: string) => request<MyEvent[]>("GET", api("/events/mine"), { token });

// ---------- profile ----------

export const getMyProfile = (token: string) => request<Profile>("GET", api("/profiles/me"), { token });

export const getProfile = (token: string, userId: string) =>
  request<PublicProfile>("GET", api(`/profiles/${encodeURIComponent(userId)}`), { token });

export const updateMyProfile = (
  token: string,
  data: { display_name: string; home_area: string | null; bio: string | null },
) => request<Profile>("PUT", api("/profiles/me"), { token, json: data });

export const setMyGames = (token: string, gameIds: number[]) =>
  request<Profile>("PUT", api("/profiles/me/games"), { token, json: { game_ids: gameIds } });

// ---------- notifications ----------

export type NotificationKind =
  | "seat_taken"
  | "waitlist_joined"
  | "seat_offered"
  | "waitlist_promoted"
  | "seat_given_up";

export type Notification = {
  id: string;
  kind: NotificationKind | string;
  title: string;
  body: string;
  event_id: number | null;
  created_at: string;
  read_at: string | null;
};

export type Inbox = { items: Notification[]; unread_count: number };

export const getInbox = (token: string) => request<Inbox>("GET", api("/notifications"), { token });

export const markRead = (token: string, id: string) =>
  request<void>("POST", api(`/notifications/${id}/read`), { token });

export const markAllRead = (token: string) =>
  request<void>("POST", api("/notifications/read-all"), { token });

// ---------- errors ----------

function detailMessage(d: unknown): string {
  if (typeof d === "string") {
    return d.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160);
  }
  if (d && typeof d === "object" && "error_description" in d) {
    return String((d as { error_description: unknown }).error_description);
  }
  if (d && typeof d === "object" && "detail" in d) {
    const inner = (d as { detail: unknown }).detail;
    if (typeof inner === "string") return inner;
    if (Array.isArray(inner)) {
      return inner
        .map((x) => (x as { msg?: string }).msg ?? "")
        .filter(Boolean)
        .join("; ");
    }
    if (inner && typeof inner === "object" && "message" in inner) {
      return String((inner as { message: unknown }).message);
    }
  }
  return JSON.stringify(d);
}

export function describeError(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 0) return "Can't reach the server. Check your connection and the URL in .env.";
    if (e.status === 401) return "Your session expired. Please sign in again.";
    return detailMessage(e.detail);
  }
  return e instanceof Error ? e.message : String(e);
}
