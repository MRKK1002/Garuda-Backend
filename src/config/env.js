// Loads environment variables once and exposes a typed config object.
require("dotenv").config();

const env = {
  port: process.env.PORT || 5050,
  mongoUri: process.env.MONGO_URI || "mongodb://localhost:27017/garuda_crm",
  jwtSecret: process.env.JWT_SECRET || "dev_secret_change_me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  seed: {
    adminEmail: process.env.SEED_ADMIN_EMAIL || "admin@arventure.com",
    adminPassword: process.env.SEED_ADMIN_PASSWORD || "Admin@123",
    adminName: process.env.SEED_ADMIN_NAME || "Super Admin",
  },
};

module.exports = env;
