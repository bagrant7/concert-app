import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Keyboard,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Calendar, DateData } from "react-native-calendars";

/* ========================= Types ========================= */
type Concert = {
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

type StoragePayloadV3 = {
  version: 3;
  concerts: Concert[];
};

type FilterMode = "all" | "upcoming" | "past";

type Row =
  | { type: "filters" }
  | { type: "section"; title: "Upcoming" | "Past"; count: number }
  | { type: "concert"; item: Concert; isUpcoming: boolean }
  | { type: "empty"; message: string };

type Option<T extends string | number> = {
  label: string;
  value: T;
};

type SpotifyArtist = {
  id: string | null;
  name: string | null;
  imageUrl: string | null;
  spotifyUrl: string | null;
};

type SpotifySuggestResponse = {
  items: SpotifyArtist[];
};

/* ========================= Constants ========================= */
const STORAGE_KEY_V3 = "concerts:v3";
const STORAGE_KEY_V2 = "concerts:v2";
const STORAGE_KEY_V1 = "concerts:v1";

// IMPORTANT:
// - iOS Simulator: "http://localhost:3001"
// - Android Emulator: "http://10.0.2.2:3001"
// - Real device: use your computer LAN IP (e.g. http://192.168.1.20:3001)
const SPOTIFY_BACKEND_BASE_URL = "http://localhost:3001";

const MIN_DATE = "1945-01-01";
const MAX_DATE = "2026-12-31";
const MIN_YEAR = 1945;
const MAX_YEAR = 2026;

const MONTHS = [
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

const PICKER_ROW_HEIGHT = 44;
const PICKER_ROW_GAP = 8;
const PICKER_ITEM_HEIGHT = PICKER_ROW_HEIGHT + PICKER_ROW_GAP;

/* ========================= Utils ========================= */
function normalize(s: string) {
  return s.trim().replace(/\\s+/g, " ");
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeKey(name: string, date: string, location: string) {
  return `${normalize(name).toLowerCase()}|${normalize(date)}|${normalize(
    location
  ).toLowerCase()}`;
}

function toYYYYMMDD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseYYYYMMDD(s: string): { y: number; m: number; d: number } | null {
  const m = /^(\\d{4})-(\\d{2})-(\\d{2})$/.exec(s.trim());
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

function dateEpochLocal(yyyyMmDd: string): number | null {
  const parts = parseYYYYMMDD(yyyyMmDd);
  if (!parts) return null;
  const { y, m, d } = parts;
  return new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
}

function isValidDateYYYYMMDD(value: string): boolean {
  const parts = parseYYYYMMDD(value);
  if (!parts) return false;
  const { y, m, d } = parts;
  if (y < MIN_YEAR || y > MAX_YEAR) return false;
  if (m < 1 || m > 12) return false;
  if (d < 1 || d > 31) return false;
  const check = new Date(y, m - 1, d, 0, 0, 0, 0);
  const isReal =
    check.getFullYear() === y &&
    check.getMonth() + 1 === m &&
    check.getDate() === d;
  if (!isReal) return false;
  // safe because YYYY-MM-DD sorts lexicographically
  return value >= MIN_DATE && value <= MAX_DATE;
}

function clampCursorToBounds(d: Date): Date {
  const min = new Date(MIN_YEAR, 0, 1);
  const max = new Date(MAX_YEAR, 11, 1);
  if (d < min) return min;
  if (d > max) return max;
  return d;
}

function sortByDateThenTouch(a: Concert, b: Concert, direction: "asc" | "desc") {
  if (a.date !== b.date) {
    if (direction === "asc") return a.date < b.date ? -1 : 1;
    return a.date < b.date ? 1 : -1;
  }
  const at = a.updatedAt ?? a.createdAt;
  const bt = b.updatedAt ?? b.createdAt;
  return bt - at;
}

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

function initialsFromName(name: string) {
  const parts = normalize(name).split(" ").filter(Boolean);
  if (parts.length === 0) return "♪";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/* ========================= Spotify backend helpers ========================= */
async function fetchSpotifySuggest(
  q: string,
  signal?: AbortSignal
): Promise<SpotifyArtist[]> {
  const term = normalize(q);
  if (!term) return [];
  const url = `${SPOTIFY_BACKEND_BASE_URL}/spotify/suggest?q=${encodeURIComponent(
    term
  )}`;
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

async function fetchSpotifyBestArtist(
  q: string,
  signal?: AbortSignal
): Promise<SpotifyArtist | null> {
  const term = normalize(q);
  if (!term) return null;
  const url = `${SPOTIFY_BACKEND_BASE_URL}/spotify/artist?q=${encodeURIComponent(
    term
  )}`;
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
      spotifyArtistId:
        x.spotifyArtistId != null ? String(x.spotifyArtistId) : undefined,
      spotifyArtistUrl:
        x.spotifyArtistUrl != null ? String(x.spotifyArtistUrl) : undefined,
      createdAt: Number(x.createdAt ?? Date.now()),
      updatedAt: x.updatedAt != null ? Number(x.updatedAt) : undefined,
    }))
    .filter((c) => c.id && c.name && c.date && c.location);
}

async function saveConcerts(concerts: Concert[]) {
  const payload: StoragePayloadV3 = { version: 3, concerts };
  await AsyncStorage.setItem(STORAGE_KEY_V3, JSON.stringify(payload));
}

async function loadConcerts(): Promise<Concert[]> {
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

/* ========================= UI Components ========================= */
function OptionPickerModal<T extends string | number>(props: {
  visible: boolean;
  title: string;
  options: Option<T>[];
  selectedValue: T;
  onSelect: (value: T) => void;
  onClose: () => void;
}) {
  const { visible, title, options, selectedValue, onSelect, onClose } = props;
  const listRef = useRef<FlatList<Option<T>>>(null);

  const selectedIndex = useMemo(() => {
    const i = options.findIndex((o) => o.value === selectedValue);
    return i >= 0 ? i : 0;
  }, [options, selectedValue]);

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => {
      listRef.current?.scrollToIndex({
        index: selectedIndex,
        animated: false,
        viewPosition: 0.5,
      });
    }, 0);
    return () => clearTimeout(t);
  }, [visible, selectedIndex]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.pickerBackdrop} onPress={onClose}>
        <Pressable style={styles.pickerCard} onPress={() => {}}>
          <Text style={styles.pickerTitle}>{title}</Text>
          <FlatList
            ref={listRef}
            data={options}
            keyExtractor={(item) => String(item.value)}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={{ height: PICKER_ROW_GAP }} />}
            contentContainerStyle={{ paddingBottom: PICKER_ROW_GAP }}
            getItemLayout={(_, index) => ({
              length: PICKER_ITEM_HEIGHT,
              offset: PICKER_ITEM_HEIGHT * index,
              index,
            })}
            onScrollToIndexFailed={(info) => {
              setTimeout(() => {
                listRef.current?.scrollToIndex({
                  index: info.index,
                  animated: false,
                  viewPosition: 0.5,
                });
              }, 50);
            }}
            renderItem={({ item }) => {
              const isSelected = item.value === selectedValue;
              return (
                <Pressable
                  onPress={() => onSelect(item.value)}
                  style={({ pressed }) => [
                    styles.pickerRow,
                    isSelected && styles.pickerRowSelected,
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <Text
                    style={[
                      styles.pickerRowText,
                      isSelected && styles.pickerRowTextSelected,
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            }}
          />
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.pickerClose,
              pressed && { opacity: 0.8 },
            ]}
          >
            <Text style={styles.pickerCloseText}>Close</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function StickyFiltersRow(props: {
  searchQuery: string;
  onChangeSearch: (v: string) => void;
  filterMode: FilterMode;
  onChangeFilter: (m: FilterMode) => void;
  onClearSearch: () => void;
}) {
  const {
    searchQuery,
    onChangeSearch,
    filterMode,
    onChangeFilter,
    onClearSearch,
  } = props;

  return (
    <View style={styles.controlsCard}>
      <View style={styles.searchRow}>
        <TextInput
          value={searchQuery}
          onChangeText={onChangeSearch}
          placeholder="Search by headliner, venue, date…"
          placeholderTextColor="#66668a"
          style={[
            styles.searchInput,
            searchQuery ? { paddingRight: 44 } : null,
          ]}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
        />
        {searchQuery.trim().length > 0 && (
          <Pressable
            onPress={onClearSearch}
            style={({ pressed }) => [
              styles.clearBtn,
              pressed && { opacity: 0.7 },
            ]}
            hitSlop={10}
            accessibilityLabel="Clear search"
          >
            <Text style={styles.clearBtnText}>×</Text>
          </Pressable>
        )}
      </View>
      <View style={styles.filterRow}>
        {(["all", "upcoming", "past"] as const).map((mode) => {
          const active = filterMode === mode;
          const label =
            mode === "all" ? "All" : mode === "upcoming" ? "Upcoming" : "Past";
          return (
            <Pressable
              key={mode}
              onPress={() => onChangeFilter(mode)}
              style={({ pressed }) => [
                styles.filterBtn,
                active && styles.filterBtnActive,
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={[styles.filterText, active && styles.filterTextActive]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function ConcertRow(props: {
  concert: Concert;
  isUpcoming: boolean;
  onOpenMenu: (c: Concert) => void;
}) {
  const { concert: c, isUpcoming, onOpenMenu } = props;

  return (
    <View style={styles.row}>
      {/* Headliner image (left) */}
      <View style={styles.avatarWrap}>
        {c.imageUrl ? (
          <Image source={{ uri: c.imageUrl }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>{initialsFromName(c.name)}</Text>
          </View>
        )}
      </View>

      {/* Info (right) */}
      <View style={{ flex: 1 }}>
        <View style={styles.rowTopLine}>
          <Text style={styles.rowTitle}>{c.name}</Text>
          {isUpcoming && (
            <View style={styles.badgeUpcoming}>
              <Text style={styles.badgeUpcomingText}>Upcoming</Text>
            </View>
          )}
        </View>
        {!!c.subName && <Text style={styles.rowSub}>{c.subName}</Text>}
        <Text style={styles.rowMeta}>
          {c.date} • {c.location}
        </Text>
      </View>

      <Pressable
        onPress={() => onOpenMenu(c)}
        style={({ pressed }) => [
          styles.moreBtn,
          pressed && { opacity: 0.6 },
        ]}
        hitSlop={10}
      >
        <Text style={styles.moreBtnText}>⋯</Text>
      </Pressable>
    </View>
  );
}

function CalendarModal(props: {
  visible: boolean;
  date: string;
  calendarCursor: Date;
  setCalendarCursor: React.Dispatch<React.SetStateAction<Date>>;
  onPickDay: (day: DateData) => void;
  onClose: () => void;
}) {
  const {
    visible,
    date,
    calendarCursor,
    setCalendarCursor,
    onPickDay,
    onClose,
  } = props;
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [yearPickerOpen, setYearPickerOpen] = useState(false);

  const monthOptions = useMemo<Option<number>[]>(
    () => MONTHS.map((m, idx) => ({ label: m, value: idx })),
    []
  );

  const yearOptions = useMemo<Option<number>[]>(() => {
    const years: Option<number>[] = [];
    for (let y = MIN_YEAR; y <= MAX_YEAR; y++)
      years.push({ label: String(y), value: y });
    return years;
  }, []);

  const markedDates = useMemo(() => {
    if (!isValidDateYYYYMMDD(date)) return {};
    return { [date]: { selected: true, selectedColor: "#4f46e5" } };
  }, [date]);

  const monthKey = `${calendarCursor.getFullYear()}-${calendarCursor.getMonth()}`;
  const current = toYYYYMMDD(calendarCursor);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => {}}>
          <View style={styles.calendarHeader}>
            <Pressable
              onPress={() => setMonthPickerOpen(true)}
              style={({ pressed }) => [
                styles.dropdown,
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={styles.dropdownText}>
                {MONTHS[calendarCursor.getMonth()]} ▾
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setYearPickerOpen(true)}
              style={({ pressed }) => [
                styles.dropdown,
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={styles.dropdownText}>
                {calendarCursor.getFullYear()} ▾
              </Text>
            </Pressable>
          </View>

          <Calendar
            key={monthKey}
            current={current}
            minDate={MIN_DATE}
            maxDate={MAX_DATE}
            onMonthChange={(m) =>
              setCalendarCursor(
                clampCursorToBounds(new Date(m.year, m.month - 1, 1))
              )
            }
            onDayPress={onPickDay}
            markedDates={markedDates}
            hideExtraDays
            enableSwipeMonths
            theme={{
              backgroundColor: "#161622",
              calendarBackground: "#161622",
              dayTextColor: "white",
              monthTextColor: "white",
              textDisabledColor: "#55557a",
              arrowColor: "white",
              todayTextColor: "#cfcfe6",
            }}
          />

          <OptionPickerModal
            visible={monthPickerOpen}
            title="Select Month"
            options={monthOptions}
            selectedValue={calendarCursor.getMonth()}
            onClose={() => setMonthPickerOpen(false)}
            onSelect={(monthIndex) => {
              setCalendarCursor((prev) =>
                clampCursorToBounds(new Date(prev.getFullYear(), monthIndex, 1))
              );
              setMonthPickerOpen(false);
            }}
          />

          <OptionPickerModal
            visible={yearPickerOpen}
            title="Select Year"
            options={yearOptions}
            selectedValue={calendarCursor.getFullYear()}
            onClose={() => setYearPickerOpen(false)}
            onSelect={(year) => {
              setCalendarCursor((prev) =>
                clampCursorToBounds(new Date(year, prev.getMonth(), 1))
              );
              setYearPickerOpen(false);
            }}
          />

          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.modalClose,
              pressed && { opacity: 0.8 },
            ]}
          >
            <Text style={styles.modalCloseText}>Close</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function RowMenuModal(props: {
  visible: boolean;
  target: Concert | null;
  onClose: () => void;
  onEdit: (c: Concert) => void;
  onDelete: (id: string) => void;
}) {
  const { visible, target, onClose, onEdit, onDelete } = props;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.menuBackdrop} onPress={onClose}>
        <Pressable style={styles.menuCard} onPress={() => {}}>
          <Text style={styles.menuTitle}>Actions</Text>
          <Pressable
            style={({ pressed }) => [
              styles.menuItem,
              pressed && { opacity: 0.8 },
            ]}
            onPress={() => {
              if (!target) return;
              onClose();
              onEdit(target);
            }}
          >
            <Text style={styles.menuItemText}>Edit</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.menuItem,
              styles.menuItemDanger,
              pressed && { opacity: 0.8 },
            ]}
            onPress={() => {
              if (!target) return;
              const id = target.id;
              onClose();
              onDelete(id);
            }}
          >
            <Text style={[styles.menuItemText, styles.menuItemTextDanger]}>
              Delete
            </Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.menuItem,
              pressed && { opacity: 0.8 },
            ]}
            onPress={onClose}
          >
            <Text style={styles.menuItemText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ========================= Screen ========================= */
export default function HomeScreen() {
  // Form
  const [name, setName] = useState("");
  const [subName, setSubName] = useState("");
  const [date, setDate] = useState("");
  const [location, setLocation] = useState("");

  // Data
  const [concerts, setConcerts] = useState<Concert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isHydrated, setIsHydrated] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Calendar
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarCursor, setCalendarCursor] = useState<Date>(() =>
    clampCursorToBounds(new Date())
  );

  // Row menu
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuTarget, setMenuTarget] = useState<Concert | null>(null);

  // Filters/search
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Input refs
  const subNameRef = useRef<TextInput>(null);
  const locationRef = useRef<TextInput>(null);

  const canSubmit = useMemo(() => {
    return (
      normalize(name).length > 0 &&
      normalize(date).length > 0 &&
      normalize(location).length > 0
    );
  }, [name, date, location]);

  // "today" at local midnight
  const todayEpoch = useMemo(() => {
    const now = new Date();
    return new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
      0
    ).getTime();
  }, []);

  /* ---------- Spotify autocomplete state ---------- */
  const [showArtistSuggestions, setShowArtistSuggestions] = useState(false);
  const [artistLoading, setArtistLoading] = useState(false);
  const [spotifySuggestions, setSpotifySuggestions] = useState<SpotifyArtist[]>([]);
  const [selectedArtist, setSelectedArtist] = useState<SpotifyArtist | null>(null);

  const debouncedName = useDebouncedValue(name, 250);
  const suggestCacheRef = useRef<Map<string, SpotifyArtist[]>>(new Map());

  useEffect(() => {
    const q = normalize(debouncedName);
    if (name.length < 3 || q.length < 3) {
      setSpotifySuggestions([]);
      setArtistLoading(false);
      return;
    }

    const cacheKey = q.toLowerCase();
    const cached = suggestCacheRef.current.get(cacheKey);
    if (cached) {
      setSpotifySuggestions(cached);
      setArtistLoading(false);
      return;
    }

    const controller = new AbortController();
    setArtistLoading(true);

    (async () => {
      try {
        const items = await fetchSpotifySuggest(q, controller.signal);
        suggestCacheRef.current.set(cacheKey, items);
        setSpotifySuggestions(items);
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        console.warn("Spotify suggest failed:", e);
        setSpotifySuggestions([]);
      } finally {
        setArtistLoading(false);
      }
    })();

    return () => controller.abort();
  }, [debouncedName, name]);

  const visibleArtistSuggestions = useMemo(() => {
    const nKey = normalize(name).toLowerCase();
    return spotifySuggestions
      .filter((a) =>
        a?.name ? normalize(a.name).toLowerCase() !== nKey : false
      )
      .slice(0, 10);
  }, [spotifySuggestions, name]);

  /* ---------- load/save ---------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const loaded = await loadConcerts();
        if (!alive) return;
        setConcerts(loaded);
      } catch (e) {
        console.warn("Failed to load concerts:", e);
        if (!alive) return;
        Alert.alert("Load failed", "Could not restore saved concerts.");
      } finally {
        if (!alive) return;
        setIsLoading(false);
        setIsHydrated(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Debounced save
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!isHydrated) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveConcerts(concerts).catch((e) =>
        console.warn("Failed to save concerts:", e)
      );
    }, 300);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [concerts, isHydrated]);

  /* ---------- derived lists ---------- */
  const filteredBySearch = useMemo(() => {
    const q = normalize(searchQuery).toLowerCase();
    if (!q) return concerts;
    return concerts.filter((c) => {
      const hay = `${c.name} ${c.subName} ${c.location} ${c.date}`.toLowerCase();
      return hay.includes(q);
    });
  }, [concerts, searchQuery]);

  const { upcomingConcerts, pastConcerts } = useMemo(() => {
    const upcoming: Concert[] = [];
    const past: Concert[] = [];

    for (const c of filteredBySearch) {
      const e = dateEpochLocal(c.date);
      if (e != null && e >= todayEpoch) upcoming.push(c);
      else past.push(c);
    }

    upcoming.sort((a, b) => sortByDateThenTouch(a, b, "asc"));
    past.sort((a, b) => sortByDateThenTouch(a, b, "desc"));

    return { upcomingConcerts: upcoming, pastConcerts: past };
  }, [filteredBySearch, todayEpoch]);

  /* ---------- helpers ---------- */
  const clearFields = useCallback(() => {
    setName("");
    setSubName("");
    setDate("");
    setLocation("");
    setSpotifySuggestions([]);
    setShowArtistSuggestions(false);
    setSelectedArtist(null);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    clearFields();
    Keyboard.dismiss();
  }, [clearFields]);

  const validateFields = useCallback(() => {
    const n = normalize(name);
    const d = normalize(date);
    const loc = normalize(location);
    const sn = normalize(subName);

    if (!n)
      return {
        ok: false as const,
        title: "Missing Headliner",
        msg: "Please enter the headliner.",
      };
    if (!d)
      return {
        ok: false as const,
        title: "Missing Date",
        msg: "Please select a date.",
      };
    if (!isValidDateYYYYMMDD(d))
      return {
        ok: false as const,
        title: "Invalid Date",
        msg: `Pick a real date between ${MIN_DATE} and ${MAX_DATE}.`,
      };
    if (!loc)
      return {
        ok: false as const,
        title: "Missing Venue",
        msg: "Please enter the venue.",
      };

    return { ok: true as const, data: { n, sn, d, loc } };
  }, [name, subName, date, location]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = useCallback(async () => {
    if (isSubmitting) return;

    const v = validateFields();
    if (!v.ok) {
      Alert.alert(v.title, v.msg);
      return;
    }

    const { n, sn, d, loc } = v.data;

    // duplicate check BEFORE network call
    const newKey = normalizeKey(n, d, loc);
    const hasDup = concerts.some((c) => {
      if (editingId && c.id === editingId) return false;
      return normalizeKey(c.name, c.date, c.location) === newKey;
    });

    if (hasDup) {
      Alert.alert(
        "Already Added",
        "That concert (same headliner/date/venue) is already in your list."
      );
      return;
    }

    setIsSubmitting(true);

    const artistKey = normalize(n).toLowerCase();
    let imageUrl: string | undefined;
    let spotifyArtistId: string | undefined;
    let spotifyArtistUrl: string | undefined;

    // If user picked from dropdown and it matches the headliner, trust it
    const selectedMatches =
      selectedArtist &&
      normalize(selectedArtist.name ?? "").toLowerCase() === artistKey &&
      !!selectedArtist.id;

    if (selectedMatches) {
      imageUrl = selectedArtist?.imageUrl ?? undefined;
      spotifyArtistId = selectedArtist?.id ?? undefined;
      spotifyArtistUrl = selectedArtist?.spotifyUrl ?? undefined;
    } else {
      try {
        const best = await fetchSpotifyBestArtist(n);
        if (best?.imageUrl) imageUrl = best.imageUrl;
        if (best?.id) spotifyArtistId = best.id;
        if (best?.spotifyUrl) spotifyArtistUrl = best.spotifyUrl;
      } catch (e) {
        console.warn("Spotify best-artist lookup failed:", e);
      }
    }

    const now = Date.now();

    setConcerts((prev) => {
      if (editingId) {
        return prev.map((c) =>
          c.id === editingId
            ? {
                ...c,
                name: n,
                subName: sn,
                date: d,
                location: loc,
                imageUrl,
                spotifyArtistId,
                spotifyArtistUrl,
                updatedAt: now,
              }
            : c
        );
      }

      const newItem: Concert = {
        id: makeId(),
        name: n,
        subName: sn,
        date: d,
        location: loc,
        imageUrl,
        spotifyArtistId,
        spotifyArtistUrl,
        createdAt: now,
      };

      return [newItem, ...prev];
    });

    setEditingId(null);
    clearFields();
    Keyboard.dismiss();
    setIsSubmitting(false);
  }, [
    validateFields,
    isSubmitting,
    concerts,
    editingId,
    clearFields,
    selectedArtist,
  ]);

  const startEdit = useCallback((concert: Concert) => {
    setEditingId(concert.id);
    setName(concert.name);
    setSubName(concert.subName);
    setDate(concert.date);
    setLocation(concert.location);

    // If editing, preserve selection as null (force "best lookup" on submit unless user reselects)
    setSelectedArtist(null);

    const parts = parseYYYYMMDD(concert.date);
    if (parts)
      setCalendarCursor(
        clampCursorToBounds(new Date(parts.y, parts.m - 1, 1))
      );

    setTimeout(() => subNameRef.current?.focus(), 50);
  }, []);

  const confirmRemove = useCallback((id: string) => {
    Alert.alert("Delete concert?", "This will remove it from your list.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => setConcerts((p) => p.filter((c) => c.id !== id)),
      },
    ]);
  }, []);

  /* ---------- calendar ---------- */
  const openCalendar = useCallback(() => {
    const useDate = isValidDateYYYYMMDD(date) ? date : toYYYYMMDD(new Date());
    const parts = parseYYYYMMDD(useDate);
    setCalendarCursor(
      parts
        ? clampCursorToBounds(new Date(parts.y, parts.m - 1, 1))
        : clampCursorToBounds(new Date())
    );
    setCalendarOpen(true);
  }, [date]);

  const closeCalendar = useCallback(() => setCalendarOpen(false), []);

  const onPickDay = useCallback((day: DateData) => {
    setDate(day.dateString);
    setCalendarOpen(false);
  }, []);

  /* ---------- row menu ---------- */
  const openRowMenu = useCallback((concert: Concert) => {
    setMenuTarget(concert);
    setMenuOpen(true);
  }, []);

  const closeRowMenu = useCallback(() => {
    setMenuOpen(false);
    setMenuTarget(null);
  }, []);

  /* ---------- rows ---------- */
  const rows: Row[] = useMemo(() => {
    const out: Row[] = [{ type: "filters" }];

    const showUpcoming = filterMode === "all" || filterMode === "upcoming";
    const showPast = filterMode === "all" || filterMode === "past";

    const pushSection = (
      title: "Upcoming" | "Past",
      items: Concert[],
      isUpcoming: boolean
    ) => {
      out.push({ type: "section", title, count: items.length });
      if (items.length === 0) {
        out.push({
          type: "empty",
          message:
            title === "Upcoming" ? "No upcoming shows." : "No past shows.",
        });
        return;
      }
      for (const c of items) out.push({ type: "concert", item: c, isUpcoming });
    };

    if (showUpcoming) pushSection("Upcoming", upcomingConcerts, true);
    if (showPast) pushSection("Past", pastConcerts, false);

    const total = upcomingConcerts.length + pastConcerts.length;
    if (total === 0)
      return [
        { type: "filters" },
        {
          type: "empty",
          message: "No matches — try changing filters or search.",
        },
      ];

    return out;
  }, [filterMode, upcomingConcerts, pastConcerts]);

  const clearSearch = useCallback(() => {
    setSearchQuery("");
    Keyboard.dismiss();
  }, []);

  const renderRow = useCallback(
    ({ item }: { item: Row }) => {
      if (item.type === "filters") {
        return (
          <StickyFiltersRow
            searchQuery={searchQuery}
            onChangeSearch={setSearchQuery}
            filterMode={filterMode}
            onChangeFilter={setFilterMode}
            onClearSearch={clearSearch}
          />
        );
      }

      if (item.type === "section") {
        return (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{item.title}</Text>
            <Text style={styles.count}>{item.count}</Text>
          </View>
        );
      }

      if (item.type === "empty")
        return <Text style={styles.empty}>{item.message}</Text>;

      return (
        <ConcertRow
          concert={item.item}
          isUpcoming={item.isUpcoming}
          onOpenMenu={openRowMenu}
        />
      );
    },
    [searchQuery, filterMode, clearSearch, openRowMenu]
  );

  if (isLoading) {
    return (
      <SafeAreaView
        style={[
          styles.container,
          { justifyContent: "center", alignItems: "center" },
        ]}
      >
        <ActivityIndicator />
        <Text style={{ color: "#cfcfe6", marginTop: 10 }}>
          Restoring your concerts…
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={rows}
        keyExtractor={(row, idx) => {
          if (row.type === "filters") return "filters";
          if (row.type === "section") return `section-${row.title}`;
          if (row.type === "empty") return `empty-${idx}`;
          return row.item.id;
        }}
        renderItem={renderRow}
        ListHeaderComponent={
          <>
            <Text style={styles.title}>Concert List</Text>
            <View style={styles.card}>
              <Text style={styles.label}>Headliner</Text>
              {/* Spotify autocomplete wrapper */}
              <View style={{ position: "relative" }}>
                <TextInput
                  value={name}
                  onChangeText={(t) => {
                    setName(t);
                    // if user types after selecting, clear selection
                    if (
                      selectedArtist &&
                      normalize(selectedArtist.name ?? "").toLowerCase() !==
                        normalize(t).toLowerCase()
                    ) {
                      setSelectedArtist(null);
                    }
                    if (t.length >= 3) setShowArtistSuggestions(true);
                    else setShowArtistSuggestions(false);
                  }}
                  onFocus={() => {
                    if (name.length >= 3) setShowArtistSuggestions(true);
                  }}
                  onBlur={() => {
                    setTimeout(() => setShowArtistSuggestions(false), 140);
                  }}
                  placeholder="e.g., Green Day"
                  placeholderTextColor="#66668a"
                  style={styles.input}
                  returnKeyType="next"
                  autoCapitalize="words"
                  autoCorrect={false}
                  onSubmitEditing={() => subNameRef.current?.focus()}
                  blurOnSubmit={false}
                />

                {/* ✅ only show dropdown when name.length >= 3 */}
                {showArtistSuggestions && name.length >= 3 && (
                  <View style={styles.suggestBox}>
                    {artistLoading && (
                      <Text style={styles.suggestHint}>Searching…</Text>
                    )}
                    {!artistLoading && visibleArtistSuggestions.length === 0 ? (
                      <Text style={styles.suggestHint}>No matches</Text>
                    ) : (
                      visibleArtistSuggestions.map((a, idx) => (
                        <Pressable
                          key={`${a.id ?? "noid"}-${a.name ?? idx}`}
                          onPress={() => {
                            if (!a?.name) return;
                            setSelectedArtist(a);
                            setName(a.name);
                            setShowArtistSuggestions(false);
                            setTimeout(() => subNameRef.current?.focus(), 50);
                          }}
                          style={({ pressed }) => [
                            styles.suggestRow,
                            idx === visibleArtistSuggestions.length - 1 && {
                              borderBottomWidth: 0,
                            },
                            pressed && { opacity: 0.85 },
                          ]}
                        >
                          <View style={styles.suggestLeft}>
                            {a.imageUrl ? (
                              <Image
                                source={{ uri: a.imageUrl }}
                                style={styles.suggestAvatar}
                              />
                            ) : (
                              <View style={styles.suggestAvatarPlaceholder}>
                                <Text style={styles.suggestAvatarText}>
                                  {initialsFromName(a.name ?? "")}
                                </Text>
                              </View>
                            )}
                            <Text style={styles.suggestText} numberOfLines={1}>
                              {a.name}
                            </Text>
                          </View>
                          <Text style={styles.suggestSource}>Spotify</Text>
                        </Pressable>
                      ))
                    )}
                  </View>
                )}
              </View>

              <Text style={styles.label}>Openers (optional)</Text>
              <TextInput
                ref={subNameRef}
                value={subName}
                onChangeText={setSubName}
                placeholder="e.g., w/ Support"
                placeholderTextColor="#66668a"
                style={styles.input}
                returnKeyType="next"
                autoCapitalize="sentences"
                onSubmitEditing={() => locationRef.current?.focus()}
                blurOnSubmit={false}
              />

              <Text style={styles.label}>Date</Text>
              <Pressable
                onPress={openCalendar}
                style={({ pressed }) => [
                  styles.dateField,
                  pressed && { opacity: 0.9 },
                ]}
              >
                <Text
                  style={[
                    styles.dateFieldText,
                    !date && { color: "#66668a" },
                  ]}
                >
                  {date || "Tap to choose a date"}
                </Text>
              </Pressable>

              <Text style={styles.label}>Venue</Text>
              <TextInput
                ref={locationRef}
                value={location}
                onChangeText={setLocation}
                placeholder="e.g., The Fillmore"
                placeholderTextColor="#66668a"
                style={styles.input}
                returnKeyType="done"
                autoCapitalize="words"
                onSubmitEditing={submit}
              />

              <Pressable
                onPress={submit}
                style={({ pressed }) => [
                  styles.button,
                  (!canSubmit || isSubmitting || pressed) &&
                    styles.buttonPressed,
                  (!canSubmit || isSubmitting) && styles.buttonDisabled,
                ]}
                disabled={!canSubmit || isSubmitting}
              >
                <Text style={styles.buttonText}>
                  {isSubmitting
                    ? "Adding…"
                    : editingId
                    ? "Update Concert"
                    : "Add Concert"}
                </Text>
              </Pressable>

              {editingId && (
                <View style={styles.actionsRow}>
                  <Pressable
                    onPress={cancelEdit}
                    style={({ pressed }) => [
                      styles.secondaryBtn,
                      pressed && { opacity: 0.8 },
                    ]}
                  >
                    <Text style={styles.secondaryText}>Cancel Edit</Text>
                  </Pressable>
                </View>
              )}
            </View>
          </>
        }
        // filters row is the first row in data; ListHeaderComponent is index 0 => sticky index 1
        stickyHeaderIndices={[1]}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 24 }}
      />

      {/* Calendar modal */}
      <CalendarModal
        visible={calendarOpen}
        date={date}
        calendarCursor={calendarCursor}
        setCalendarCursor={setCalendarCursor}
        onPickDay={onPickDay}
        onClose={closeCalendar}
      />

      {/* Row actions menu modal */}
      <RowMenuModal
        visible={menuOpen}
        target={menuTarget}
        onClose={closeRowMenu}
        onEdit={startEdit}
        onDelete={confirmRemove}
      />
    </SafeAreaView>
  );
}

/* ========================= Styles ========================= */
const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#0b0b0f" },
  title: { fontSize: 28, fontWeight: "700", color: "white", marginBottom: 12 },
  card: {
    backgroundColor: "#161622",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#24243a",
  },
  label: { color: "#cfcfe6", marginTop: 10, marginBottom: 6, fontSize: 13 },
  input: {
    backgroundColor: "#0f0f18",
    color: "white",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#2a2a44",
  },
  
  // Autocomplete dropdown
  suggestBox: {
    position: "absolute",
    top: 52,
    left: 0,
    right: 0,
    backgroundColor: "#0f0f18",
    borderWidth: 1,
    borderColor: "#2a2a44",
    borderRadius: 12,
    overflow: "hidden",
    zIndex: 50,
    elevation: 8, // Android
  },
  suggestHint: {
    color: "#9a9ab5",
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  suggestRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#2a2a44",
  },
  suggestLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  suggestAvatar: { width: 28, height: 28, borderRadius: 8 },
  suggestAvatarPlaceholder: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#1b1b2a",
    borderWidth: 1,
    borderColor: "#2a2a44",
    alignItems: "center",
    justifyContent: "center",
  },
  suggestAvatarText: { color: "#cfcfe6", fontWeight: "900", fontSize: 11 },
  suggestText: {
    color: "#cfcfe6",
    fontWeight: "800",
    flexShrink: 1,
    paddingRight: 10,
  },
  suggestSource: {
    color: "#66668a",
    fontWeight: "700",
    fontSize: 12,
  },

  dateField: {
    backgroundColor: "#0f0f18",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#2a2a44",
  },
  dateFieldText: { color: "white" },
  button: {
    marginTop: 14,
    backgroundColor: "#4f46e5",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonPressed: { opacity: 0.9 },
  buttonDisabled: { backgroundColor: "#2b2b3f" },
  buttonText: { color: "white", fontWeight: "700", fontSize: 16 },
  actionsRow: { flexDirection: "row", gap: 10, marginTop: 10 },
  secondaryBtn: {
    flex: 1,
    backgroundColor: "#0f0f18",
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2a2a44",
  },
  secondaryText: { color: "#cfcfe6", fontWeight: "700" },

  controlsCard: {
    backgroundColor: "#161622",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "#24243a",
    marginBottom: 10,
  },
  searchRow: { position: "relative", justifyContent: "center" },
  searchInput: {
    backgroundColor: "#0f0f18",
    color: "white",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#2a2a44",
  },
  clearBtn: {
    position: "absolute",
    right: 8,
    height: 28,
    width: 28,
    borderRadius: 14,
    backgroundColor: "#1b1b2a",
    borderWidth: 1,
    borderColor: "#2a2a44",
    alignItems: "center",
    justifyContent: "center",
  },
  clearBtnText: {
    color: "#cfcfe6",
    fontWeight: "900",
    fontSize: 18,
    marginTop: -2,
  },
  filterRow: { flexDirection: "row", gap: 10, marginTop: 10 },
  filterBtn: {
    flex: 1,
    backgroundColor: "#0f0f18",
    borderWidth: 1,
    borderColor: "#2a2a44",
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
  },
  filterBtnActive: { borderColor: "#4f46e5", backgroundColor: "#141432" },
  filterText: { color: "#cfcfe6", fontWeight: "800" },
  filterTextActive: { color: "white" },

  empty: { color: "#9a9ab5", marginTop: 18, textAlign: "center" },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    marginTop: 8,
  },
  sectionTitle: { color: "white", fontSize: 18, fontWeight: "700" },
  count: {
    color: "#cfcfe6",
    backgroundColor: "#161622",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#24243a",
  },

  row: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#161622",
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#24243a",
  },
  
  // Headliner image
  avatarWrap: {
    width: 52,
    height: 52,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#2a2a44",
    backgroundColor: "#0f0f18",
  },
  avatar: { width: "100%", height: "100%" },
  avatarPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0f0f18",
  },
  avatarText: { color: "#cfcfe6", fontWeight: "900" },

  rowTopLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowTitle: { color: "white", fontWeight: "800", fontSize: 16, flexShrink: 1 },
  rowSub: { color: "#cfcfe6", marginTop: 2 },
  rowMeta: { color: "#9a9ab5", marginTop: 6 },
  badgeUpcoming: {
    backgroundColor: "#1c1a3a",
    borderWidth: 1,
    borderColor: "#4f46e5",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  badgeUpcomingText: { color: "#cfcfe6", fontWeight: "800", fontSize: 12 },
  moreBtn: {
    alignSelf: "center",
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0f0f18",
    borderWidth: 1,
    borderColor: "#2a2a44",
  },
  moreBtnText: { color: "white", fontSize: 22, fontWeight: "900", marginTop: -6 },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    padding: 16,
  },
  modalCard: {
    backgroundColor: "#161622",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#24243a",
    padding: 12,
  },
  calendarHeader: { flexDirection: "row", gap: 10, marginBottom: 10 },
  dropdown: {
    flex: 1,
    backgroundColor: "#0f0f18",
    borderWidth: 1,
    borderColor: "#2a2a44",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  dropdownText: { color: "white", fontWeight: "800" },
  modalClose: {
    marginTop: 10,
    backgroundColor: "#0f0f18",
    borderWidth: 1,
    borderColor: "#2a2a44",
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
  },
  modalCloseText: { color: "#cfcfe6", fontWeight: "800" },

  pickerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    padding: 16,
  },
  pickerCard: {
    backgroundColor: "#161622",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#24243a",
    padding: 12,
    maxHeight: "75%",
  },
  pickerTitle: { color: "white", fontWeight: "900", fontSize: 16, marginBottom: 10 },
  pickerRow: {
    height: 44,
    borderRadius: 10,
    paddingHorizontal: 12,
    justifyContent: "center",
    backgroundColor: "#0f0f18",
    borderWidth: 1,
    borderColor: "#2a2a44",
  },
  pickerRowSelected: { borderColor: "#4f46e5" },
  pickerRowText: { color: "#cfcfe6", fontWeight: "700" },
  pickerRowTextSelected: { color: "white" },
  pickerClose: {
    marginTop: 6,
    backgroundColor: "#0f0f18",
    borderWidth: 1,
    borderColor: "#2a2a44",
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
  },
  pickerCloseText: { color: "#cfcfe6", fontWeight: "800" },

  menuBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    padding: 16,
  },
  menuCard: {
    backgroundColor: "#161622",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#24243a",
    padding: 12,
  },
  menuTitle: { color: "white", fontWeight: "900", fontSize: 16, marginBottom: 10 },
  menuItem: {
    backgroundColor: "#0f0f18",
    borderWidth: 1,
    borderColor: "#2a2a44",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  menuItemText: { color: "#cfcfe6", fontWeight: "800", fontSize: 14 },
  menuItemDanger: { borderColor: "#4a2a2a", backgroundColor: "#2a1b1b" },
  menuItemTextDanger: { color: "#ffb4b4" },
});