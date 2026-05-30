require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');
const { getRedis } = require('./config/redis');

const PORT = process.env.PORT || 3000;

const start = async () => {
  await connectDB();

  try {
    await getRedis().connect();
  } catch {
    console.warn('Redis unavailable — caching disabled');
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Docs: http://localhost:${PORT}/api-docs`);
  });
};

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
  process.exit(1);
});

start();
