// Location service - handles GPS location and reverse geocoding
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Default radius for nearby posts (in kilometers)
const DEFAULT_RADIUS_KM = 10; // 10km radius

// Cache for reverse geocoding results (key: "lat,lng", value: { city, timestamp })
const reverseGeocodeCache = new Map();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const CACHE_KEY_PREFIX = '@reverseGeocode:';

// Helper to round coordinates for caching (to avoid cache misses due to minor GPS variations)
const roundCoordinate = (coord, precision = 3) => {
  return Math.round(coord * Math.pow(10, precision)) / Math.pow(10, precision);
};

// Get cache key from coordinates
const getCacheKey = (lat, lng) => {
  const roundedLat = roundCoordinate(lat);
  const roundedLng = roundCoordinate(lng);
  return `${roundedLat},${roundedLng}`;
};

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
// Uses caching to avoid rate limit issues
export const reverseGeocode = async (lat, lng) => {
  try {
    // Check cache first
    const cacheKey = getCacheKey(lat, lng);
    const cachedResult = reverseGeocodeCache.get(cacheKey);
    
    if (cachedResult) {
      const age = Date.now() - cachedResult.timestamp;
      if (age < CACHE_DURATION) {
        console.log('✅ Using cached reverse geocode:', cachedResult.city);
        return cachedResult.city;
      } else {
        // Cache expired, remove it
        reverseGeocodeCache.delete(cacheKey);
      }
    }
    
    // Try to load from AsyncStorage cache
    try {
      const storageKey = `${CACHE_KEY_PREFIX}${cacheKey}`;
      const stored = await AsyncStorage.getItem(storageKey);
      if (stored) {
        const cached = JSON.parse(stored);
        const age = Date.now() - cached.timestamp;
        if (age < CACHE_DURATION) {
          console.log('✅ Using AsyncStorage cached reverse geocode:', cached.city);
          reverseGeocodeCache.set(cacheKey, cached);
          return cached.city;
        }
      }
    } catch (storageError) {
      // Ignore storage errors, continue with API call
      console.warn('⚠️ Error reading from AsyncStorage cache:', storageError);
    }
    
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
      
      // Cache the result
      const cacheEntry = {
        city: cityName,
        timestamp: Date.now(),
      };
      reverseGeocodeCache.set(cacheKey, cacheEntry);
      
      // Also save to AsyncStorage for persistence
      try {
        const storageKey = `${CACHE_KEY_PREFIX}${cacheKey}`;
        await AsyncStorage.setItem(storageKey, JSON.stringify(cacheEntry));
      } catch (storageError) {
        // Ignore storage errors
        console.warn('⚠️ Error saving to AsyncStorage cache:', storageError);
      }
      
      return cityName;
    }

    // Cache "Unknown Location" result too (but with shorter duration)
    const cacheEntry = {
      city: 'Unknown Location',
      timestamp: Date.now(),
    };
    reverseGeocodeCache.set(cacheKey, cacheEntry);
    
    return 'Unknown Location';
  } catch (error) {
    console.error('❌ Error reverse geocoding:', error);
    
    // Check if it's a rate limit error
    const isRateLimit = error.message?.includes('rate limit') || 
                       error.message?.includes('too many requests') ||
                       error.code === 'E_RATE_LIMIT';
    
    if (isRateLimit) {
      console.warn('⚠️ Geocoding rate limit exceeded, checking cache...');
      
      // Try to get from cache even if expired (graceful degradation)
      const cacheKey = getCacheKey(lat, lng);
      const cachedResult = reverseGeocodeCache.get(cacheKey);
      
      if (cachedResult) {
        console.log('✅ Using expired cache due to rate limit:', cachedResult.city);
        return cachedResult.city;
      }
      
      // Try AsyncStorage
      try {
        const storageKey = `${CACHE_KEY_PREFIX}${cacheKey}`;
        const stored = await AsyncStorage.getItem(storageKey);
        if (stored) {
          const cached = JSON.parse(stored);
          console.log('✅ Using expired AsyncStorage cache due to rate limit:', cached.city);
          return cached.city;
        }
      } catch (storageError) {
        // Ignore
      }
    }
    
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

