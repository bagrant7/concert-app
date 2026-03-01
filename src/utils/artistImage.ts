import AsyncStorage from '@react-native-async-storage/async-storage';

const memoryCache: Record<string, string | null> = {};
const CACHE_PREFIX = 'artist_image_';

function getCacheKey(artistName: string): string {
  return `${CACHE_PREFIX}${artistName.toLowerCase()}`;
}

function upgradeResolution(url: string): string {
  return url.replace('100x100', '600x600');
}

export async function fetchArtistImage(artistName: string): Promise<string | null> {
  const key = getCacheKey(artistName);

  // 1. Check in-memory cache
  if (key in memoryCache) return memoryCache[key];

  // 2. Check AsyncStorage cache
  try {
    const cached = await AsyncStorage.getItem(key);
    if (cached !== null) {
      const value = cached === '' ? null : cached;
      memoryCache[key] = value;
      return value;
    }
  } catch {}

  // 3. Fetch from iTunes Search API (search music artists for artwork)
  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(artistName)}&entity=musicArtist&limit=1`;
    const response = await fetch(url);
    const data = await response.json();

    let imageUrl: string | null = null;
    if (data.resultCount > 0 && data.results[0]?.artworkUrl100) {
      imageUrl = upgradeResolution(data.results[0].artworkUrl100);
    }

    // Cache the result (store empty string for null so we don't re-fetch)
    memoryCache[key] = imageUrl;
    await AsyncStorage.setItem(key, imageUrl ?? '');
    return imageUrl;
  } catch {
    return null;
  }
}

export function getArtistInitials(artistName: string): string {
  const words = artistName.replace(/^the\s+/i, '').split(/\s+/);
  if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/**
 * Preload artist images into memory cache from AsyncStorage.
 */
export async function preloadArtistImages(artistNames: string[]): Promise<void> {
  await Promise.all(
    artistNames.map(async (name) => {
      const key = getCacheKey(name);
      if (key in memoryCache) return;
      try {
        const cached = await AsyncStorage.getItem(key);
        if (cached !== null) {
          memoryCache[key] = cached === '' ? null : cached;
        }
      } catch {}
    })
  );
}
