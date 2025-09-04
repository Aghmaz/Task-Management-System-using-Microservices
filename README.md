# Task Management System - Microservices Architecture

A comprehensive task management system built with microservices architecture using Express.js, MongoDB, PostgreSQL, Docker, and JWT authentication.

## 🏗️ Architecture Overview

The system is built using a microservices architecture with the following components:

- **API Gateway** (Port 3000) - Routes requests to appropriate microservices
- **Authentication Service** (Port 3001) - Handles user authentication and authorization
- **Task Management Service** (Port 3002) - Manages tasks, projects, and assignments
- **Notification Service** (Port 3003) - Handles email, SMS, and push notifications
- **Reporting Service** (Port 3004) - Generates reports and analytics
- **Admin Service** (Port 3005) - Manages system administration and user management

## 🚀 Features

### Core Features

- **User Management**: Registration, authentication, role-based access control
- **Task Management**: Create, assign, track, and manage tasks with priorities and deadlines
- **Project Management**: Organize tasks into projects with team collaboration
- **Real-time Notifications**: Email, SMS, and push notifications for task updates
- **Comprehensive Reporting**: Analytics, dashboards, and custom reports
- **Admin Dashboard**: System monitoring, user management, and audit logs

### Technical Features

- **Microservices Architecture**: Scalable and maintainable service separation
- **JWT Authentication**: Secure token-based authentication
- **Database Integration**: MongoDB for document data, PostgreSQL for relational data
- **Docker Containerization**: Easy deployment and scaling
- **API Gateway**: Centralized routing and load balancing
- **Monitoring & Logging**: Prometheus and Grafana integration

## 🛠️ Tech Stack

### Backend

- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB** - Document database (Auth & Tasks)
- **PostgreSQL** - Relational database (Reporting & Admin)
- **Redis** - Caching and session management
- **JWT** - Authentication tokens
- **bcryptjs** - Password hashing

### DevOps & Monitoring

- **Docker** - Containerization
- **Docker Compose** - Multi-container orchestration
- **Prometheus** - Metrics collection
- **Grafana** - Data visualization
- **Nginx** - Reverse proxy (optional)

### Development Tools

- **Nodemon** - Development server with auto-reload
- **ESLint** - Code linting
- **Prettier** - Code formatting

## 📋 Prerequisites

Before running this system, ensure you have the following installed:

- **Node.js** (v18 or higher)
- **npm** (v8 or higher)
- **Docker** (v20 or higher)
- **Docker Compose** (v2 or higher)
- **MongoDB** (v7 or higher) - for local development
- **PostgreSQL** (v15 or higher) - for local development

## 🚀 Quick Start

### Option 1: Using Docker (Recommended)

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd task-management-system-using-microservices
   ```

2. **Set up environment variables**

   ```bash
   cp env.example .env
   # Edit .env file with your configuration
   ```

3. **Start all services with Docker**

   ```bash
   docker-compose up -d
   ```

4. **Access the services**
   - API Gateway: http://localhost:3000
   - Auth Service: http://localhost:3001
   - Task Service: http://localhost:3002
   - Notification Service: http://localhost:3003
   - Reporting Service: http://localhost:3004
   - Admin Service: http://localhost:3005
   - Prometheus: http://localhost:9090
   - Grafana: http://localhost:3006 (admin/admin123)

### Option 2: Local Development

1. **Install dependencies for all services**

   ```bash
   npm run install:all
   ```

2. **Set up databases**

   - Start MongoDB and PostgreSQL
   - Create databases: `task_management_auth`, `task_management_tasks`, `task_management_reports`, `task_management_admin`

3. **Set up environment variables**

   ```bash
   cp env.example .env
   # Edit .env file with your local database configuration
   ```

4. **Start services individually**

   ```bash
   # Terminal 1: API Gateway
   npm run dev:gateway

   # Terminal 2: Auth Service
   npm run dev:auth

   # Terminal 3: Task Service
   npm run dev:task

   # Terminal 4: Notification Service
   npm run dev:notification

   # Terminal 5: Reporting Service
   npm run dev:reporting

   # Terminal 6: Admin Service
   npm run dev:admin
   ```

## 📚 API Documentation

### Authentication Endpoints

#### User Registration

```http
POST /api/auth/register
Content-Type: application/json

{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@example.com",
  "password": "securepassword123",
  "role": "user",
  "department": "Engineering",
  "position": "Developer"
}
```

#### User Login

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "john.doe@example.com",
  "password": "securepassword123"
}
```

#### Get User Profile

```http
GET /api/auth/profile
Authorization: Bearer <jwt-token>
```

### Task Management Endpoints

#### Create Task

```http
POST /api/tasks
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "title": "Implement user authentication",
  "description": "Create JWT-based authentication system",
  "assignee": "user-id",
  "project": "project-id",
  "dueDate": "2024-01-15T23:59:59.000Z",
  "priority": "high",
  "type": "feature"
}
```

#### Get Tasks

```http
GET /api/tasks?page=1&limit=10&status=pending&priority=high
Authorization: Bearer <jwt-token>
```

#### Update Task Status

```http
PATCH /api/tasks/{taskId}/status
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "status": "in-progress"
}
```

### Reporting Endpoints

#### Dashboard Overview

```http
GET /api/reports/dashboard
Authorization: Bearer <jwt-token>
```

