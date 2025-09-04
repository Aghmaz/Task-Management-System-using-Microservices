const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
require("dotenv").config();

const reportingRoutes = require("./controllers/reportingController");

const app = express();
const PORT = process.env.PORT || 3004;

// PostgreSQL connection
const pool = new Pool({
  user: process.env.POSTGRES_USER || "postgres",
  host: process.env.POSTGRES_HOST || "localhost",
  database: process.env.POSTGRES_DB || "task_management_reports",
  password: process.env.POSTGRES_PASSWORD || "password",
  port: process.env.POSTGRES_PORT || 5432,
});

// Test database connection
pool.query("SELECT NOW()", (err, res) => {
  if (err) {
    console.error("❌ PostgreSQL connection error:", err);
  } else {
    console.log("✅ Connected to PostgreSQL");
  }
});

// Make pool available to routes
app.locals.db = pool;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan("combined"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Health check
app.get("/health", (req, res) => {
  pool.query("SELECT NOW()", (err, result) => {
    res.status(200).json({
      status: "OK",
      service: "Reporting Service",
      timestamp: new Date().toISOString(),
      database: err ? "Disconnected" : "Connected",
      databaseTime: err ? null : result.rows[0].now,
    });
  });
});

// Routes
app.use("/", reportingRoutes);

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    error: "Route not found",
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Reporting service error:", err);
  res.status(err.status || 500).json({
    error: "Internal Server Error",
    message: err.message || "Something went wrong in reporting service",
  });
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("Shutting down gracefully...");
  pool.end();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`📊 Reporting Service running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});

module.exports = app;
