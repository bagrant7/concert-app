import AsyncStorage from '@react-native-async-storage/async-storage';
import { Concert } from '../types/Concert';
import { isUpcoming } from './helpers';
import { mockConcerts } from './mockData';

const STORAGE_KEY = 'concerts';

export async function loadConcerts(): Promise<Concert[]> {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEY);
    if (json) return JSON.parse(json);
    // First run: seed with mock data
    await saveConcerts(mockConcerts);
    return mockConcerts;
  } catch {
    return mockConcerts;
  }
}

export async function saveConcerts(concerts: Concert[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(concerts));
}

export async function loadUpcomingConcerts(): Promise<Concert[]> {
  const all = await loadConcerts();
  return all.filter(isUpcoming).sort((a, b) => a.date.localeCompare(b.date));
}

export async function loadPastConcerts(): Promise<Concert[]> {
  const all = await loadConcerts();
  return all.filter(c => !isUpcoming(c)).sort((a, b) => b.date.localeCompare(a.date));
}

export async function deleteConcert(id: string): Promise<void> {
  const all = await loadConcerts();
  await saveConcerts(all.filter(c => c.id !== id));
}

export async function updateConcert(concert: Concert): Promise<void> {
  const all = await loadConcerts();
  const idx = all.findIndex(c => c.id === concert.id);
  if (idx !== -1) {
    all[idx] = concert;
    await saveConcerts(all);
  }
}