#### User Performance Report

```http
GET /api/reports/users/performance?startDate=2024-01-01&endDate=2024-01-31
Authorization: Bearer <jwt-token>
```

#### Project Status Report

```http
GET /api/reports/projects/status?status=active
Authorization: Bearer <jwt-token>
```

### Admin Endpoints

#### Get All Users

```http
GET /api/admin/users?page=1&limit=20&role=user
Authorization: Bearer <jwt-token>
```

#### Update User

```http
PUT /api/admin/users/{userId}
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "role": "manager",
  "department": "Product Management"
}
```

#### System Health

```http
GET /api/admin/system/health
Authorization: Bearer <jwt-token>
```

## 🗄️ Database Schema

### MongoDB Collections (Auth & Task Services)

#### Users Collection

```javascript
{
  _id: ObjectId,
  firstName: String,
  lastName: String,
  email: String,
  password: String,
  role: String, // 'user', 'admin', 'manager'
  department: String,
  position: String,
  isActive: Boolean,
  isEmailVerified: Boolean,
  lastLogin: Date,
  preferences: Object,
  createdAt: Date,
  updatedAt: Date
}
```

#### Tasks Collection

```javascript
{
  _id: ObjectId,
  title: String,
  description: String,
  status: String, // 'pending', 'in-progress', 'review', 'completed', 'cancelled'
  priority: String, // 'low', 'medium', 'high', 'urgent'
  type: String, // 'bug', 'feature', 'improvement', 'documentation', 'testing'
  assignee: ObjectId, // Reference to User
  reporter: ObjectId, // Reference to User
  project: ObjectId, // Reference to Project
  dueDate: Date,
  estimatedHours: Number,
  actualHours: Number,
  progress: Number,
  tags: [String],
  comments: [Object],
  attachments: [Object],
  createdAt: Date,
  updatedAt: Date
}
```

### PostgreSQL Tables (Reporting & Admin Services)

#### Users Table

```sql
CREATE TABLE users (
    id VARCHAR(255) PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    department VARCHAR(100),
    position VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Tasks Table

```sql
CREATE TABLE tasks (
    id VARCHAR(255) PRIMARY KEY,
    title VARCHAR(300) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    priority VARCHAR(50) DEFAULT 'medium',
    assignee_id VARCHAR(255) REFERENCES users(id),
    project_id VARCHAR(255) REFERENCES projects(id),
    due_date TIMESTAMP NOT NULL,
    estimated_hours DECIMAL(10,2) DEFAULT 0,
    actual_hours DECIMAL(10,2) DEFAULT 0,
    progress INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 🔧 Configuration

### Environment Variables

Key environment variables to configure:

- `JWT_SECRET`: Secret key for JWT token generation
- `MONGODB_URI`: MongoDB connection string
- `POSTGRES_*`: PostgreSQL connection parameters
- `SMTP_*`: Email service configuration
- `REDIS_*`: Redis connection parameters

### Service Configuration

Each service can be configured independently through environment variables or configuration files.

## 📊 Monitoring & Logging

### Prometheus Metrics

- Service health checks
- Request/response metrics
- Database connection metrics
- Custom business metrics

### Grafana Dashboards

- System overview dashboard
- Service performance metrics
- User activity analytics
- Task completion trends

### Logging

- Structured logging with different levels
- Request/response logging
- Error tracking and monitoring
- Audit trail for admin actions

## 🚀 Deployment

### Production Deployment

1. **Set production environment variables**
2. **Use production Docker images**
3. **Configure reverse proxy (Nginx)**
4. **Set up SSL certificates**
5. **Configure monitoring and alerting**
6. **Set up backup and recovery procedures**

### Scaling

- **Horizontal scaling**: Deploy multiple instances of each service
- **Load balancing**: Use Nginx or cloud load balancers
- **Database scaling**: Implement read replicas and sharding
- **Caching**: Use Redis for session and data caching

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests for specific service
cd auth-service && npm test
cd task-service && npm test
```

### Test Coverage

- Unit tests for each service
- Integration tests for API endpoints
- End-to-end tests for complete workflows
- Performance and load testing

## 🔒 Security

### Authentication & Authorization

- JWT-based authentication
- Role-based access control (RBAC)
- Password hashing with bcrypt
- Token expiration and refresh

### API Security

- Rate limiting
- Input validation and sanitization
- CORS configuration
- Helmet.js security headers

### Data Security

- Database connection encryption
- Sensitive data encryption
- Audit logging for all operations
- Regular security updates

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## 📝 License

This project is licensed under the ISC License.

## 🆘 Support

For support and questions:

- Create an issue in the repository
- Check the documentation
- Review the API examples

## 🔮 Roadmap

### Future Features

- **Real-time Collaboration**: WebSocket support for live updates
- **Mobile App**: React Native mobile application
- **Advanced Analytics**: Machine learning insights
- **Integration APIs**: Third-party service integrations
- **Multi-tenancy**: Support for multiple organizations
- **Advanced Workflows**: Custom task workflows and automation

### Performance Improvements

- **Caching Strategy**: Redis caching for frequently accessed data
- **Database Optimization**: Query optimization and indexing
- **Microservice Communication**: Message queues for async operations
- **CDN Integration**: Static asset delivery optimization

---

**Built with ❤️ using modern microservices architecture**
