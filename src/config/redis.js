const Redis = require('ioredis');

let client = null;

const getRedis = () => {
  if (!client) {
    client = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
      lazyConnect: true,
      enableOfflineQueue: false,
      retryStrategy: (times) => {
        if (times > 3) return null; // Stop retrying after 3 attempts
        return Math.min(times * 200, 1000);
      },
    });

    client.on('connect', () => console.log('Redis connected'));
    client.on('error', (err) => console.warn('Redis error (non-fatal):', err.message));
  }
  return client;
};

module.exports = { getRedis };
