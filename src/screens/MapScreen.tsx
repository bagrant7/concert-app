import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Concert } from '../types/Concert';
import { loadConcerts } from '../utils/storage';
import { getGenreColor, formatDate } from '../utils/helpers';
import { colors, spacing, fontSize } from '../utils/theme';

export default function MapScreen() {
  const [concerts, setConcerts] = useState<Concert[]>([]);

  useFocusEffect(useCallback(() => {
    loadConcerts().then(setConcerts);
  }, []));

  // Group concerts by venue
  const venueGroups = concerts.reduce((acc, concert) => {
    const key = `${concert.venue}, ${concert.city}`;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(concert);
    return acc;
  }, {} as Record<string, Concert[]>);

  const venues = Object.entries(venueGroups);
  const uniqueVenues = venues.length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Venues</Text>
        <Text style={styles.subtitle}>{uniqueVenues} visited</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {venues.map(([venueKey, venueConcerts]) => {
          const firstConcert = venueConcerts[0];
          const genres = [...new Set(venueConcerts.map(c => c.genre))];
          const showCount = venueConcerts.length;
          
          return (
            <View key={venueKey} style={styles.venueCard}>
              <View style={styles.venueHeader}>
                <View style={styles.venueInfo}>
                  <Text style={styles.venueName}>{firstConcert.venue}</Text>
                  <View style={styles.locationRow}>
                    <Ionicons name="location-sharp" size={14} color={colors.textSecondary} />
                    <Text style={styles.venueLocation}>{firstConcert.city}</Text>
                  </View>
                </View>
                <View style={styles.showCount}>
                  <Text style={styles.showCountText}>{showCount}</Text>
                  <Text style={styles.showCountLabel}>show{showCount !== 1 ? 's' : ''}</Text>
                </View>
              </View>

              <View style={styles.genreRow}>
                {genres.map(genre => (
                  <View 
                    key={genre} 
                    style={[styles.genreTag, { backgroundColor: getGenreColor(genre) + '20', borderColor: getGenreColor(genre) + '40' }]}
                  >
                    <Text style={[styles.genreTagText, { color: getGenreColor(genre) }]}>{genre}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.concertList}>
                {venueConcerts.slice(0, 3).map(concert => (
                  <View key={concert.id} style={styles.concertItem}>
                    <Text style={styles.concertArtist}>{concert.artist}</Text>
                    <Text style={styles.concertDate}>{formatDate(concert.date)}</Text>
                  </View>
                ))}
                {venueConcerts.length > 3 && (
                  <Text style={styles.moreText}>+{venueConcerts.length - 3} more</Text>
                )}
              </View>
            </View>
          );
        })}

        {venues.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="location-outline" size={52} color={colors.textTertiary} />
            <Text style={styles.emptyTitle}>No venues yet</Text>
            <Text style={styles.emptySubtitle}>Add some concerts to see your venue map</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: colors.bg 
  },
  header: { 
    paddingHorizontal: spacing.md, 
    paddingTop: 60, 
    paddingBottom: spacing.lg 
  },
  title: { 
    color: colors.text, 
    fontSize: 34, 
    fontWeight: '900', 
    letterSpacing: -0.5 
  },
  subtitle: { 
    color: colors.textSecondary, 
    fontSize: fontSize.md, 
    marginTop: 4 
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: 100,
  },
  venueCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  venueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  venueInfo: {
    flex: 1,
  },
  venueName: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '800',
    marginBottom: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  venueLocation: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
  },
  showCount: {
    alignItems: 'center',
    backgroundColor: colors.cardAlt,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  showCountText: {
    color: colors.text,
    fontSize: fontSize.xl,
    fontWeight: '800',
    lineHeight: 28,
  },
  showCountLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  genreRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: spacing.sm,
  },
  genreTag: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  genreTagText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  concertList: {
    gap: 6,
  },
  concertItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  concertArtist: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: '600',
    flex: 1,
  },
  concertDate: {
    color: colors.textTertiary,
    fontSize: fontSize.xs,
  },
  moreText: {
    color: colors.textTertiary,
    fontSize: fontSize.xs,
    fontStyle: 'italic',
    marginTop: 4,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 80,
    gap: 10,
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