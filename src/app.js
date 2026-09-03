// Express application setup: middleware, routes, error handling.
const path = require("path");
const express = require("express");
const cors = require("cors");
const env = require("./config/env");
const apiRoutes = require("./routes");
const { notFound, errorHandler } = require("./middleware/error");

const app = express();

app.use(
  cors({
    origin(origin, callback) {
      // Allow non-browser requests (curl, server-to-server) with no Origin header.
      if (!origin) return callback(null, true);
      if (env.clientOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
  })
);
app.use(express.json());

// Serve uploaded files (product images) statically.
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

app.get("/", (req, res) => {
  res.json({ message: "Garuda Backend is running", api: "/api/v1" });
});

app.use("/api/v1", apiRoutes);

// 404 + error handlers (must be last).
app.use(notFound);
app.use(errorHandler);

module.exports = app;
