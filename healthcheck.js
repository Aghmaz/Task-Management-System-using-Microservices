const http = require("http");

const services = [
  { name: "API Gateway", port: 3000, path: "/health" },
  { name: "Auth Service", port: 3001, path: "/health" },
  { name: "Task Service", port: 3002, path: "/health" },
  { name: "Notification Service", port: 3003, path: "/health" },
  { name: "Reporting Service", port: 3004, path: "/health" },
  { name: "Admin Service", port: 3005, path: "/health" },
];

function checkService(service) {
  return new Promise((resolve) => {
    const options = {
      hostname: "localhost",
      port: service.port,
      path: service.path,
      method: "GET",
      timeout: 5000,
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        try {
          const response = JSON.parse(data);
          resolve({
            name: service.name,
            status: "healthy",
            port: service.port,
            response: response,
          });
        } catch (error) {
          resolve({
            name: service.name,
            status: "unhealthy",
            port: service.port,
            error: "Invalid JSON response",
          });
        }
      });
    });

    req.on("error", (error) => {
      resolve({
        name: service.name,
        status: "unhealthy",
        port: service.port,
        error: error.message,
      });
    });

    req.on("timeout", () => {
      req.destroy();
      resolve({
        name: service.name,
        status: "unhealthy",
        port: service.port,
        error: "Request timeout",
      });
    });

    req.end();
  });
}

async function checkAllServices() {
  console.log("🔍 Checking service health...\n");

  const results = await Promise.all(services.map(checkService));

  let allHealthy = true;

  results.forEach((result) => {
    const statusIcon = result.status === "healthy" ? "✅" : "❌";
    console.log(
      `${statusIcon} ${result.name} (Port ${result.port}): ${result.status}`
    );

    if (result.status === "unhealthy") {
      console.log(`   Error: ${result.error}`);
      allHealthy = false;
    }
  });

  console.log("\n" + "=".repeat(50));

  if (allHealthy) {
    console.log("🎉 All services are healthy!");
    process.exit(0);
  } else {
    console.log("⚠️  Some services are unhealthy!");
    process.exit(1);
  }
}

// Run health check
checkAllServices().catch((error) => {
  console.error("❌ Health check failed:", error);
  process.exit(1);
});
