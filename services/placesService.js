// Places service - handles Google Places API (New) for location suggestions
// Uses the new Places API (New) endpoint

// Google Places API key - using Firebase API key (make sure Places API (New) is enabled)
const GOOGLE_PLACES_API_KEY = 'AIzaSyA4LjGDNcL_MnTKN28zhtVB3Tc8T5G3Gkk';

/**
 * Search for places using Google Places API (New) Autocomplete
 * @param {string} query - The search query
 * @param {Object} location - Optional user location { lat, lng } to bias results
 * @returns {Promise<Array>} Array of place suggestions
 */
export const searchPlaces = async (query, location = null) => {
  try {
    if (!query || query.trim().length < 2) {
      return [];
    }

    // Build the request body for Places API (New)
    const requestBody = {
      input: query.trim(),
      includedPrimaryTypes: ['establishment', 'street_address', 'route'],
      languageCode: 'en',
    };

    // Add location bias if available (prioritizes results near user)
    if (location && location.lat && location.lng) {
      requestBody.locationBias = {
        circle: {
          center: {
            latitude: location.lat,
            longitude: location.lng,
          },
          radius: 50000.0, // 50km radius in meters
        },
      };
    }

    console.log('🔍 Google Places API (New) request:', JSON.stringify(requestBody, null, 2));

    // Use POST request for Places API (New)
    const response = await fetch(
      `https://places.googleapis.com/v1/places:autocomplete`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
          'X-Goog-FieldMask': 'suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat',
        },
        body: JSON.stringify(requestBody),
      }
    );

    const data = await response.json();

    if (response.ok && data.suggestions && data.suggestions.length > 0) {
      // Format predictions from the new API structure
      const formattedResults = data.suggestions
        .filter(suggestion => suggestion.placePrediction) // Only include place predictions
        .slice(0, 5)
        .map((suggestion, index) => {
          const prediction = suggestion.placePrediction;
          // Use structured format if available, otherwise use text
          let displayName = '';
          if (prediction.structuredFormat) {
            // Combine main text and secondary text for full address
            const mainText = prediction.structuredFormat.mainText?.text || '';
            const secondaryText = prediction.structuredFormat.secondaryText?.text || '';
            displayName = secondaryText ? `${mainText}, ${secondaryText}` : mainText;
          } else {
            displayName = prediction.text?.text || '';
          }

          return {
            id: prediction.placeId || `place-${index}`,
            name: displayName,
            placeId: prediction.placeId,
          };
        });

      console.log('✅ Google Places (New) results:', formattedResults);
      return formattedResults;
    } else {
      console.error('❌ Google Places API (New) error:', data.error || data);
      
      // If API is blocked, try fallback to Text Search API
      if (data.error?.code === 403 || data.status === 'PERMISSION_DENIED') {
        console.log('⚠️ Places API (New) blocked, trying Text Search fallback...');
        return await searchPlacesFallback(query, location);
      }
      
      return [];
    }
  } catch (error) {
    console.error('❌ Error calling Google Places API (New):', error);
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
    
    // Add location bias if available
    if (location && location.lat && location.lng) {
      url += `&location=${location.lat},${location.lng}&radius=50000`;
    }

    console.log('🔍 Fallback: Google Places Text Search API');

    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const formattedResults = data.results.slice(0, 5).map((result, index) => ({
        id: result.place_id || `place-${index}`,
        name: result.name ? `${result.name}, ${result.formatted_address || ''}` : result.formatted_address,
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

