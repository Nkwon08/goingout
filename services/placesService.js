// Places service - handles Google Places API (New) for location suggestions
// Uses the new Places API (New) endpoint

// Google Places API key - for Places API and Places API (New)
const GOOGLE_PLACES_API_KEY = 'AIzaSyDf820Uueoppy0dP8ubj18-FubjIMaWlIs';

/**
 * Search for places using Google Places API Autocomplete
 * Uses the standard Places API Autocomplete (not the "New" one) for better compatibility
 * @param {string} query - The search query
 * @param {Object} location - Optional user location { lat, lng } to bias results
 * @returns {Promise<Array>} Array of place suggestions
 */
export const searchPlaces = async (query, location = null) => {
  try {
    if (!query || query.trim().length < 2) {
      return [];
    }

    // Use the standard Places API Autocomplete endpoint (more reliable)
    // Focus on establishments (businesses, restaurants, etc.) rather than street addresses
    let url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query.trim())}&key=${GOOGLE_PLACES_API_KEY}&types=establishment`;
    
    // Add location bias if available (prioritizes results near user)
    if (location && location.lat && location.lng) {
      // Use origin parameter for better proximity ranking (prioritizes closest results)
      // Use a smaller radius (25km) to focus on nearby results
      url += `&origin=${location.lat},${location.lng}`;
      url += `&location=${location.lat},${location.lng}&radius=25000`;
    } else {
      // If no location, restrict to US to avoid international results
      // Change 'us' to your country code if different
      url += `&components=country:us`;
    }

    console.log('🔍 Google Places API Autocomplete request');

    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' && data.predictions && data.predictions.length > 0) {
      // Format predictions from the standard API structure
      // Use only the business/establishment name (main_text), not the address
      const formattedResults = data.predictions.slice(0, 5).map((prediction, index) => {
        // Use structured_formatting to get clean business name only
        let businessName = '';
        if (prediction.structured_formatting) {
          // Main text is the business name - use only this, not the address
          businessName = prediction.structured_formatting.main_text || '';
        } else {
          // Fallback to description if structured_formatting not available
          // Try to extract just the name part (before comma if address is included)
          const description = prediction.description || '';
          businessName = description.split(',')[0].trim();
        }

        return {
          id: prediction.place_id || `place-${index}`,
          name: businessName,
          placeId: prediction.place_id,
        };
      });

      console.log('✅ Google Places Autocomplete results:', formattedResults.length);
      return formattedResults;
    } else {
      console.error('❌ Google Places API Autocomplete error:', data.status, data.error_message);
      
      // If API is blocked or fails, try fallback to Text Search API
      if (data.status === 'REQUEST_DENIED' || data.status === 'OVER_QUERY_LIMIT') {
        console.log('⚠️ Places API Autocomplete blocked, trying Text Search fallback...');
        return await searchPlacesFallback(query, location);
      }
      
      return [];
    }
  } catch (error) {
    console.error('❌ Error calling Google Places API Autocomplete:', error);
    // Try fallback
    return await searchPlacesFallback(query, location);
  }
};

/**
 * Fallback: Use Places API Text Search (works with basic API key)
 * @param {string} query - The search query
 * @param {Object} location - Optional user location { lat, lng }
 * @returns {Promise<Array>} Array of place suggestions
 */
const searchPlacesFallback = async (query, location = null) => {
  try {
    // Build URL for Text Search API
    let url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query.trim())}&key=${GOOGLE_PLACES_API_KEY}`;
    
    // Add location bias if available (prioritize nearby results)
    if (location && location.lat && location.lng) {
      // Use smaller radius (10km) to prioritize nearby results
      url += `&location=${location.lat},${location.lng}&radius=10000`;
    } else {
      // If no location, restrict to US to avoid international results
      url += `&components=country:us`;
    }

    console.log('🔍 Fallback: Google Places Text Search API');

    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const formattedResults = data.results.slice(0, 5).map((result, index) => ({
        id: result.place_id || `place-${index}`,
        name: result.name || result.formatted_address?.split(',')[0].trim() || '',
        placeId: result.place_id,
      }));

      console.log('✅ Fallback Text Search results:', formattedResults);
      return formattedResults;
    }

    return [];
  } catch (error) {
    console.error('❌ Error in fallback search:', error);
    return [];
  }
};

/**
 * Get place details using place_id (Places API New)
 * @param {string} placeId - The Google Places place_id
 * @returns {Promise<Object>} Place details including formatted address
 */
export const getPlaceDetails = async (placeId) => {
  try {
    const response = await fetch(
      `https://places.googleapis.com/v1/places/${placeId}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
          'X-Goog-FieldMask': 'id,displayName,formattedAddress,location,addressComponents',
        },
      }
    );

    const data = await response.json();

    if (response.ok && data) {
      return {
        formattedAddress: data.formattedAddress,
        name: data.displayName?.text || '',
        location: data.location,
        addressComponents: data.addressComponents || [],
      };
    }

    return null;
  } catch (error) {
    console.error('❌ Error getting place details:', error);
    return null;
  }
};

