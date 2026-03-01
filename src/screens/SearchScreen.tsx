import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
  Keyboard,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Concert } from '../types/Concert';
import { loadConcerts } from '../utils/storage';
import { colors, spacing, fontSize } from '../utils/theme';
import { getGenreColor, formatDate } from '../utils/helpers';
import ConcertCard from '../components/ConcertCard';

const RECENT_SEARCHES_KEY = 'recent_searches';
const MAX_RECENT = 5;

async function loadRecentSearches(): Promise<string[]> {
  try {
    const json = await AsyncStorage.getItem(RECENT_SEARCHES_KEY);
    return json ? JSON.parse(json) : [];
  } catch {
    return [];
  }
}

async function saveRecentSearch(term: string, existing: string[]): Promise<string[]> {
  const cleaned = term.trim();
  if (!cleaned) return existing;
  const updated = [cleaned, ...existing.filter(s => s !== cleaned)].slice(0, MAX_RECENT);
  await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  return updated;
}

export default function SearchScreen() {
  const [all, setAll] = useState<Concert[]>([]);
  const [query, setQuery] = useState('');
  const [selectedGenres, setSelectedGenres] = useState<Set<string>>(new Set());
  const [selectedYears, setSelectedYears] = useState<Set<string>>(new Set());
  const [isFocused, setIsFocused] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const inputRef = useRef<TextInput>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useFocusEffect(
    useCallback(() => {
      loadConcerts().then(setAll);
      loadRecentSearches().then(setRecentSearches);
    }, []),
  );

  // Debounce the query for smoother filtering
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(query), 150);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const activeGenres = useMemo(
    () => [...new Set(all.map(c => c.genre))].sort(),
    [all],
  );

  const activeYears = useMemo(() => {
    const years = [...new Set(all.map(c => c.date.substring(0, 4)))].sort();
    return years;
  }, [all]);

  const hasActiveFilters = debouncedQuery.length > 0 || selectedGenres.size > 0 || selectedYears.size > 0;

  const filtered = useMemo(() => {
    if (!hasActiveFilters) return [];

    const words = debouncedQuery
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 0);

    return all
      .filter(c => {
        // Genre chip filter
        if (selectedGenres.size > 0 && !selectedGenres.has(c.genre)) return false;
        // Year chip filter
        if (selectedYears.size > 0 && !selectedYears.has(c.date.substring(0, 4))) return false;
        // Text search: every word must match at least one field
        if (words.length > 0) {
          const searchable = [
            c.artist,
            c.venue,
            c.city,
            formatDate(c.date),
            c.date,
            c.genre,
          ]
            .join(' ')
            .toLowerCase();
          return words.every(w => searchable.includes(w));
        }
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [all, debouncedQuery, selectedGenres, selectedYears, hasActiveFilters]);

  const commitSearch = useCallback(() => {
    const term = query.trim();
    if (term) {
      saveRecentSearch(term, recentSearches).then(setRecentSearches);
    }
  }, [query, recentSearches]);

  const toggleGenre = (g: string) => {
    setSelectedGenres(prev => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return next;
    });
  };

  const toggleYear = (y: string) => {
    setSelectedYears(prev => {
      const next = new Set(prev);
      if (next.has(y)) next.delete(y);
      else next.add(y);
      return next;
    });
  };

  const applyRecent = (term: string) => {
    setQuery(term);
    setDebouncedQuery(term);
    Keyboard.dismiss();
  };

  const showRecents = isFocused && query.length === 0 && recentSearches.length > 0 && !hasActiveFilters;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Search</Text>
      </View>

      {/* Search bar */}
      <View style={[styles.searchWrap, isFocused && styles.searchWrapFocused]}>
        <Ionicons name="search" size={18} color={isFocused ? colors.accent : colors.textTertiary} />
        <TextInput
          ref={inputRef}
          style={styles.input}
          placeholder="Search artists, venues, cities, dates..."
          placeholderTextColor={colors.textTertiary}
          value={query}
          onChangeText={setQuery}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            setIsFocused(false);
            commitSearch();
          }}
          onSubmitEditing={commitSearch}
          autoCorrect={false}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity
            onPress={() => {
              setQuery('');
              setDebouncedQuery('');
              inputRef.current?.focus();
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Clear all filters */}
      {hasActiveFilters && (
        <TouchableOpacity
          style={styles.clearFiltersBtn}
          onPress={() => {
            setQuery('');
            setDebouncedQuery('');
            setSelectedGenres(new Set());
            setSelectedYears(new Set());
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="close-circle-outline" size={16} color={colors.accent} />
          <Text style={styles.clearFiltersText}>Clear all filters</Text>
        </TouchableOpacity>
      )}

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
        style={styles.chipScroll}
      >
        {activeYears.map(y => {
          const active = selectedYears.has(y);
          return (
            <TouchableOpacity
              key={`y-${y}`}
              style={[styles.chip, active && styles.chipActiveYear]}
              onPress={() => toggleYear(y)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActiveYear]}>{y}</Text>
            </TouchableOpacity>
          );
        })}
        {activeYears.length > 0 && activeGenres.length > 0 && <View style={styles.chipDivider} />}
        {activeGenres.map(g => {
          const active = selectedGenres.has(g);
          const gc = getGenreColor(g);
          return (
            <TouchableOpacity
              key={`g-${g}`}
              style={[
                styles.chip,
                active && { backgroundColor: gc + '25', borderColor: gc },
              ]}
              onPress={() => toggleGenre(g)}
            >
              <Text style={[styles.chipText, active && { color: gc }]}>{g}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Result count */}
      {hasActiveFilters && filtered.length > 0 && (
        <Text style={styles.resultCount}>
          {filtered.length} concert{filtered.length !== 1 ? 's' : ''} found
        </Text>
      )}

      {/* Recent searches */}
      {showRecents && (
        <View style={styles.recentsContainer}>
          <Text style={styles.recentsTitle}>Recent Searches</Text>
          {recentSearches.map((term, i) => (
            <TouchableOpacity
              key={`${term}-${i}`}
              style={styles.recentItem}
              onPress={() => applyRecent(term)}
            >
              <Ionicons name="time-outline" size={16} color={colors.textTertiary} />
              <Text style={styles.recentText}>{term}</Text>
              <Ionicons name="arrow-forward" size={14} color={colors.textTertiary} style={{ marginLeft: 'auto' }} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Results / Empty states */}
      {!hasActiveFilters && !showRecents ? (
        <View style={styles.empty}>
          <Ionicons name="search-outline" size={52} color={colors.textTertiary} />
          <Text style={styles.emptyTitle}>Start typing to search</Text>
          <Text style={styles.emptySubtitle}>Search across artists, venues, cities, and more</Text>
        </View>
      ) : hasActiveFilters ? (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={({ item }) => <ConcertCard concert={item} />}
          contentContainerStyle={{ paddingBottom: 120, paddingTop: spacing.xs }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="musical-notes-outline" size={52} color={colors.textTertiary} />
              <Text style={styles.emptyTitle}>No concerts found</Text>
              <Text style={styles.emptySubtitle}>Try different keywords or filters</Text>
            </View>
          }
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: 60,
    paddingBottom: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 14,
    marginHorizontal: spacing.md,
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 10,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  searchWrapFocused: {
    borderColor: colors.accent + '55',
    backgroundColor: colors.card,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: fontSize.md,
  },
  chipScroll: {
    maxHeight: 44,
    marginBottom: spacing.sm,
  },
  chipRow: {
    paddingHorizontal: spacing.md,
    gap: 8,
    alignItems: 'center',
  },
  chip: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  chipText: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  chipActiveYear: {
    backgroundColor: colors.accent + '25',
    borderColor: colors.accent,
  },
  chipTextActiveYear: {
    color: colors.accentLight,
  },
  chipDivider: {
    width: 1,
    height: 20,
    backgroundColor: colors.border,
    marginHorizontal: 4,
  },
  resultCount: {
    color: colors.textTertiary,
    fontSize: fontSize.xs,
    fontWeight: '500',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  recentsContainer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  recentsTitle: {
    color: colors.textTertiary,
    fontSize: fontSize.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  recentText: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
  },
  clearFiltersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginLeft: spacing.md,
    marginBottom: spacing.sm,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.accent + '44',
    backgroundColor: colors.accent + '11',
  },
  clearFiltersText: {
    color: colors.accent,
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  empty: {
    alignItems: 'center',
    paddingTop: 80,
    gap: 10,
    paddingHorizontal: spacing.lg,
  },
  emptyTitle: {
    color: colors.textSecondary,
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
  emptySubtitle: {
    color: colors.textTertiary,
    fontSize: fontSize.sm,
    textAlign: 'center',
  },
});
