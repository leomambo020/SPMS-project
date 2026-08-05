/** Operational error with an HTTP status attached. Anything thrown that
 * isn't an AppError is treated as an unexpected bug and never leaks
 * internal detail to the client. */
class AppError extends Error {
  constructor(message, statusCode = 500, details = undefined) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
