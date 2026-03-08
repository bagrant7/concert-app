import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import {
  Concert,
  loadConcerts,
  saveConcerts,
  normalize,
  dateEpochLocal,
  sortByDateThenTouch,
} from "../utils/concertUtils";
import { SearchBar, ConcertRow, RowMenuModal } from "../components/ConcertComponents";

type Row =
  | { type: "search" }
  | { type: "section"; title: "Past Shows"; count: number }
  | { type: "concert"; item: Concert; isUpcoming: boolean }
  | { type: "empty"; message: string };

export default function PastShowsScreen() {
  // Data
  const [concerts, setConcerts] = useState<Concert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isHydrated, setIsHydrated] = useState(false);

  // Row menu
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuTarget, setMenuTarget] = useState<Concert | null>(null);

  // Search
  const [searchQuery, setSearchQuery] = useState("");

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

  // Auto-save when concerts change
  useEffect(() => {
    if (!isHydrated) return;
    const timer = setTimeout(() => {
      saveConcerts(concerts).catch((e) => console.warn("Failed to save concerts:", e));
    }, 300);
    return () => clearTimeout(timer);
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

  const pastConcerts = useMemo(() => {
    const past: Concert[] = [];
    for (const c of filteredBySearch) {
      const e = dateEpochLocal(c.date);
      if (e != null && e < todayEpoch) past.push(c);
    }
    past.sort((a, b) => sortByDateThenTouch(a, b, "desc"));
    return past;
  }, [filteredBySearch, todayEpoch]);

  /* ---------- helpers ---------- */
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

  /* ---------- row menu ---------- */
  const openRowMenu = useCallback((concert: Concert) => {
    setMenuTarget(concert);
    setMenuOpen(true);
  }, []);

  const closeRowMenu = useCallback(() => {
    setMenuOpen(false);
    setMenuTarget(null);
  }, []);

  // For past shows, we'll show a read-only view (no editing)
  const handleEdit = useCallback((_concert: Concert) => {
    Alert.alert(
      "Edit Not Available",
      "You can only edit concerts from the Home screen. Past shows are read-only here."
    );
  }, []);

  /* ---------- rows ---------- */
  const rows: Row[] = useMemo(() => {
    const out: Row[] = [{ type: "search" }];

    out.push({ type: "section", title: "Past Shows", count: pastConcerts.length });

    if (pastConcerts.length === 0) {
      out.push({
        type: "empty",
        message: searchQuery
          ? "No past shows match your search."
          : "No past shows yet. After concerts happen, they'll appear here!",
      });
    } else {
      for (const c of pastConcerts)
        out.push({ type: "concert", item: c, isUpcoming: false });
    }

    return out;
  }, [pastConcerts, searchQuery]);

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
          Loading past shows…
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
          <Text style={styles.title}>Past Shows</Text>
        }
        // search row is the first row in data
        stickyHeaderIndices={[1]}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 24 }}
      />

      {/* Row actions menu modal */}
      <RowMenuModal
        visible={menuOpen}
        target={menuTarget}
        onClose={closeRowMenu}
        onEdit={handleEdit}
        onDelete={confirmRemove}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#0b0b0f" },
  title: { fontSize: 28, fontWeight: "700", color: "white", marginBottom: 12 },

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