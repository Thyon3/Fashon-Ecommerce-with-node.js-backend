const axios = require('axios');

class GeoLocation {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 24 * 60 * 60 * 1000; // 24 hours
    this.apiKey = process.env.GEOLOCATION_API_KEY;
    this.apiEndpoint = process.env.GEOLOCATION_API_ENDPOINT || 'http://ip-api.com/json';
    this.fallbackEndpoint = 'http://ip-api.com/json';
  }

  // Get location from IP address
  async getLocationFromIP(ip, options = {}) {
    const cacheKey = `ip:${ip}`;
    const cached = this.getFromCache(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      const location = await this.fetchLocationFromAPI(ip);
      
      // Cache the result
      this.setCache(cacheKey, location);
      
      return location;
      
    } catch (error) {
      console.error('[GEOLOCATION] Error getting location from IP:', error);
      
      // Return default location
      return this.getDefaultLocation();
    }
  }

  // Fetch location from API
  async fetchLocationFromAPI(ip) {
    const endpoint = this.apiEndpoint.includes('{ip}') ? 
      this.apiEndpoint.replace('{ip}', ip) : 
      `${this.apiEndpoint}/${ip}`;
    
    const params = {
      fields: 'status,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query'
    };

    if (this.apiKey) {
      params.key = this.apiKey;
    }

    try {
      const response = await axios.get(endpoint, { 
        params,
        timeout: 5000
      });

      const data = response.data;

      if (data.status === 'fail') {
        throw new Error(`API error: ${data.message || 'Unknown error'}`);
      }

      return this.formatLocationData(data);
      
    } catch (error) {
      // Try fallback endpoint
      if (this.apiEndpoint !== this.fallbackEndpoint) {
        console.log('[GEOLOCATION] Trying fallback endpoint');
        return this.fetchFromFallback(ip);
      }
      
      throw error;
    }
  }

  // Fetch from fallback endpoint
  async fetchFromFallback(ip) {
    try {
      const response = await axios.get(`${this.fallbackEndpoint}/${ip}`, {
        params: {
          fields: 'status,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query'
        },
        timeout: 5000
      });

      const data = response.data;

      if (data.status === 'fail') {
        throw new Error(`Fallback API error: ${data.message || 'Unknown error'}`);
      }

      return this.formatLocationData(data);
      
    } catch (error) {
      throw error;
    }
  }

  // Format location data
  formatLocationData(data) {
    return {
      success: true,
      ip: data.query,
      country: data.country,
      countryCode: data.countryCode,
      region: data.regionName,
      regionCode: data.region,
      city: data.city,
      zipCode: data.zip,
      latitude: data.lat,
      longitude: data.lon,
      timezone: data.timezone,
      isp: data.isp,
      organization: data.org,
      as: data.as,
      timestamp: new Date().toISOString()
    };
  }

  // Get default location
  getDefaultLocation() {
    return {
      success: false,
      ip: null,
      country: 'Unknown',
      countryCode: 'XX',
      region: 'Unknown',
      regionCode: 'XX',
      city: 'Unknown',
      zipCode: null,
      latitude: 0,
      longitude: 0,
      timezone: 'UTC',
      isp: 'Unknown',
      organization: 'Unknown',
      as: 'Unknown',
      timestamp: new Date().toISOString(),
      error: 'Location not available'
    };
  }

  // Get location from coordinates
  async getLocationFromCoordinates(lat, lon, options = {}) {
    const cacheKey = `coords:${lat}:${lon}`;
    const cached = this.getFromCache(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      // This would use a reverse geocoding API
      // For now, return a mock response
      const location = {
        success: true,
        latitude: parseFloat(lat),
        longitude: parseFloat(lon),
        country: 'Unknown',
        countryCode: 'XX',
        region: 'Unknown',
        regionCode: 'XX',
        city: 'Unknown',
        zipCode: null,
        timezone: 'UTC',
        timestamp: new Date().toISOString()
      };
      
      this.setCache(cacheKey, location);
      
      return location;
      
    } catch (error) {
      console.error('[GEOLOCATION] Error getting location from coordinates:', error);
      
      return {
        success: false,
        latitude: parseFloat(lat),
        longitude: parseFloat(lon),
        error: 'Location not available'
      };
    }
  }

  // Calculate distance between two points
  calculateDistance(lat1, lon1, lat2, lon2, unit = 'km') {
    const R = unit === 'km' ? 6371 : 3959; // Earth radius in km or miles
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return R * c;
  }

  // Convert degrees to radians
  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  // Check if location is within radius
  isWithinRadius(centerLat, centerLon, targetLat, targetLon, radiusKm) {
    const distance = this.calculateDistance(centerLat, centerLon, targetLat, targetLon);
    return distance <= radiusKm;
  }

  // Get timezone from coordinates
  async getTimezone(lat, lon) {
    try {
      // This would use a timezone API
      // For now, return UTC
      return 'UTC';
    } catch (error) {
      console.error('[GEOLOCATION] Error getting timezone:', error);
      return 'UTC';
    }
  }

  // Validate coordinates
  validateCoordinates(lat, lon) {
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);
    
    return {
      isValid: !isNaN(latitude) && !isNaN(longitude) &&
                latitude >= -90 && latitude <= 90 &&
                longitude >= -180 && longitude <= 180,
      latitude,
      longitude
    };
  }

  // Get country info
  async getCountryInfo(countryCode) {
    const cacheKey = `country:${countryCode}`;
    const cached = this.getFromCache(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      // This would use a country info API
      // For now, return mock data
      const countryInfo = {
        code: countryCode,
        name: 'Unknown',
        capital: 'Unknown',
        population: 0,
        area: 0,
        currency: 'Unknown',
        language: 'Unknown',
        timezone: 'UTC'
      };
      
      this.setCache(cacheKey, countryInfo);
      
      return countryInfo;
      
    } catch (error) {
      console.error('[GEOLOCATION] Error getting country info:', error);
      return null;
    }
  }

  // Batch geolocation lookup
  async batchLookup(ips, options = {}) {
    const results = [];
    const { batchSize = 10, delay = 100 } = options;
    
    for (let i = 0; i < ips.length; i += batchSize) {
      const batch = ips.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (ip, index) => {
        try {
          const location = await this.getLocationFromIP(ip);
          return { ip, location, success: true };
        } catch (error) {
          return { ip, error: error.message, success: false };
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Add delay between batches to avoid rate limiting
      if (i + batchSize < ips.length) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    return results;
  }

  // Get location statistics
  getStats() {
    return {
      cacheSize: this.cache.size,
      cacheTimeout: this.cacheTimeout,
      apiKey: !!this.apiKey,
      apiEndpoint: this.apiEndpoint,
      fallbackEndpoint: this.fallbackEndpoint
    };
  }

  // Clear cache
  clearCache() {
    this.cache.clear();
    console.log('[GEOLOCATION] Cache cleared');
  }

  // Cache management
  getFromCache(key) {
    const cached = this.cache.get(key);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    
    if (cached) {
      this.cache.delete(key);
    }
    
    return null;
  }

  setCache(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  // Clean expired cache entries
  cleanCache() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp >= this.cacheTimeout) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`[GEOLOCATION] Cleaned ${cleaned} expired cache entries`);
    }
    
    return cleaned;
  }

  // Middleware for geolocation
  middleware(options = {}) {
    const {
      field = 'ip',
      addToRequest = 'location',
      useRealIP = true,
      skipPaths = ['/health', '/health/live', '/health/ready']
    } = options;

    return async (req, res, next) => {
      // Skip certain paths
      if (skipPaths.some(path => req.originalUrl.startsWith(path))) {
        return next();
      }

      try {
        let ip;
        
        if (useRealIP) {
          ip = req.ip || 
               req.connection.remoteAddress || 
               req.socket.remoteAddress ||
               (req.connection.socket ? req.connection.socket.remoteAddress : null);
        } else {
          ip = req.body[field] || req.query[field];
        }

        if (!ip) {
          return next();
        }

        // Get location
        const location = await this.getLocationFromIP(ip);
        
        // Add to request
        req[addToRequest] = location;
        
        next();
        
      } catch (error) {
        console.error('[GEOLOCATION] Middleware error:', error);
        next();
      }
    };
  }

  // Export configuration
  exportConfig() {
    return {
      apiKey: this.apiKey ? '***' : null,
      apiEndpoint: this.apiEndpoint,
      fallbackEndpoint: this.fallbackEndpoint,
      cacheTimeout: this.cacheTimeout
    };
  }

  // Import configuration
  importConfig(config) {
    try {
      if (config.apiKey) {
        this.apiKey = config.apiKey;
      }
      
      if (config.apiEndpoint) {
        this.apiEndpoint = config.apiEndpoint;
      }
      
      if (config.fallbackEndpoint) {
        this.fallbackEndpoint = config.fallbackEndpoint;
      }
      
      if (config.cacheTimeout) {
        this.cacheTimeout = config.cacheTimeout;
      }
      
      console.log('[GEOLOCATION] Configuration imported successfully');
      
    } catch (error) {
      console.error('[GEOLOCATION] Error importing configuration:', error);
      throw error;
    }
  }
}

// Create singleton instance
const geoLocation = new GeoLocation();

module.exports = geoLocation;
