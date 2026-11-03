import api from './api';
import { Destination } from '../types';

interface RawDestinationItem {
  id?: string;
  name?: string;
  display_name?: string;
  displayName?: string;
  latitude?: number;
  longitude?: number;
  lat?: number | string;
  lon?: number | string;
}

// Well-known Indian & global transit hubs as instant fallback when offline or testing
const FALLBACK_DESTINATIONS: Destination[] = [
  {
    id: 'dest-bangalore',
    name: 'Bangalore',
    displayName: 'Bangalore (Bengaluru), Karnataka, India',
    latitude: 12.9716,
    longitude: 77.5946,
  },
  {
    id: 'dest-chennai',
    name: 'Chennai',
    displayName: 'Chennai, Tamil Nadu, India',
    latitude: 13.0827,
    longitude: 80.2707,
  },
  {
    id: 'dest-hyderabad',
    name: 'Hyderabad',
    displayName: 'Hyderabad, Telangana, India',
    latitude: 17.385,
    longitude: 78.4867,
  },
  {
    id: 'dest-mumbai',
    name: 'Mumbai',
    displayName: 'Mumbai, Maharashtra, India',
    latitude: 19.076,
    longitude: 72.8777,
  },
  {
    id: 'dest-delhi',
    name: 'New Delhi',
    displayName: 'New Delhi, Delhi, India',
    latitude: 28.6139,
    longitude: 77.209,
  },
  {
    id: 'dest-coimbatore',
    name: 'Coimbatore',
    displayName: 'Coimbatore, Tamil Nadu, India',
    latitude: 11.0168,
    longitude: 76.9558,
  },
  {
    id: 'dest-mysore',
    name: 'Mysore',
    displayName: 'Mysore (Mysuru), Karnataka, India',
    latitude: 12.2958,
    longitude: 76.6394,
  },
  {
    id: 'dest-pune',
    name: 'Pune',
    displayName: 'Pune, Maharashtra, India',
    latitude: 18.5204,
    longitude: 73.8567,
  },
];

function normalizeDestination(item: RawDestinationItem, index: number): Destination {
  const lat = Number(item.latitude ?? item.lat ?? 0);
  const lon = Number(item.longitude ?? item.lon ?? 0);
  const display = item.displayName || item.display_name || item.name || 'Unknown Destination';
  const shortName = item.name || display.split(',')[0].trim();

  return {
    id: item.id || `dest-${index}-${shortName.toLowerCase().replace(/\s+/g, '-')}`,
    name: shortName,
    displayName: display,
    latitude: lat,
    longitude: lon,
  };
}

/**
 * Searches destinations via the backend `/destinations/search` endpoint.
 * Gracefully falls back to built-in major destinations if the backend is unreachable.
 */
export async function searchDestinations(query: string): Promise<Destination[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  try {
    const response = await api.get<RawDestinationItem[] | { results: RawDestinationItem[] }>(
      '/destinations/search',
      {
        params: { q: trimmed, query: trimmed },
      }
    );

    const rawList = Array.isArray(response.data)
      ? response.data
      : Array.isArray(response.data?.results)
      ? response.data.results
      : [];

    return rawList.map(normalizeDestination);
  } catch {
    // Filter fallback destinations matching query so search still works smoothly
    const lower = trimmed.toLowerCase();
    return FALLBACK_DESTINATIONS.filter(
      (d) =>
        d.name.toLowerCase().includes(lower) ||
        d.displayName.toLowerCase().includes(lower)
    );
  }
}
