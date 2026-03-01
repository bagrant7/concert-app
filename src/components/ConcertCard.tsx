import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Concert } from '../types/Concert';
import { colors, spacing, fontSize } from '../utils/theme';
import { formatDate, formatTime, getDurationLabel, getGenreColor, isUpcoming, getCountdownLabel } from '../utils/helpers';
import { fetchArtistImage, getArtistInitials } from '../utils/artistImage';

interface Props {
  concert: Concert;
  onPress?: () => void;
  onLongPress?: () => void;
}

function ArtistAvatar({ concert }: { concert: Concert }) {
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
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  if (!imageUrl) {
    const initials = getArtistInitials(concert.artist);
    return (
      <View style={[styles.avatarFallback, { backgroundColor: genreColor + '33' }]}>
        <Text style={[styles.avatarInitials, { color: genreColor }]}>{initials}</Text>
      </View>
    );
  }

  return (
    <View style={styles.avatarContainer}>
      {!loaded && (
        <View style={[styles.avatarFallback, styles.avatarAbsolute, { backgroundColor: genreColor + '33' }]}>
          <Text style={[styles.avatarInitials, { color: genreColor }]}>{getArtistInitials(concert.artist)}</Text>
        </View>
      )}
      <Animated.Image
        source={{ uri: imageUrl }}
        style={[styles.avatarImage, { opacity: fadeAnim }]}
        onLoad={onLoad}
      />
    </View>
  );
}

export default function ConcertCard({ concert, onPress, onLongPress }: Props) {
  const genreColor = getGenreColor(concert.genre);
  const upcoming = isUpcoming(concert);
  const countdown = upcoming ? getCountdownLabel(concert.date) : '';

  return (
    <TouchableOpacity
      style={[styles.card, upcoming && styles.cardUpcoming]}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
    >
      {/* Genre accent bar */}
      <View style={[styles.accentBar, { backgroundColor: genreColor }]} />

      <View style={styles.content}>
        {/* Top row: date badge + upcoming label */}
        <View style={styles.topRow}>
          <View style={styles.topLeft}>
            <ArtistAvatar concert={concert} />
            <View style={styles.dateBadge}>
              <Text style={styles.dateMonth}>
                {new Date(concert.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
              </Text>
              <Text style={styles.dateDay}>
                {new Date(concert.date + 'T00:00:00').getDate()}
              </Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            {upcoming && countdown !== '' && (
              <View style={[styles.countdownBadge, { backgroundColor: colors.accent + '22', borderColor: colors.accent }]}>
                <View style={styles.pulseDot} />
                <Text style={[styles.countdownText, { color: colors.accentLight }]}>{countdown}</Text>
              </View>
            )}
            <View style={[styles.genrePill, { backgroundColor: genreColor + '18' }]}>
              <Text style={[styles.genreText, { color: genreColor }]}>{concert.genre}</Text>
            </View>
          </View>
        </View>

        {/* Artist */}
        <Text style={styles.artist} numberOfLines={1}>{concert.artist}</Text>

        {/* Venue + City */}
        <View style={styles.venueRow}>
          <Ionicons name="location-sharp" size={14} color={colors.textSecondary} />
          <Text style={styles.venue} numberOfLines={1}>
            {concert.venue} · {concert.city}
          </Text>
        </View>

        {/* Bottom row: time + duration + rating */}
        <View style={styles.bottomRow}>
          <View style={styles.timeBlock}>
            <Ionicons name="time-outline" size={13} color={colors.textTertiary} />
            <Text style={styles.timeText}>
              {formatTime(concert.startTime)} → {formatTime(concert.endTime)}
            </Text>
          </View>
          <View style={styles.durationBlock}>
            <Text style={styles.durationText}>{getDurationLabel(concert.startTime, concert.endTime)}</Text>
          </View>
          {concert.rating > 0 && (
            <View style={styles.ratingBlock}>
              {Array.from({ length: 5 }).map((_, i) => (
                <Ionicons
                  key={i}
                  name={i < concert.rating ? 'star' : 'star-outline'}
                  size={12}
                  color={i < concert.rating ? colors.star : colors.textTertiary}
                />
              ))}
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  cardUpcoming: {
    backgroundColor: '#1C1A2E',
    borderWidth: 1,
    borderColor: colors.accent + '30',
  },
  accentBar: {
    width: 4,
  },
  content: {
    flex: 1,
    padding: spacing.md,
    paddingLeft: spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  topLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarAbsolute: {
    position: 'absolute',
    zIndex: 1,
  },
  avatarInitials: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  dateBadge: {
    alignItems: 'center',
    backgroundColor: colors.cardAlt,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  dateMonth: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    fontWeight: '700',
    letterSpacing: 1,
  },
  dateDay: {
    color: colors.text,
    fontSize: fontSize.xl,
    fontWeight: '800',
    lineHeight: 28,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  countdownBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    gap: 5,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  countdownText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  genrePill: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  genreText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  artist: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '800',
    marginBottom: 4,
  },
  venueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: spacing.sm,
  },
  venue: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    flex: 1,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  timeBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    color: colors.textTertiary,
    fontSize: fontSize.xs,
  },
  durationBlock: {
    backgroundColor: colors.cardAlt,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  durationText: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  ratingBlock: {
    flexDirection: 'row',
    gap: 1,
    marginLeft: 'auto',
  },
});
