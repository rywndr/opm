const redis = require('redis');
const config = require('../utils/config');

class CacheService {
  constructor() {
    this._client = redis.createClient({
      socket: {
        host: config.redis.host,
      },
    });

    this._client.on('error', (error) => {
      console.error('Redis Client Error:', error);
    });

    this._client.connect().catch((error) => {
      console.error('Failed to connect to Redis:', error);
    });
  }

  async set(key, value, expirationInSecond = 1800) {
    await this._client.setEx(key, expirationInSecond, JSON.stringify(value));
  }

  async get(key) {
    const result = await this._client.get(key);
    if (result === null) throw new Error('Cache tidak ditemukan');

    try {
      return JSON.parse(result);
    } catch (error) {
      return result;
    }
  }

  async delete(key) {
    return this._client.del(key);
  }
}

module.exports = CacheService;
