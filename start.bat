@echo off
echo ========================================
echo Task Management System - Microservices
echo ========================================
echo.

echo Starting all services...
echo.

echo [1/6] Starting API Gateway...
start "API Gateway" cmd /k "cd api-gateway && npm run dev"

echo [2/6] Starting Auth Service...
start "Auth Service" cmd /k "cd auth-service && npm run dev"

echo [3/6] Starting Task Service...
start "Task Service" cmd /k "cd task-service && npm run dev"

echo [4/6] Starting Notification Service...
start "Notification Service" cmd /k "cd notification-service && npm run dev"

echo [5/6] Starting Reporting Service...
start "Reporting Service" cmd /k "cd reporting-service && npm run dev"

echo [6/6] Starting Admin Service...
start "Admin Service" cmd /k "cd admin-service && npm run dev"

echo.
echo All services are starting...
echo.
echo Service URLs:
echo - API Gateway: http://localhost:3000
echo - Auth Service: http://localhost:3001
echo - Task Service: http://localhost:3002
echo - Notification Service: http://localhost:3003
echo - Reporting Service: http://localhost:3004
echo - Admin Service: http://localhost:3005
echo.
echo Press any key to exit...
pause > nul
