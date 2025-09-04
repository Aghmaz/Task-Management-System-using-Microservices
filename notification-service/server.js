const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
require("dotenv").config();

const notificationRoutes = require("./controllers/notificationController");

const app = express();
const PORT = process.env.PORT || 3003;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan("combined"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Health check
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    service: "Notification Service",
    timestamp: new Date().toISOString(),
    features: ["email", "sms", "push"],
  });
});

// Routes
app.use("/", notificationRoutes);

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    error: "Route not found",
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Notification service error:", err);
  res.status(err.status || 500).json({
    error: "Internal Server Error",
    message: err.message || "Something went wrong in notification service",
  });
});

app.listen(PORT, () => {
  console.log(`📧 Notification Service running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});

module.exports = app;
