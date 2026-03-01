import { Concert } from '../types/Concert';
import { colors } from './theme';

export function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateShort(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
}

export function getDurationHours(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let diff = (eh * 60 + em) - (sh * 60 + sm);
  if (diff < 0) diff += 24 * 60;
  return diff / 60;
}

export function getDurationLabel(start: string, end: string): string {
  const hrs = getDurationHours(start, end);
  const h = Math.floor(hrs);
  const m = Math.round((hrs - h) * 60);
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function isUpcoming(concert: Concert): boolean {
  if (concert.status) return concert.status === 'upcoming';
  return concert.date >= new Date().toISOString().slice(0, 10);
}

export function getCountdownLabel(dateStr: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + 'T00:00:00');
  const diffMs = target.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return '';
  if (diffDays === 0) return 'Tonight';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays < 7) return `In ${diffDays} days`;
  if (diffDays < 14) return 'In 1 week';
  if (diffDays < 30) return `In ${Math.floor(diffDays / 7)} weeks`;
  if (diffDays < 60) return 'In 1 month';
  return `In ${Math.floor(diffDays / 30)} months`;
}

export function getGenreColor(genre: string): string {
  const genreMap: Record<string, string> = {
    'Alternative': colors.genres[0],
    'Psychedelic': colors.genres[1],
    'Indie': colors.genres[2],
    'Hip-Hop': colors.genres[3],
    'R&B': colors.genres[4],
    'Rock': colors.genres[5],
    'Electronic': colors.genres[6],
    'Pop': colors.genres[7],
    'Jazz': '#00B4D8',
    'Metal': '#E63946',
    'Folk': '#2A9D8F',
    'Classical': '#B5838D',
    'Country': '#DDA15E',
    'Punk': '#F72585',
    'Soul': '#7209B7',
    'Blues': '#4361EE',
  };
  return genreMap[genre] || colors.accent;
}

export const GENRES = [
  'Alternative', 'Blues', 'Classical', 'Country', 'Electronic',
  'Folk', 'Hip-Hop', 'Indie', 'Jazz', 'Metal', 'Pop', 'Psychedelic',
  'Punk', 'R&B', 'Rock', 'Soul',
];

export function starString(rating: number): string {
  return '★'.repeat(rating) + '☆'.repeat(5 - rating);
}
