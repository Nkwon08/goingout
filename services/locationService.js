// Location service - handles GPS location and reverse geocoding
import * as Location from 'expo-location';

// Default radius for nearby posts (in kilometers)
const DEFAULT_RADIUS_KM = 10; // 10km radius

// Calculate distance between two GPS coordinates (Haversine formula)
// Returns distance in kilometers
export const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in kilometers
};

// Get user's current GPS location
// Returns: { lat, lng, city, error }
export const getCurrentLocation = async () => {
  try {
    console.log('📍 Requesting location permissions...');
    
    // Request location permissions
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return {
        lat: null,
        lng: null,
        city: null,
        error: 'Location permission denied. Please enable location permissions in your device settings to use this feature.',
      };
    }

    console.log('📍 Getting current GPS location...');
    
    // Get current GPS coordinates
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced, // Balance between speed and accuracy
      maximumAge: 60000, // Use cached location if it's less than 1 minute old
    });

    const { latitude, longitude } = location.coords;
    console.log('✅ GPS coordinates obtained:', latitude, longitude);

    // Reverse geocode to get city name
    const cityName = await reverseGeocode(latitude, longitude);
    console.log('✅ City name:', cityName);

    return {
      lat: latitude,
      lng: longitude,
      city: cityName,
      error: null,
    };
  } catch (error) {
    console.error('❌ Error getting location:', error);
    return {
      lat: null,
      lng: null,
      city: null,
      error: error.message || 'Failed to get your location. Please check your GPS settings.',
    };
  }
};

// Reverse geocode GPS coordinates to get city name
// Returns: "City, State" or "City, Country"
export const reverseGeocode = async (lat, lng) => {
  try {
    console.log('📍 Reverse geocoding:', lat, lng);
    
    const addresses = await Location.reverseGeocodeAsync({
      latitude: lat,
      longitude: lng,
    });

    if (addresses && addresses.length > 0) {
      const address = addresses[0];
      // Format: "City, State" or "City, Country"
      const city = address.city || address.subAdministrativeArea || 'Unknown';
      const state = address.region || address.country || '';
      const cityName = state ? `${city}, ${state}` : city;
      console.log('✅ Reverse geocoded:', cityName);
      return cityName;
    }

    return 'Unknown Location';
  } catch (error) {
    console.error('❌ Error reverse geocoding:', error);
    return 'Unknown Location';
  }
};

// Forward geocode city name to GPS coordinates (optional - for manual location entry)
// Returns: { lat, lng, error }
export const forwardGeocode = async (cityName) => {
  try {
    console.log('📍 Forward geocoding:', cityName);
    
    const results = await Location.geocodeAsync(cityName);
    
    if (results && results.length > 0) {
      const { latitude, longitude } = results[0];
      console.log('✅ Forward geocoded:', latitude, longitude);
      return {
        lat: latitude,
        lng: longitude,
        error: null,
      };
    }

    return {
      lat: null,
      lng: null,
      error: 'Location not found',
    };
  } catch (error) {
    console.error('❌ Error forward geocoding:', error);
    return {
      lat: null,
      lng: null,
      error: error.message || 'Failed to find location',
    };
  }
};

// Check if a post is within radius of user's location
// Returns: true if post is within radius, false otherwise
export const isWithinRadius = (userLat, userLng, postLat, postLng, radiusKm = DEFAULT_RADIUS_KM) => {
  if (!userLat || !userLng || !postLat || !postLng) {
    return false; // Missing coordinates - can't calculate distance
  }

  const distance = calculateDistance(userLat, userLng, postLat, postLng);
  return distance <= radiusKm;
};

// Get default radius
export const getDefaultRadius = () => DEFAULT_RADIUS_KM;

