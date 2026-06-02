// ============================================================
// db.js — MongoDB Connection Module
// Purpose : Establishes and exports a single Mongoose
//           connection that the rest of the app reuses.
// ============================================================

const mongoose = require('mongoose');  // Mongoose ODM for MongoDB

// ── Load environment variables (set in .env file) ───────────
// MONGO_URI example: mongodb://localhost:27017/tutorforall
//                 or: mongodb+srv://user:pass@cluster.mongodb.net/tutorforall
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/tutorforall';

// ── connectDB : call this once from server.js on startup ─────
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(MONGO_URI, {
      // useNewUrlParser & useUnifiedTopology are defaults in Mongoose 7+
      // but kept here for backward compatibility with Mongoose 6
      useNewUrlParser:    true,
      useUnifiedTopology: true,
    });

    // Log which host we actually connected to (useful for debugging)
    console.log(`✅ MongoDB Connected : ${conn.connection.host}`);
  } catch (err) {
    // Print the exact error so you know whether it is a
    // network issue, auth failure, or bad URI
    console.error(`❌ MongoDB Connection Error : ${err.message}`);

    // Exit the process with failure code so nodemon / PM2 can restart
    process.exit(1);
  }
};

// ── Disconnect helper (useful in tests / graceful shutdown) ──
const disconnectDB = async () => {
  await mongoose.disconnect();
  console.log('🔌 MongoDB Disconnected');
};

// ── Export both helpers ──────────────────────────────────────
module.exports = { connectDB, disconnectDB };
