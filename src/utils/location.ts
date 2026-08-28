import * as Location from 'expo-location';

export interface Fix {
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  address?: string;
}

/** Ask for permission and grab the best current position (best-effort). */
export async function getCurrentFix(): Promise<Fix> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return {};

    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    const fix: Fix = {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy ?? undefined,
    };

    try {
      const [place] = await Location.reverseGeocodeAsync({
        latitude: fix.latitude!,
        longitude: fix.longitude!,
      });
      if (place) {
        fix.address = [place.street, place.city, place.region]
          .filter(Boolean)
          .join(', ');
      }
    } catch {
      // reverse geocode is optional
    }
    return fix;
  } catch {
    return {};
  }
}
