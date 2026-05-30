const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const { User } = require('../src/models/User');
const Organization = require('../src/models/Organization');

// Use a test database
process.env.MONGO_URI = 'mongodb://localhost:27017/tasktracker_test';
process.env.JWT_ACCESS_SECRET = 'test_access_secret';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret';
process.env.JWT_ACCESS_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';

let accessToken;
let refreshToken;
let userId;

beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  await User.deleteMany({});
  await Organization.deleteMany({});
});

afterAll(async () => {
  await User.deleteMany({});
  await Organization.deleteMany({});
  await mongoose.disconnect();
});

describe('Auth Flow', () => {
  describe('POST /api/v1/auth/register', () => {
    it('should register the first user as ADMIN', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        name: 'Test Admin',
        email: 'admin@test.com',
        password: 'password123',
        organizationName: 'Test Org',
      });

      expect(res.status).toBe(201);
      expect(res.body.data.user.role).toBe('ADMIN');
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
      accessToken = res.body.data.accessToken;
      refreshToken = res.body.data.refreshToken;
      userId = res.body.data.user._id;
    });

    it('should reject duplicate email in same org', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        name: 'Dupe Admin',
        email: 'admin@test.com',
        password: 'password123',
        organizationName: 'Test Org',
      });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('DUPLICATE_ERROR');
    });

    it('should reject invalid email', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        name: 'Bad Email',
        email: 'not-an-email',
        password: 'password123',
        organizationName: 'Test Org',
      });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should reject short password', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        name: 'User',
        email: 'user2@test.com',
        password: '123',
        organizationName: 'Test Org',
      });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('second user in org should get MEMBER role by default', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        name: 'Test Member',
        email: 'member@test.com',
        password: 'password123',
        organizationName: 'Test Org',
      });
      expect(res.status).toBe(201);
      expect(res.body.data.user.role).toBe('MEMBER');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should login with correct credentials', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'admin@test.com',
        password: 'password123',
      });
      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toBeDefined();
      accessToken = res.body.data.accessToken;
      refreshToken = res.body.data.refreshToken;
    });

    it('should reject invalid password', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'admin@test.com',
        password: 'wrongpassword',
      });
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('INVALID_CREDENTIALS');
    });

    it('should reject non-existent email', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'ghost@test.com',
        password: 'password123',
      });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('should return current user with valid token', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.user.email).toBe('admin@test.com');
    });

    it('should reject request without token', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('should return new tokens on valid refresh token', async () => {
      const res = await request(app).post('/api/v1/auth/refresh').send({ refreshToken });
      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
      // Tokens should be rotated
      expect(res.body.data.refreshToken).not.toBe(refreshToken);
    });

    it('should reject reused refresh token', async () => {
      // The refresh token was rotated above — reusing old one should fail
      const res = await request(app).post('/api/v1/auth/refresh').send({ refreshToken });
      expect(res.status).toBe(401);
    });
  });
});
