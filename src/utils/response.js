/**
 * Consistent error response shape across all endpoints:
 * { status, code, message }
 */
class AppError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code || 'INTERNAL_ERROR';
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

const sendError = (res, statusCode, code, message) => {
  return res.status(statusCode).json({ status: statusCode, code, message });
};

const sendSuccess = (res, data, statusCode = 200, meta = null) => {
  const payload = { status: statusCode, data };
  if (meta) payload.meta = meta;
  return res.status(statusCode).json(payload);
};

module.exports = { AppError, sendError, sendSuccess };
