/**
 * Convert degrees to radians
 */
function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

/**
 * Known coordinates for Polish cities (approximate city centers)
 */
const CITY_COORDINATES = {
  'Zabrze': { lat: 50.3249, lon: 18.7856 },
  'Piotrków Trybunalski': { lat: 51.4054, lon: 19.7031 },
  'Grudziądz': { lat: 53.4836, lon: 18.7536 },
  'Tczew': { lat: 54.0920, lon: 18.7784 },
  'Radom': { lat: 51.4027, lon: 21.1471 },
  'Chelmno': { lat: 53.3481, lon: 18.4236 },
  'Żarnowiec': { lat: 54.7333, lon: 18.0167 }
};

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} Distance in kilometers
 */
export function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return distance;
}

/**
 * Fetch power plant locations from API
 * @param {string} apiKey - Agent token
 * @returns {Promise<Array>} Array of power plant objects
 */
export async function fetchPowerPlants(apiKey) {
  const url = `https://hub.ag3nts.org/data/${apiKey}/findhim_locations.json`;
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch power plants: ${response.status} ${response.statusText}`);
  }
  
  return await response.json();
}

/**
 * Fetch person's location history
 * @param {string} apiKey - Agent token
 * @param {string} name - Person's first name
 * @param {string} surname - Person's surname
 * @returns {Promise<Array>} Array of coordinates where person was seen
 */
export async function fetchPersonLocations(apiKey, name, surname) {
  const url = 'https://hub.ag3nts.org/api/location';
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      apikey: apiKey,
      name,
      surname
    })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch locations for ${name} ${surname}: ${response.status} - ${errorText}`);
  }
  
  const data = await response.json();
  return data;
}

/**
 * Fetch person's access level
 * @param {string} apiKey - Agent token
 * @param {string} name - Person's first name
 * @param {string} surname - Person's surname
 * @param {number} birthYear - Person's birth year
 * @returns {Promise<number>} Access level
 */
export async function fetchAccessLevel(apikey, name, surname, birthYear) {
  const url = 'https://hub.ag3nts.org/api/accesslevel';
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      apikey,
      name,
      surname,
      birthYear
    })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch access level for ${name} ${surname}: ${response.status} - ${errorText}`);
  }
  
  const data = await response.json();
  return data.accessLevel;
}

/**
 * Find the closest power plant to any of the person's locations
 * @param {Array} personLocations - Array of {latitude, longitude} coordinates
 * @param {Array} powerPlants - Array of power plant objects with name field
 * @returns {Object} Object with closest power plant and minimum distance
 */
export function findClosestPowerPlant(personLocations, powerPlants) {
  let minDistance = Infinity;
  let closestPlant = null;
  
  for (const location of personLocations) {
    for (const plant of powerPlants) {
      // Get coordinates for the plant's city
      const plantCoords = CITY_COORDINATES[plant.name];
      
      if (!plantCoords) {
        console.warn(`     Warning: No coordinates found for ${plant.name}`);
        continue;
      }
      
      const distance = calculateDistance(
        location.latitude,
        location.longitude,
        plantCoords.lat,
        plantCoords.lon
      );
      
      if (distance < minDistance) {
        minDistance = distance;
        closestPlant = plant;
      }
    }
  }
  
  return { closestPlant, minDistance };
}

/**
 * Process suspects in batches to avoid overwhelming the API
 * @param {Array} suspects - Array of suspect objects
 * @param {Function} processFn - Async function to process each suspect
 * @param {number} batchSize - Number of suspects to process in parallel
 * @returns {Promise<Array>} Array of results
 */
export async function processSuspectsInBatches(suspects, processFn, batchSize = 5) {
  const results = [];
  const total = suspects.length;
  
  for (let i = 0; i < total; i += batchSize) {
    const batch = suspects.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(total / batchSize);
    
    console.log(`   Processing batch ${batchNum}/${totalBatches}...`);
    
    const batchPromises = batch.map(suspect => processFn(suspect));
    const batchResults = await Promise.all(batchPromises);
    
    results.push(...batchResults);
    
    // Small delay to avoid rate limits
    if (i + batchSize < total) {
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }
  
  return results;
}

