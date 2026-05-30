const { sendError } = require('../utils/response');

const errorHandler = (err, req, res, next) => {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);

  if (err.isOperational) {
    return sendError(res, err.statusCode, err.code, err.message);
  }

  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors)[0].message;
    return sendError(res, 400, 'VALIDATION_ERROR', message);
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return sendError(res, 409, 'DUPLICATE_ERROR', `${field} already exists`);
  }

  if (err.name === 'CastError') {
    return sendError(res, 400, 'INVALID_ID', `Invalid ${err.path}: ${err.value}`);
  }

  if (err.name === 'JsonWebTokenError') {
    return sendError(res, 401, 'INVALID_TOKEN', 'Invalid token');
  }

  if (err.name === 'TokenExpiredError') {
    return sendError(res, 401, 'TOKEN_EXPIRED', 'Token has expired');
  }

  return sendError(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
};

const notFound = (req, res) => {
  return sendError(res, 404, 'NOT_FOUND', `Route ${req.method} ${req.path} not found`);
};

module.exports = { errorHandler, notFound };
