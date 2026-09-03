// Central error handler + 404. Keeps controllers clean - they just throw ApiError.
const ApiError = require("../utils/ApiError");

function notFound(req, res, next) {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let status = err.statusCode || 500;
  let message = err.message || "Internal server error.";

  // Mongoose duplicate key (e.g. unique email/code).
  if (err.code === 11000) {
    status = 409;
    const field = Object.keys(err.keyValue || {})[0] || "field";
    message = `Duplicate value for ${field}.`;
  }

  // Mongoose validation error.
  if (err.name === "ValidationError") {
    status = 400;
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join(", ");
  }

  if (status >= 500) console.error(err);

  res.status(status).json({ success: false, message });
}

module.exports = { notFound, errorHandler };
