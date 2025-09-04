const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const compression = require("compression");
require("dotenv").config();

const authRoutes = require("./routes/auth");
const taskRoutes = require("./routes/task");
const notificationRoutes = require("./routes/notification");
const reportingRoutes = require("./routes/reporting");
const adminRoutes = require("./routes/admin");

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors());
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
});
app.use(limiter);

// Logging
app.use(morgan("combined"));

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    message: "API Gateway is running",
    timestamp: new Date().toISOString(),
    services: {
      auth: process.env.AUTH_SERVICE_URL || "http://localhost:3001",
      task: process.env.TASK_SERVICE_URL || "http://localhost:3002",
      notification:
        process.env.NOTIFICATION_SERVICE_URL || "http://localhost:3003",
      reporting: process.env.REPORTING_SERVICE_URL || "http://localhost:3004",
      admin: process.env.ADMIN_SERVICE_URL || "http://localhost:3005",
    },
  });
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/reports", reportingRoutes);
app.use("/api/admin", adminRoutes);

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    error: "Route not found",
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Global error:", err);
  res.status(err.status || 500).json({
    error: "Internal Server Error",
    message: err.message || "Something went wrong",
  });
});

app.listen(PORT, () => {
  console.log(`🚀 API Gateway running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});

module.exports = app;
