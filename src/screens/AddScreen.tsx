import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, Image, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { v4 as uuidv4 } from 'uuid';
import { Concert, ConcertStatus } from '../types/Concert';
import { loadConcerts, saveConcerts } from '../utils/storage';
import { GENRES, getGenreColor } from '../utils/helpers';
import { colors, spacing, fontSize } from '../utils/theme';
import { fetchArtistImage, getArtistInitials } from '../utils/artistImage';

export default function AddScreen() {
  const [artist, setArtist] = useState('');
  const [venue, setVenue] = useState('');
  const [city, setCity] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [genre, setGenre] = useState('');
  const [notes, setNotes] = useState('');
  const [rating, setRating] = useState(0);
  const [statusOverride, setStatusOverride] = useState<'auto' | 'past' | 'upcoming'>('auto');
  const [artistImageUrl, setArtistImageUrl] = useState<string | null>(null);
  const [fetchingImage, setFetchingImage] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const imageOpacity = useRef(new Animated.Value(0)).current;
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lookupArtistImage = useCallback(async (name: string) => {
    if (!name.trim()) {
      setArtistImageUrl(null);
      return;
    }
    setFetchingImage(true);
    const url = await fetchArtistImage(name.trim());
    setArtistImageUrl(url);
    setFetchingImage(false);
    if (url) {
      imageOpacity.setValue(0);
      Animated.timing(imageOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    }
  }, []);

  const onArtistChange = useCallback((text: string) => {
    setArtist(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      lookupArtistImage(text);
    }, 800);
  }, [lookupArtistImage]);

  const onArtistBlur = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    lookupArtistImage(artist);
  }, [artist, lookupArtistImage]);

  const resetForm = () => {
    setArtist('');
    setVenue('');
    setCity('');
    setLat('');
    setLng('');
    setDate('');
    setStartTime('');
    setEndTime('');
    setGenre('');
    setNotes('');
    setRating(0);
    setStatusOverride('auto');
    setArtistImageUrl(null);
    setSaveSuccess(false);
  };

  const save = async () => {
    if (!artist.trim() || !venue.trim() || !date.trim()) {
      Alert.alert('Missing Fields', 'Artist, venue, and date are required.');
      return;
    }
    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
      Alert.alert('Invalid Date', 'Date must be in YYYY-MM-DD format.');
      return;
    }
    // Validate time formats
    const timeRe = /^\d{2}:\d{2}$/;
    if (startTime.trim() && !timeRe.test(startTime.trim())) {
      Alert.alert('Invalid Start Time', 'Start time must be in HH:mm format.');
      return;
    }
    if (endTime.trim() && !timeRe.test(endTime.trim())) {
      Alert.alert('Invalid End Time', 'End time must be in HH:mm format.');
      return;
    }
    const concert: Concert = {
      id: uuidv4(),
      artist: artist.trim(),
      venue: venue.trim(),
      city: city.trim(),
      latitude: parseFloat(lat) || 0,
      longitude: parseFloat(lng) || 0,
      date: date.trim(),
      startTime: startTime.trim() || '20:00',
      endTime: endTime.trim() || '22:00',
      genre: genre || 'Rock',
      notes: notes.trim(),
      rating,
      ...(statusOverride !== 'auto' ? { status: statusOverride as ConcertStatus } : {}),
      ...(artistImageUrl ? { artistImageUrl } : {}),
      createdAt: new Date().toISOString(),
    };
    const existing = await loadConcerts();
    await saveConcerts([...existing, concert]);
    setSaveSuccess(true);
    setTimeout(() => {
      resetForm();
      Alert.alert('Saved!', `${concert.artist} added to your concerts.`);
    }, 600);
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.title}>Add Concert</Text>
          <Text style={styles.subtitle}>Log a new show</Text>
        </View>

        <View style={styles.form}>
          <FieldLabel label="Artist *" />
          <View style={styles.artistRow}>
            <View style={styles.artistInputWrap}>
              <TextInput
                style={styles.input}
                value={artist}
                onChangeText={onArtistChange}
                onBlur={onArtistBlur}
                placeholder="e.g. Radiohead"
                placeholderTextColor={colors.textTertiary}
              />
            </View>
            {(artistImageUrl || fetchingImage) && (
              <View style={styles.artistPreview}>
                {fetchingImage && !artistImageUrl ? (
                  <View style={[styles.previewPlaceholder, { backgroundColor: colors.cardAlt }]}>
                    <Ionicons name="musical-notes" size={18} color={colors.textTertiary} />
                  </View>
                ) : artistImageUrl ? (
                  <Animated.Image
                    source={{ uri: artistImageUrl }}
                    style={[styles.previewImage, { opacity: imageOpacity }]}
                  />
                ) : null}
              </View>
            )}
          </View>

          <FieldLabel label="Venue *" />
          <Input value={venue} onChange={setVenue} placeholder="e.g. The Greek Theatre" />

          <FieldLabel label="City" />
          <Input value={city} onChange={setCity} placeholder="e.g. Berkeley, CA" />

          <View style={styles.row}>
            <View style={styles.half}>
              <FieldLabel label="Latitude" />
              <Input value={lat} onChange={setLat} placeholder="37.8743" keyboardType="numeric" />
            </View>
            <View style={styles.half}>
              <FieldLabel label="Longitude" />
              <Input value={lng} onChange={setLng} placeholder="-122.2540" keyboardType="numeric" />
            </View>
          </View>

          <FieldLabel label="Date * (YYYY-MM-DD)" />
          <Input value={date} onChange={setDate} placeholder="2026-03-15" />

          <FieldLabel label="Status" />
          <View style={styles.statusRow}>
            {(['auto', 'upcoming', 'past'] as const).map(opt => (
              <TouchableOpacity
                key={opt}
                style={[
                  styles.statusChip,
                  statusOverride === opt && {
                    backgroundColor: colors.accent + '33',
                    borderColor: colors.accent,
                  },
                ]}
                onPress={() => setStatusOverride(opt)}
              >
                <Text style={[
                  styles.statusChipText,
                  statusOverride === opt && { color: colors.accentLight },
                ]}>
                  {opt === 'auto' ? 'Auto-detect' : opt.charAt(0).toUpperCase() + opt.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.row}>
            <View style={styles.half}>
              <FieldLabel label="Start Time" />
              <Input value={startTime} onChange={setStartTime} placeholder="20:00" />
            </View>
            <View style={styles.half}>
              <FieldLabel label="End Time" />
              <Input value={endTime} onChange={setEndTime} placeholder="23:00" />
            </View>
          </View>

          <FieldLabel label="Genre" />
          <View style={styles.genreGrid}>
            {GENRES.map(g => (
              <TouchableOpacity
                key={g}
                style={[
                  styles.genreChip,
                  genre === g && { backgroundColor: getGenreColor(g) + '33', borderColor: getGenreColor(g) },
                ]}
                onPress={() => setGenre(genre === g ? '' : g)}
              >
                <Text style={[
                  styles.genreChipText,
                  genre === g && { color: getGenreColor(g) },
                ]}>{g}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <FieldLabel label="Rating" />
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map(i => (
              <TouchableOpacity key={i} onPress={() => setRating(rating === i ? 0 : i)}>
                <Ionicons
                  name={i <= rating ? 'star' : 'star-outline'}
                  size={32}
                  color={i <= rating ? colors.star : colors.textTertiary}
                />
              </TouchableOpacity>
            ))}
          </View>

          <FieldLabel label="Notes" />
          <TextInput
            style={[styles.input, styles.textArea]}
            value={notes}
            onChangeText={setNotes}
            placeholder="How was the show?"
            placeholderTextColor={colors.textTertiary}
            multiline
            numberOfLines={4}
          />

          <TouchableOpacity
            style={[styles.saveBtn, saveSuccess && styles.saveBtnSuccess]}
            onPress={save}
            activeOpacity={0.8}
          >
            <Ionicons name={saveSuccess ? 'checkmark-done-circle' : 'checkmark-circle'} size={22} color="#fff" />
            <Text style={styles.saveBtnText}>{saveSuccess ? 'Saved!' : 'Save Concert'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.clearBtn} onPress={resetForm} activeOpacity={0.7}>
            <Ionicons name="trash-outline" size={18} color={colors.textSecondary} />
            <Text style={styles.clearBtnText}>Clear Form</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function FieldLabel({ label }: { label: string }) {
  return <Text style={styles.fieldLabel}>{label}</Text>;
}

function Input({ value, onChange, placeholder, keyboardType }: {
  value: string; onChange: (t: string) => void; placeholder: string; keyboardType?: 'numeric' | 'default';
}) {
  return (
    <TextInput
      style={styles.input}
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={colors.textTertiary}
      keyboardType={keyboardType || 'default'}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingBottom: 120 },
  header: { paddingHorizontal: spacing.md, paddingTop: 60, paddingBottom: spacing.md },
  title: { color: colors.text, fontSize: 34, fontWeight: '900', letterSpacing: -0.5 },
  subtitle: { color: colors.textSecondary, fontSize: fontSize.md, marginTop: 4 },
  form: { paddingHorizontal: spacing.md },
  fieldLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: spacing.md,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    color: colors.text,
    fontSize: fontSize.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  artistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  artistInputWrap: {
    flex: 1,
  },
  artistPreview: {
    width: 44,
    height: 44,
  },
  previewImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: colors.accent + '40',
  },
  previewPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', gap: spacing.sm },
  half: { flex: 1 },
  statusRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statusChip: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  statusChipText: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  genreGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  genreChip: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  genreChipText: { color: colors.textSecondary, fontSize: fontSize.xs, fontWeight: '600' },
  starsRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  saveBtn: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    marginTop: spacing.xl,
    gap: 8,
  },
  saveBtnText: { color: '#fff', fontSize: fontSize.lg, fontWeight: '800' },
  saveBtnSuccess: {
    backgroundColor: colors.success,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginTop: spacing.sm,
    gap: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  clearBtnText: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
});
