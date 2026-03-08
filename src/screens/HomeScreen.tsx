import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Keyboard,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import {
  Concert,
  SpotifyArtist,
  loadConcerts,
  saveConcerts,
  normalize,
  makeId,
  normalizeKey,
  parseYYYYMMDD,
  clampCursorToBounds,
  toYYYYMMDD,
  isValidDateYYYYMMDD,
  dateEpochLocal,
  sortByDateThenTouch,
  fetchSpotifySuggest,
  fetchSpotifyBestArtist,
  initialsFromName,
} from "../utils/concertUtils";
import { SearchBar, ConcertRow, CalendarModal, RowMenuModal } from "../components/ConcertComponents";

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

type Row =
  | { type: "search" }
  | { type: "section"; title: "Upcoming"; count: number }
  | { type: "concert"; item: Concert; isUpcoming: boolean }
  | { type: "empty"; message: string };

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

  // Search
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
      .filter((a) => (a?.name ? normalize(a.name).toLowerCase() !== nKey : false))
      .slice(0, 10);
  }, [spotifySuggestions, name]);

  /* ---------- load/save ---------- */
  useFocusEffect(
    useCallback(() => {
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
    }, [])
  );

  // Debounced save
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!isHydrated) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveConcerts(concerts).catch((e) => console.warn("Failed to save concerts:", e));
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

  const upcomingConcerts = useMemo(() => {
    const upcoming: Concert[] = [];
    for (const c of filteredBySearch) {
      const e = dateEpochLocal(c.date);
      if (e != null && e >= todayEpoch) upcoming.push(c);
    }
    upcoming.sort((a, b) => sortByDateThenTouch(a, b, "asc"));
    return upcoming;
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
        msg: `Pick a real date between 1945-01-01 and 2026-12-31.`,
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
  }, [validateFields, isSubmitting, concerts, editingId, clearFields, selectedArtist]);

  const startEdit = useCallback((concert: Concert) => {
    setEditingId(concert.id);
    setName(concert.name);
    setSubName(concert.subName);
    setDate(concert.date);
    setLocation(concert.location);
    setSelectedArtist(null);

    const parts = parseYYYYMMDD(concert.date);
    if (parts)
      setCalendarCursor(clampCursorToBounds(new Date(parts.y, parts.m - 1, 1)));

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

  const onPickDay = useCallback((day: any) => {
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
    const out: Row[] = [{ type: "search" }];

    out.push({ type: "section", title: "Upcoming", count: upcomingConcerts.length });

    if (upcomingConcerts.length === 0) {
      out.push({
        type: "empty",
        message: searchQuery
          ? "No upcoming shows match your search."
          : "No upcoming shows. Add some concerts!",
      });
    } else {
      for (const c of upcomingConcerts)
        out.push({ type: "concert", item: c, isUpcoming: true });
    }

    return out;
  }, [upcomingConcerts, searchQuery]);

  const clearSearch = useCallback(() => {
    setSearchQuery("");
    Keyboard.dismiss();
  }, []);

  const renderRow = useCallback(
    ({ item }: { item: Row }) => {
      if (item.type === "search") {
        return (
          <SearchBar
            searchQuery={searchQuery}
            onChangeSearch={setSearchQuery}
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
    [searchQuery, clearSearch, openRowMenu]
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
          if (row.type === "search") return "search";
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
        // search row is the first row in data
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
});