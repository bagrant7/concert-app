export interface Concert {
  id: string;
  name: string;        // Headliner (was 'artist')
  subName: string;     // Openers
  date: string;        // YYYY-MM-DD
  location: string;    // Venue (was 'venue')
  
  // Spotify integration
  imageUrl?: string;
  spotifyArtistId?: string;
  spotifyArtistUrl?: string;
  
  // Timestamps
  createdAt: number;
  updatedAt?: number;
}

// Legacy type for migration (keeping the old structure for reference)
export interface LegacyConcert {
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
  status?: 'past' | 'upcoming';
  artistImageUrl?: string;
  createdAt: string;
}

export type ConcertStatus = 'past' | 'upcoming';