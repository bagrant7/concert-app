export type ConcertStatus = 'past' | 'upcoming';

export interface Concert {
  id: string;
  artist: string;
  venue: string;
  city: string;
  latitude: number;
  longitude: number;
  date: string; // ISO date
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  genre: string;
  notes: string;
  rating: number; // 1-5
  status?: ConcertStatus; // auto-determined from date if not set
  artistImageUrl?: string;
  createdAt: string;
}
