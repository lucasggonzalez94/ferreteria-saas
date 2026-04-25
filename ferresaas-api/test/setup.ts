beforeAll(() => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET = 'test-access-secret-key-min-32-chars!';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-min-32-chars!!';
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
  process.env.CSRF_SECRET = 'test-csrf-secret-key-min-32-chars!!!';
  process.env.CLOUDINARY_CLOUD_NAME = 'test';
  process.env.CLOUDINARY_API_KEY = 'test';
  process.env.CLOUDINARY_API_SECRET = 'test';
});
