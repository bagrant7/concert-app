import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Alert } from 'react-native';
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

  const openInAppleMaps = (concert: Concert) => {
    if (concert.latitude && concert.longitude) {
      // Open specific venue in Apple Maps
      const url = `http://maps.apple.com/?q=${encodeURIComponent(concert.venue)}&ll=${concert.latitude},${concert.longitude}`;
      Linking.openURL(url);
    } else {
      // Search for venue name in Apple Maps
      const url = `http://maps.apple.com/?q=${encodeURIComponent(`${concert.venue}, ${concert.city}`)}`;
      Linking.openURL(url);
    }
  };

  const openAllVenuesInMaps = () => {
    if (venues.length === 0) return;

    // Create a multi-point Apple Maps URL with all venues
    const venuesWithCoords = venues
      .map(([_, venueConcerts]) => venueConcerts[0])
      .filter(c => c.latitude && c.longitude);

    if (venuesWithCoords.length > 0) {
      // For multiple locations, we'll create a search for the first venue and let user explore
      const firstVenue = venuesWithCoords[0];
      const url = `http://maps.apple.com/?q=${encodeURIComponent(firstVenue.venue)}&ll=${firstVenue.latitude},${firstVenue.longitude}`;
      Linking.openURL(url);
    } else {
      Alert.alert('Map Unavailable', 'No venue coordinates available for mapping');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Venues</Text>
          <Text style={styles.subtitle}>{uniqueVenues} visited</Text>
        </View>
        {venues.length > 0 && (
          <TouchableOpacity 
            style={styles.mapButton}
            onPress={openAllVenuesInMaps}
            activeOpacity={0.7}
          >
            <Ionicons name="map" size={18} color={colors.accent} />
            <Text style={styles.mapButtonText}>Apple Maps</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {venues.map(([venueKey, venueConcerts]) => {
          const firstConcert = venueConcerts[0];
          const genres = [...new Set(venueConcerts.map(c => c.genre))];
          const showCount = venueConcerts.length;
          
          return (
            <TouchableOpacity 
              key={venueKey} 
              style={styles.venueCard}
              onPress={() => openInAppleMaps(firstConcert)}
              activeOpacity={0.7}
            >
              <View style={styles.venueHeader}>
                <View style={styles.venueInfo}>
                  <View style={styles.venueNameRow}>
                    <Text style={styles.venueName}>{firstConcert.venue}</Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                  </View>
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

              <View style={styles.tapHint}>
                <Ionicons name="map-outline" size={14} color={colors.textTertiary} />
                <Text style={styles.tapHintText}>Tap to open in Apple Maps</Text>
              </View>
            </TouchableOpacity>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.md, 
    paddingTop: 60, 
    paddingBottom: spacing.lg 
  },
  headerLeft: {
    flex: 1,
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
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent + '18',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
    marginTop: 8,
  },
  mapButtonText: {
    color: colors.accent,
    fontSize: fontSize.sm,
    fontWeight: '600',
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
  venueNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  venueName: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '800',
    flex: 1,
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
    marginLeft: 12,
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
    marginBottom: spacing.sm,
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
  tapHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  tapHintText: {
    color: colors.textTertiary,
    fontSize: fontSize.xs,
    fontStyle: 'italic',
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