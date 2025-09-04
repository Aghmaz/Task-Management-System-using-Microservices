const express = require("express");
const axios = require("axios");
const router = express.Router();

const TASK_SERVICE_URL =
  process.env.TASK_SERVICE_URL || "http://localhost:3002";

// Middleware to forward requests to task service
const forwardToTaskService = async (req, res) => {
  try {
    const { method, url, body, headers, query } = req;
    const targetUrl = `${TASK_SERVICE_URL}${url}`;

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
    console.error("Task service error:", error.message);

    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(500).json({
        error: "Task Service Unavailable",
        message: "Unable to connect to task management service",
      });
    }
  }
};

// Task routes
router.get("/", forwardToTaskService);
router.post("/", forwardToTaskService);
router.get("/:id", forwardToTaskService);
router.put("/:id", forwardToTaskService);
router.delete("/:id", forwardToTaskService);
router.patch("/:id/status", forwardToTaskService);
router.patch("/:id/assign", forwardToTaskService);
router.get("/user/:userId", forwardToTaskService);
router.get("/project/:projectId", forwardToTaskService);
router.post("/:id/comments", forwardToTaskService);
router.get("/:id/comments", forwardToTaskService);

module.exports = router;
