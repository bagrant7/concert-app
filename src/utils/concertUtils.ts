import AsyncStorage from "@react-native-async-storage/async-storage";

/* ========================= Types ========================= */
export type Concert = {
  id: string;
  name: string; // Headliner
  subName: string; // Openers
  date: string; // YYYY-MM-DD
  location: string; // Venue
  // Artist media (from Spotify backend)
  imageUrl?: string;
  spotifyArtistId?: string;
  spotifyArtistUrl?: string;
  createdAt: number;
  updatedAt?: number;
};

export type StoragePayloadV3 = {
  version: 3;
  concerts: Concert[];
};

export type SpotifyArtist = {
  id: string | null;
  name: string | null;
  imageUrl: string | null;
  spotifyUrl: string | null;
};

export type SpotifySuggestResponse = {
  items: SpotifyArtist[];
};

/* ========================= Constants ========================= */
export const STORAGE_KEY_V3 = "concerts:v3";
export const STORAGE_KEY_V2 = "concerts:v2";
export const STORAGE_KEY_V1 = "concerts:v1";

export const SPOTIFY_BACKEND_BASE_URL = "http://localhost:3001";

export const MIN_DATE = "1945-01-01";
export const MAX_DATE = "2026-12-31";
export const MIN_YEAR = 1945;
export const MAX_YEAR = 2026;

export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/* ========================= Utils ========================= */
export function normalize(s: string) {
  return s.trim().replace(/\s+/g, " ");
}

export function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function normalizeKey(name: string, date: string, location: string) {
  return `${normalize(name).toLowerCase()}|${normalize(date)}|${normalize(location).toLowerCase()}`;
}

export function toYYYYMMDD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseYYYYMMDD(s: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

export function dateEpochLocal(yyyyMmDd: string): number | null {
  const parts = parseYYYYMMDD(yyyyMmDd);
  if (!parts) return null;
  const { y, m, d } = parts;
  return new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
}

export function isValidDateYYYYMMDD(value: string): boolean {
  const parts = parseYYYYMMDD(value);
  if (!parts) return false;

  const { y, m, d } = parts;
  if (y < MIN_YEAR || y > MAX_YEAR) return false;
  if (m < 1 || m > 12) return false;
  if (d < 1 || d > 31) return false;

  const check = new Date(y, m - 1, d, 0, 0, 0, 0);
  const isReal =
    check.getFullYear() === y && check.getMonth() + 1 === m && check.getDate() === d;

  if (!isReal) return false;
  return value >= MIN_DATE && value <= MAX_DATE;
}

export function clampCursorToBounds(d: Date): Date {
  const min = new Date(MIN_YEAR, 0, 1);
  const max = new Date(MAX_YEAR, 11, 1);
  if (d < min) return min;
  if (d > max) return max;
  return d;
}

export function sortByDateThenTouch(a: Concert, b: Concert, direction: "asc" | "desc") {
  if (a.date !== b.date) {
    if (direction === "asc") return a.date < b.date ? -1 : 1;
    return a.date < b.date ? 1 : -1;
  }
  const at = a.updatedAt ?? a.createdAt;
  const bt = b.updatedAt ?? b.createdAt;
  return bt - at;
}

export function initialsFromName(name: string) {
  const parts = normalize(name).split(" ").filter(Boolean);
  if (parts.length === 0) return "♪";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/* ========================= Spotify backend helpers ========================= */
export async function fetchSpotifySuggest(q: string, signal?: AbortSignal): Promise<SpotifyArtist[]> {
  const term = normalize(q);
  if (!term) return [];
  const url = `${SPOTIFY_BACKEND_BASE_URL}/spotify/suggest?q=${encodeURIComponent(term)}`;
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return [];
    const data = (await res.json()) as SpotifySuggestResponse;
    return Array.isArray(data?.items) ? data.items : [];
  } catch (e) {
    console.warn("Spotify suggest failed:", e);
    return [];
  }
}

export async function fetchSpotifyBestArtist(q: string, signal?: AbortSignal): Promise<SpotifyArtist | null> {
  const term = normalize(q);
  if (!term) return null;
  const url = `${SPOTIFY_BACKEND_BASE_URL}/spotify/artist?q=${encodeURIComponent(term)}`;
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    return (await res.json()) as SpotifyArtist;
  } catch (e) {
    console.warn("Spotify best-artist lookup failed:", e);
    return null;
  }
}

/* ========================= Storage ========================= */
function sanitizeConcertArray(input: unknown[]): Concert[] {
  return input
    .filter((x) => x && typeof x === "object")
    .map((x: any): Concert => ({
      id: String(x.id ?? ""),
      name: String(x.name ?? ""),
      subName: String(x.subName ?? ""),
      date: String(x.date ?? ""),
      location: String(x.location ?? ""),
      imageUrl: x.imageUrl != null ? String(x.imageUrl) : undefined,
      spotifyArtistId: x.spotifyArtistId != null ? String(x.spotifyArtistId) : undefined,
      spotifyArtistUrl: x.spotifyArtistUrl != null ? String(x.spotifyArtistUrl) : undefined,
      createdAt: Number(x.createdAt ?? Date.now()),
      updatedAt: x.updatedAt != null ? Number(x.updatedAt) : undefined,
    }))
    .filter((c) => c.id && c.name && c.date && c.location);
}

export async function saveConcerts(concerts: Concert[]) {
  const payload: StoragePayloadV3 = { version: 3, concerts };
  await AsyncStorage.setItem(STORAGE_KEY_V3, JSON.stringify(payload));
}

export async function loadConcerts(): Promise<Concert[]> {
  // v3
  const rawV3 = await AsyncStorage.getItem(STORAGE_KEY_V3);
  if (rawV3) {
    const parsed = JSON.parse(rawV3) as unknown;
    const ok =
      parsed &&
      typeof parsed === "object" &&
      (parsed as any).version === 3 &&
      Array.isArray((parsed as any).concerts);

    if (ok) return sanitizeConcertArray((parsed as any).concerts);
  }

  // migrate from v2
  const rawV2 = await AsyncStorage.getItem(STORAGE_KEY_V2);
  if (rawV2) {
    const parsed = JSON.parse(rawV2) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      (parsed as any).version === 2 &&
      Array.isArray((parsed as any).concerts)
    ) {
      const cleaned = sanitizeConcertArray((parsed as any).concerts);
      await saveConcerts(cleaned);
      return cleaned;
    }
  }

  // migrate from v1
  const rawV1 = await AsyncStorage.getItem(STORAGE_KEY_V1);
  if (rawV1) {
    const parsed = JSON.parse(rawV1) as unknown;
    if (Array.isArray(parsed)) {
      const cleaned = sanitizeConcertArray(parsed);
      await saveConcerts(cleaned);
      return cleaned;
    }
  }

  return [];
}