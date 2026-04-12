/**
 * server.js — SmartFeed AI Backend Entry Point
 *
 * Bootstraps the Express application:
 *  - Loads environment variables
 *  - Initialises Firebase Admin (via config/firebase.js import)
 *  - Registers global middleware (CORS, Helmet, Morgan, JSON parsing)
 *  - Mounts route groups under /api/*
 *  - Attaches the global error handler
 *  - Starts the HTTP server
 */

require('dotenv').config(); // Load .env before anything else

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');

// Route groups
const authRoutes     = require('./routes/authRoutes');
const mealRoutes     = require('./routes/mealRoutes');
const adminRoutes    = require('./routes/adminRoutes');
const paymentRoutes  = require('./routes/paymentRoutes');
const approvalRoutes = require('./routes/approvalRoutes');
const studentRoutes  = require('./routes/studentRoutes');
const menuRoutes     = require('./routes/menuRoutes');

// Global error handler
const errorHandler = require('./middleware/errorHandler');

// Initialise Firebase (side-effect import — must come before routes use db)
require('./config/firebase');

// Initialise Razorpay (will throw if keys missing)
require('./config/razorpay');

// Initialise Nodemailer transporter (non-blocking)
require('./config/nodemailer');

const app = express();

// ──────────────────────────────────────────────
//  Security & Utility Middleware
// ──────────────────────────────────────────────
app.use(helmet());

app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const frontendDir = path.resolve(process.env.FRONTEND_DIR || path.join(__dirname, '..', 'frontend'));
const hasFrontend = fs.existsSync(path.join(frontendDir, 'index.html'));

// ──────────────────────────────────────────────
//  Health Check Route (no auth required)
// ──────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'SmartFeed AI API is running 🍽️',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '2.0.0',
  });
});

// ──────────────────────────────────────────────
//  API Route Groups
// ──────────────────────────────────────────────
app.use('/api/auth',     authRoutes);      // /api/auth/*
app.use('/api/meals',    mealRoutes);      // /api/meals/*
app.use('/api/admin',    adminRoutes);     // /api/admin/*
app.use('/api/payment',  paymentRoutes);   // /api/payment/*
app.use('/api/approval', approvalRoutes);  // /api/approval/*
app.use('/api/students', studentRoutes);   // /api/students/*
app.use('/api/menu',     menuRoutes);      // /api/menu/*

if (hasFrontend) {
  app.use(express.static(frontendDir));

  app.get('/', (req, res) => {
    res.sendFile(path.join(frontendDir, 'index.html'));
  });
}

// ──────────────────────────────────────────────
//  404 Handler for unknown routes
// ──────────────────────────────────────────────
app.use((req, res) => {
  if (
    hasFrontend &&
    req.method === 'GET' &&
    !req.originalUrl.startsWith('/api/') &&
    !path.extname(req.path)
  ) {
    return res.sendFile(path.join(frontendDir, 'index.html'));
  }

  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
});

// ──────────────────────────────────────────────
//  Global Error Handler (must be last)
// ──────────────────────────────────────────────
app.use(errorHandler);

// ──────────────────────────────────────────────
//  Start Server
// ──────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n🚀 SmartFeed AI Server running on port ${PORT}`);
  console.log(`📌 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}\n`);
});

module.exports = app; // Export for potential testing
