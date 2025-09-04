const express = require("express");
const axios = require("axios");
const router = express.Router();

const REPORTING_SERVICE_URL =
  process.env.REPORTING_SERVICE_URL || "http://localhost:3004";

// Middleware to forward requests to reporting service
const forwardToReportingService = async (req, res) => {
  try {
    const { method, url, body, headers, query } = req;
    const targetUrl = `${REPORTING_SERVICE_URL}${url}`;

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
    console.error("Reporting service error:", error.message);

    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(500).json({
        error: "Reporting Service Unavailable",
        message: "Unable to connect to reporting service",
      });
    }
  }
};

// Reporting routes
router.get("/dashboard", forwardToReportingService);
router.get("/tasks/summary", forwardToReportingService);
router.get("/users/performance", forwardToReportingService);
router.get("/projects/status", forwardToReportingService);
router.post("/generate-report", forwardToReportingService);
router.get("/reports", forwardToReportingService);
router.get("/reports/:id", forwardToReportingService);
router.get("/analytics/task-completion", forwardToReportingService);
router.get("/analytics/user-productivity", forwardToReportingService);
router.get("/analytics/project-timeline", forwardToReportingService);

module.exports = router;
