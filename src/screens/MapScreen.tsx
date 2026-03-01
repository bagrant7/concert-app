import React, { useCallback, useState, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import MapView, { Marker, Callout } from 'react-native-maps';
import { useFocusEffect } from '@react-navigation/native';
import { Concert } from '../types/Concert';
import { loadConcerts } from '../utils/storage';
import { getGenreColor, formatDate } from '../utils/helpers';
import { colors, spacing, fontSize } from '../utils/theme';

const { width, height } = Dimensions.get('window');

const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#1d1d1d' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1d1d1d' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2c2c2c' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e0e0e' }] },
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
];

export default function MapScreen() {
  const [concerts, setConcerts] = useState<Concert[]>([]);
  const mapRef = useRef<MapView>(null);

  useFocusEffect(useCallback(() => {
    (async () => {
      const data = await loadConcerts();
      setConcerts(data);
      if (data.length && mapRef.current) {
        const coords = data.map(c => ({ latitude: c.latitude, longitude: c.longitude }));
        mapRef.current.fitToCoordinates(coords, {
          edgePadding: { top: 100, right: 50, bottom: 50, left: 50 },
          animated: false,
        });
      }
    })();
  }, []));

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        customMapStyle={darkMapStyle}
        initialRegion={{
          latitude: 37.7749,
          longitude: -122.4194,
          latitudeDelta: 0.5,
          longitudeDelta: 0.5,
        }}
      >
        {concerts.map(c => (
          <Marker
            key={c.id}
            coordinate={{ latitude: c.latitude, longitude: c.longitude }}
            pinColor={getGenreColor(c.genre)}
          >
            <Callout>
              <View style={styles.callout}>
                <Text style={styles.calloutArtist}>{c.artist}</Text>
                <Text style={styles.calloutVenue}>{c.venue}</Text>
                <Text style={styles.calloutDate}>{formatDate(c.date)}</Text>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>
      <View style={styles.overlay}>
        <Text style={styles.overlayTitle}>Venues</Text>
        <Text style={styles.overlayCount}>{new Set(concerts.map(c => c.venue)).size} visited</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  map: { width, height },
  callout: { padding: 8, minWidth: 150 },
  calloutArtist: { fontWeight: '800', fontSize: fontSize.md },
  calloutVenue: { color: '#666', fontSize: fontSize.sm, marginTop: 2 },
  calloutDate: { color: '#999', fontSize: fontSize.xs, marginTop: 2 },
  overlay: {
    position: 'absolute',
    top: 60,
    left: spacing.md,
    backgroundColor: colors.card + 'EE',
    borderRadius: 12,
    padding: spacing.md,
  },
  overlayTitle: { color: colors.text, fontSize: fontSize.xl, fontWeight: '900' },
  overlayCount: { color: colors.textSecondary, fontSize: fontSize.sm },
});
