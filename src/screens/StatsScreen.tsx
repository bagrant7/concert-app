import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { BarChart } from 'react-native-chart-kit';
import { Concert } from '../types/Concert';
import { loadConcerts } from '../utils/storage';
import { getDurationHours, getGenreColor } from '../utils/helpers';
import { colors, spacing, fontSize } from '../utils/theme';
import StatCard from '../components/StatCard';

const screenWidth = Dimensions.get('window').width;

export default function StatsScreen() {
  const [concerts, setConcerts] = useState<Concert[]>([]);

  useFocusEffect(useCallback(() => {
    loadConcerts().then(setConcerts);
  }, []));

  const totalShows = concerts.length;
  const totalHours = concerts.reduce((sum, c) => sum + getDurationHours(c.startTime, c.endTime), 0);
  const avgRating = totalShows ? (concerts.reduce((s, c) => s + c.rating, 0) / totalShows) : 0;
  const uniqueVenues = new Set(concerts.map(c => c.venue)).size;
  const uniqueCities = new Set(concerts.map(c => c.city).filter(Boolean)).size;

  // Top artists
  const artistCounts: Record<string, number> = {};
  concerts.forEach(c => { artistCounts[c.artist] = (artistCounts[c.artist] || 0) + 1; });
  const topArtists = Object.entries(artistCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);

  // Genre breakdown
  const genreCounts: Record<string, number> = {};
  concerts.forEach(c => { genreCounts[c.genre] = (genreCounts[c.genre] || 0) + 1; });
  const sortedGenres = Object.entries(genreCounts).sort((a, b) => b[1] - a[1]);

  // Monthly chart
  const monthlyCounts: Record<string, number> = {};
  concerts.forEach(c => {
    const key = c.date.slice(0, 7); // YYYY-MM
    monthlyCounts[key] = (monthlyCounts[key] || 0) + 1;
  });
  const sortedMonths = Object.entries(monthlyCounts).sort((a, b) => a[0].localeCompare(b[0]));
  const monthLabels = sortedMonths.map(([m]) => {
    const d = new Date(m + '-01');
    return d.toLocaleDateString('en-US', { month: 'short' });
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 120 }}>
      <View style={styles.header}>
        <Text style={styles.title}>Your Stats</Text>
        <Text style={styles.subtitle}>The numbers behind the music</Text>
      </View>

      {/* Hero stats */}
      <View style={styles.heroRow}>
        <StatCard icon="musical-notes" label="Shows" value={totalShows} color={colors.accent} />
        <StatCard icon="time" label="Hours" value={totalHours.toFixed(1)} color={colors.success} />
      </View>
      <View style={styles.heroRow}>
        <StatCard icon="star" label="Avg Rating" value={avgRating.toFixed(1)} color={colors.star} />
        <StatCard icon="location" label="Venues" value={uniqueVenues} color="#E17055" />
      </View>
      <View style={styles.heroRow}>
        <StatCard icon="map" label="Cities" value={uniqueCities} color="#00B894" />
      </View>

      {/* Top Artists */}
      {topArtists.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top Artists</Text>
          {topArtists.map(([artist, count], i) => (
            <View key={artist} style={styles.topArtistRow}>
              <Text style={styles.topArtistRank}>{i + 1}</Text>
              <Text style={styles.topArtistName} numberOfLines={1}>{artist}</Text>
              <Text style={styles.topArtistCount}>{count} show{count !== 1 ? 's' : ''}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Genre breakdown */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Genre Breakdown</Text>
        {sortedGenres.map(([genre, count]) => {
          const pct = (count / totalShows) * 100;
          const gc = getGenreColor(genre);
          return (
            <View key={genre} style={styles.genreRow}>
              <View style={styles.genreInfo}>
                <View style={[styles.genreDot, { backgroundColor: gc }]} />
                <Text style={styles.genreLabel}>{genre}</Text>
                <Text style={styles.genreCount}>{count}</Text>
              </View>
              <View style={styles.barBg}>
                <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: gc }]} />
              </View>
            </View>
          );
        })}
      </View>

      {/* Monthly chart */}
      {sortedMonths.length > 1 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Shows per Month</Text>
          <View style={styles.chartWrap}>
            <BarChart
              data={{
                labels: monthLabels,
                datasets: [{ data: sortedMonths.map(([, v]) => v) }],
              }}
              width={screenWidth - spacing.md * 2}
              height={200}
              fromZero
              chartConfig={{
                backgroundColor: colors.card,
                backgroundGradientFrom: colors.card,
                backgroundGradientTo: colors.card,
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(108, 92, 231, ${opacity})`,
                labelColor: () => colors.textSecondary,
                barPercentage: 0.6,
                propsForBackgroundLines: { stroke: colors.border },
              }}
              style={{ borderRadius: 12 }}
              showValuesOnTopOfBars
              yAxisLabel=""
              yAxisSuffix=""
            />
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.md, paddingTop: 60, paddingBottom: spacing.lg },
  title: { color: colors.text, fontSize: 34, fontWeight: '900', letterSpacing: -0.5 },
  subtitle: { color: colors.textSecondary, fontSize: fontSize.md, marginTop: 4 },
  heroRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  section: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  sectionTitle: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: spacing.md,
  },
  genreRow: { marginBottom: 14 },
  genreInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  genreDot: { width: 10, height: 10, borderRadius: 5 },
  genreLabel: { color: colors.text, fontSize: fontSize.sm, fontWeight: '600', flex: 1 },
  genreCount: { color: colors.textTertiary, fontSize: fontSize.sm, fontWeight: '700' },
  barBg: { height: 6, backgroundColor: colors.cardAlt, borderRadius: 3 },
  barFill: { height: 6, borderRadius: 3 },
  chartWrap: { borderRadius: 12, overflow: 'hidden' },
  topArtistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 12,
  },
  topArtistRank: {
    color: colors.textTertiary,
    fontSize: fontSize.sm,
    fontWeight: '800',
    width: 24,
    textAlign: 'center',
  },
  topArtistName: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: '600',
    flex: 1,
  },
  topArtistCount: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
});
