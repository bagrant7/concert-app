import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, Animated } from 'react-native';
import { Concert } from '../types/Concert';
import { getGenreColor, isUpcoming, getCountdownLabel } from '../utils/helpers';
import { colors, spacing, fontSize } from '../utils/theme';
import { fetchArtistImage, getArtistInitials } from '../utils/artistImage';

function formatCompactDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  const month = d.toLocaleDateString('en-US', { month: 'short' });
  const day = d.getDate();
  const year = d.getFullYear().toString().slice(2);
  return `${month} ${day}, '${year}`;
}

function SmallAvatar({ concert }: { concert: Concert }) {
  const [imageUrl, setImageUrl] = useState<string | null>(concert.artistImageUrl ?? null);
  const [loaded, setLoaded] = useState(false);
  const fadeAnim = useState(new Animated.Value(0))[0];
  const genreColor = getGenreColor(concert.genre);

  useEffect(() => {
    let mounted = true;
    if (!imageUrl) {
      fetchArtistImage(concert.artist).then((url) => {
        if (url && mounted) setImageUrl(url);
      });
    }
    return () => { mounted = false; };
  }, [concert.artist]);

  const onLoad = () => {
    setLoaded(true);
    Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
  };

  if (!imageUrl) {
    const initials = getArtistInitials(concert.artist);
    return (
      <View style={[styles.smallAvatarFallback, { backgroundColor: genreColor + '33' }]}>
        <Text style={[styles.smallAvatarText, { color: genreColor }]}>{initials}</Text>
      </View>
    );
  }

  return (
    <View style={styles.smallAvatarWrap}>
      {!loaded && (
        <View style={[styles.smallAvatarFallback, styles.abs, { backgroundColor: genreColor + '33' }]}>
          <Text style={[styles.smallAvatarText, { color: genreColor }]}>{getArtistInitials(concert.artist)}</Text>
        </View>
      )}
      <Animated.Image source={{ uri: imageUrl }} style={[styles.smallAvatarImg, { opacity: fadeAnim }]} onLoad={onLoad} />
    </View>
  );
}

interface Props {
  concert: Concert;
}

export default function CompactConcertRow({ concert }: Props) {
  const upcoming = isUpcoming(concert);
  const countdown = upcoming ? getCountdownLabel(concert.date) : '';

  return (
    <View style={[styles.row, upcoming && styles.rowUpcoming]}>
      <SmallAvatar concert={concert} />
      <View style={styles.dateCol}>
        <Text style={styles.date}>{formatCompactDate(concert.date)}</Text>
      </View>
      <View style={styles.infoCol}>
        <Text style={[styles.artist, upcoming && styles.artistUpcoming]} numberOfLines={1}>{concert.artist}</Text>
        <Text style={styles.venue} numberOfLines={1}>{concert.venue} · {concert.city}</Text>
      </View>
      {upcoming && countdown !== '' && (
        <View style={styles.countdownPill}>
          <Text style={styles.countdownText}>{countdown}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowUpcoming: {
    backgroundColor: colors.accent + '08',
  },
  smallAvatarWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
    marginRight: 10,
  },
  smallAvatarImg: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  smallAvatarFallback: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  smallAvatarText: {
    fontSize: 10,
    fontWeight: '800',
  },
  abs: {
    position: 'absolute',
    zIndex: 1,
    marginRight: 0,
  },
  dateCol: {
    width: 85,
    marginRight: 12,
  },
  date: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  infoCol: {
    flex: 1,
  },
  artist: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  artistUpcoming: {
    color: colors.accentLight,
  },
  venue: {
    color: colors.textTertiary,
    fontSize: fontSize.xs,
    marginTop: 1,
    letterSpacing: 0.1,
  },
  countdownPill: {
    backgroundColor: colors.accent + '22',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginLeft: 8,
  },
  countdownText: {
    color: colors.accentLight,
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
});
