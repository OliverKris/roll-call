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

export class ApiError extends Error {
    constructor(
        public status: number,
        public detail: unknown,
    ) {
        super(`HTTP ${status}`);
    }
}

export type LogEntry = {
    method: string;
    url: string;
    status: number | "ERR";
    ms: number;
};

let listener: ((entry: LogEntry) => void) | null = null;

/** Subscribe to every request the app makes, for the on-screen log. */
export function onRequest(fn: (entry: LogEntry) => void) {
    listener = fn;
}

async function request<T>(
    method: string,
    url: string,
    init: RequestInit = {},
): Promise<T> {
    const started = Date.now();
    let res: Response;
    try {
        res = await fetch(url, { method, ...init });
    } catch (e) {
        listener?.({ method, url, status: "ERR", ms: Date.now() - started });
        throw new ApiError(0, String(e));
    }
    listener?.({ method, url, status: res.status, ms: Date.now() - started });

    const text = await res.text();
    let body: unknown = text;
    try {
        body = text ? JSON.parse(text) : null;
    } catch {
        // Not JSON, e.g. APISIX's HTML 401 page; keep the raw text
    }
    if (!res.ok) throw new ApiError(res.status, body);
    return body as T;
}

const auth = (token?: string): Record<string, string> =>
    token ? { Authorization: `Bearer ${token}` } : {};

function formEncode(data: Record<string, string>): string {
    return Object.entries(data)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join("&");
}

export async function login(
    username: string,
    password: string,
): Promise<string> {
    const data = await request<{ access_token: string }>(
        "POST",
        `${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/token`,
        {
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: formEncode({
                grant_type: "password",
                client_id: CLIENT_ID,
                username,
                password,
                scope: "openid",
            }),
        },
    );
    return data.access_token;
}

export const listGames = () => request<Game[]>("GET", `${API_URL}/games`);

export const getMyProfile = (token?: string) =>
    request<Profile>("GET", `${API_URL}/profiles/me`, { headers: auth(token) });

export const setMyGames = (token: string, gameIds: number[]) =>
    request<Profile>("PUT", `${API_URL}/profiles/me/games`, {
        headers: { ...auth(token), "Content-Type": "application/json" },
        body: JSON.stringify({ game_ids: gameIds }),
    });

export function describeError(e: unknown): string {
    if (e instanceof ApiError) {
        if (e.status === 0)
            return "Can't reach the server. Check the URL in .env and your Wi-Fi.";
        const detail =
            typeof e.detail === "string"
                ? e.detail
                      .replace(/<[^>]+>/g, " ")
                      .replace(/\s+/g, " ")
                      .trim()
                      .slice(0, 120)
                : JSON.stringify(e.detail);
        return `${e.status}: ${detail}`;
    }
    return e instanceof Error ? e.message : String(e);
}
