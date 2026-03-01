import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, SectionList, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Concert } from '../types/Concert';
import { loadConcerts, deleteConcert } from '../utils/storage';
import { isUpcoming } from '../utils/helpers';
import { colors, spacing, fontSize } from '../utils/theme';
import ConcertCard from '../components/ConcertCard';
import CompactConcertRow from '../components/CompactConcertRow';

type ViewMode = 'timeline' | 'compact';

function getYearSections(concerts: Concert[]): { title: string; data: Concert[]; isUpcoming?: boolean }[] {
  const byYear: Record<string, Concert[]> = {};
  for (const c of concerts) {
    const year = c.date.slice(0, 4);
    if (!byYear[year]) byYear[year] = [];
    byYear[year].push(c);
  }
  return Object.keys(byYear)
    .sort((a, b) => b.localeCompare(a))
    .map(year => ({ title: year, data: byYear[year] }));
}

export default function HomeScreen() {
  const [concerts, setConcerts] = useState<Concert[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('timeline');

  const load = useCallback(async () => {
    const data = await loadConcerts();
    data.sort((a, b) => b.date.localeCompare(a.date));
    setConcerts(data);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const toggleView = () => setViewMode(v => v === 'timeline' ? 'compact' : 'timeline');

  const handleDelete = (concert: Concert) => {
    Alert.alert(
      'Delete Concert',
      `Remove ${concert.artist} at ${concert.venue}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteConcert(concert.id);
            await load();
          },
        },
      ],
    );
  };

  const upcoming = concerts.filter(isUpcoming).sort((a, b) => a.date.localeCompare(b.date));
  const past = concerts.filter(c => !isUpcoming(c)).sort((a, b) => b.date.localeCompare(a.date));

  // Timeline sections
  const timelineSections: { title: string; data: Concert[]; isUpcoming?: boolean }[] = [
    ...(upcoming.length ? [{ title: 'Upcoming', data: upcoming, isUpcoming: true }] : []),
    ...(past.length ? [{ title: 'Past Shows', data: past }] : []),
  ];

  // Compact sections: upcoming first, then year-grouped past
  const compactSections: { title: string; data: Concert[]; isUpcoming?: boolean }[] = [
    ...(upcoming.length ? [{ title: 'Upcoming', data: upcoming, isUpcoming: true }] : []),
    ...getYearSections(past),
  ];

  const isCompact = viewMode === 'compact';
  const sections = isCompact ? compactSections : timelineSections;

  const showUpcomingEmpty = upcoming.length === 0;

  return (
    <View style={styles.container}>
      <SectionList
        sections={sections}
        keyExtractor={item => item.id}
        renderItem={({ item }) =>
          isCompact
            ? <CompactConcertRow concert={item} />
            : <ConcertCard concert={item} onLongPress={() => handleDelete(item)} />
        }
        renderSectionHeader={({ section }) => {
          const sectionData = section as { title: string; data: Concert[]; isUpcoming?: boolean };
          if (isCompact && !sectionData.isUpcoming) {
            return (
              <View style={styles.yearHeader}>
                <Text style={styles.yearText}>{section.title}</Text>
                <View style={styles.yearLine} />
                <Text style={styles.yearCount}>{section.data.length}</Text>
              </View>
            );
          }
          return (
            <View style={[styles.sectionHeader, sectionData.isUpcoming && styles.sectionHeaderUpcoming]}>
              {sectionData.isUpcoming && <View style={styles.sectionDot} />}
              <Text style={[styles.sectionTitle, sectionData.isUpcoming && styles.sectionTitleUpcoming]}>
                {section.title}
              </Text>
              <Text style={[styles.sectionCount, sectionData.isUpcoming && styles.sectionCountUpcoming]}>
                {section.data.length}
              </Text>
            </View>
          );
        }}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.headerRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>
                  {isCompact ? 'Concert Log' : 'Concerts'}
                </Text>
                <Text style={styles.subtitle}>
                  {concerts.length} shows tracked
                  {upcoming.length > 0 ? ` · ${upcoming.length} upcoming` : ''}
                </Text>
              </View>
              <TouchableOpacity
                onPress={toggleView}
                style={styles.toggleButton}
                activeOpacity={0.7}
              >
                <Text style={styles.toggleIcon}>
                  {isCompact ? '◫' : '☰'}
                </Text>
              </TouchableOpacity>
            </View>
            {showUpcomingEmpty && (
              <View style={styles.upcomingEmpty}>
                <Text style={styles.upcomingEmptyText}>No upcoming shows — add one!</Text>
              </View>
            )}
          </View>
        }
        ListFooterComponent={
          isCompact && concerts.length > 0 ? (
            <View style={styles.footer}>
              <View style={styles.footerLine} />
              <Text style={styles.footerText}>
                {concerts.length} concert{concerts.length !== 1 ? 's' : ''}
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No concerts yet. Add your first show!</Text>
          </View>
        }
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  list: { paddingBottom: 100 },
  header: { paddingHorizontal: spacing.md, paddingTop: 60, paddingBottom: spacing.lg },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  title: { color: colors.text, fontSize: 34, fontWeight: '900', letterSpacing: -0.5 },
  subtitle: { color: colors.textSecondary, fontSize: fontSize.md, marginTop: 4 },
  toggleButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  toggleIcon: {
    color: colors.textSecondary,
    fontSize: 18,
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: 8,
  },
  sectionHeaderUpcoming: {
    backgroundColor: colors.accent + '0A',
    borderRadius: 8,
    marginHorizontal: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  sectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  sectionTitle: { color: colors.textSecondary, fontSize: fontSize.sm, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  sectionTitleUpcoming: { color: colors.accentLight },
  sectionCount: {
    color: colors.textTertiary,
    fontSize: fontSize.xs,
    backgroundColor: colors.cardAlt,
    borderRadius: 8,
    overflow: 'hidden',
    paddingHorizontal: 6,
    paddingVertical: 1,
    fontWeight: '600',
  },
  sectionCountUpcoming: {
    backgroundColor: colors.accent + '22',
    color: colors.accentLight,
  },
  // Compact year headers
  yearHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: 20,
    paddingBottom: 8,
    gap: 10,
  },
  yearText: {
    color: colors.accent,
    fontSize: fontSize.lg,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  yearLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  yearCount: {
    color: colors.textTertiary,
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  // Upcoming empty state
  upcomingEmpty: {
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  upcomingEmptyText: {
    color: colors.textTertiary,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  // Footer
  footer: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 8,
    paddingHorizontal: spacing.md,
  },
  footerLine: {
    width: 40,
    height: 2,
    backgroundColor: colors.border,
    borderRadius: 1,
    marginBottom: 12,
  },
  footerText: {
    color: colors.textTertiary,
    fontSize: fontSize.sm,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  empty: { alignItems: 'center', padding: spacing.xl },
  emptyText: { color: colors.textTertiary, fontSize: fontSize.md },
});
