// Express application setup: middleware, routes, error handling.
const path = require("path");
const express = require("express");
const cors = require("cors");
const env = require("./config/env");
const apiRoutes = require("./routes");
const { notFound, errorHandler } = require("./middleware/error");

const app = express();

// Allow requests from any origin. Note: with credentials:true you cannot use a
// literal "*" origin, so we reflect whatever origin the request came from, which
// has the same "allow all" effect while still returning a concrete origin header.
app.use(
  cors({
    origin: true,
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
