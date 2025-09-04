const express = require("express");
const axios = require("axios");
const router = express.Router();

const ADMIN_SERVICE_URL =
  process.env.ADMIN_SERVICE_URL || "http://localhost:3005";

// Middleware to forward requests to admin service
const forwardToAdminService = async (req, res) => {
  try {
    const { method, url, body, headers, query } = req;
    const targetUrl = `${ADMIN_SERVICE_URL}${url}`;

    const config = {
      method,
      url: targetUrl,
      data: body,
      params: query,
      headers: {
        ...headers,
        "x-forwarded-for": req.ip,
        "x-forwarded-proto": req.protocol,
        "x-forwarded-host": req.get("host"),
      },
    };

    const response = await axios(config);
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error("Admin service error:", error.message);

    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(500).json({
        error: "Admin Service Unavailable",
        message: "Unable to connect to admin service",
      });
    }
  }
};

// Admin routes
router.get("/users", forwardToAdminService);
router.get("/users/:id", forwardToAdminService);
router.put("/users/:id", forwardToAdminService);
router.delete("/users/:id", forwardToAdminService);
router.post("/users/:id/activate", forwardToAdminService);
router.post("/users/:id/deactivate", forwardToAdminService);
router.get("/system/health", forwardToAdminService);
router.get("/system/logs", forwardToAdminService);
router.get("/system/metrics", forwardToAdminService);
router.post("/system/backup", forwardToAdminService);
router.get("/audit-logs", forwardToAdminService);
router.get("/audit-logs/:id", forwardToAdminService);

module.exports = router;
