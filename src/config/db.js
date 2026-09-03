// MongoDB connection helper using Mongoose.
const mongoose = require("mongoose");
const env = require("./env");

async function connectDB() {
  mongoose.set("strictQuery", true);
  await mongoose.connect(env.mongoUri, {
    // Auto-build indexes in development for convenience. In production, disable this
    // and build indexes deliberately (via a migration/ops step) so a deploy doesn't
    // trigger expensive index builds on a live collection.
    autoIndex: process.env.NODE_ENV !== "production",
    // Pool tuning for faster concurrent responses.
    maxPoolSize: 20,
    minPoolSize: 2,
    serverSelectionTimeoutMS: 5000,
  });
  console.log(`MongoDB connected: ${mongoose.connection.name}`);
  return mongoose.connection;
}

module.exports = { connectDB };
