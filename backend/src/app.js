const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const readingRoutes = require('./routes/readingRoutes');
const reportRoutes = require('./routes/reportRoutes');

const app = express();

app.use(cors());
app.use(express.json());

// Authentication routes
app.use('/api/auth', authRoutes);

// Glucose reading routes
app.use('/api/readings', readingRoutes);

// Reporting routes
app.use('/api/reports', reportRoutes);

// Health check endpoint for verifying server setup
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Sweety API is running',
    timestamp: new Date().toISOString()
  });
});

module.exports = app;
