-- Task Management System Reporting Database Schema

-- Create database (run this separately)
-- CREATE DATABASE task_management_reports;

-- Connect to the database first, then run these commands

-- Users table (for reporting purposes)
CREATE TABLE IF NOT EXISTS users (
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

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'planning',
    priority VARCHAR(50) DEFAULT 'medium',
    owner_id VARCHAR(255) REFERENCES users(id),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    estimated_hours DECIMAL(10,2) DEFAULT 0,
    actual_hours DECIMAL(10,2) DEFAULT 0,
    budget DECIMAL(15,2) DEFAULT 0,
    is_archived BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
    id VARCHAR(255) PRIMARY KEY,
    title VARCHAR(300) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    priority VARCHAR(50) DEFAULT 'medium',
    type VARCHAR(50) DEFAULT 'feature',
    assignee_id VARCHAR(255) REFERENCES users(id),
    reporter_id VARCHAR(255) REFERENCES users(id),
    project_id VARCHAR(255) REFERENCES projects(id),
    estimated_hours DECIMAL(10,2) DEFAULT 0,
    actual_hours DECIMAL(10,2) DEFAULT 0,
    due_date TIMESTAMP NOT NULL,
    start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_date TIMESTAMP,
    progress INTEGER DEFAULT 0,
    is_archived BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Task comments table
CREATE TABLE IF NOT EXISTS task_comments (
    id SERIAL PRIMARY KEY,
    task_id VARCHAR(255) REFERENCES tasks(id) ON DELETE CASCADE,
    user_id VARCHAR(255) REFERENCES users(id),
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Task time tracking table
CREATE TABLE IF NOT EXISTS task_time_logs (
    id SERIAL PRIMARY KEY,
    task_id VARCHAR(255) REFERENCES tasks(id) ON DELETE CASCADE,
    user_id VARCHAR(255) REFERENCES users(id),
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    duration_minutes INTEGER,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Project members table
CREATE TABLE IF NOT EXISTS project_members (
    id SERIAL PRIMARY KEY,
    project_id VARCHAR(255) REFERENCES projects(id) ON DELETE CASCADE,
    user_id VARCHAR(255) REFERENCES users(id),
    role VARCHAR(50) DEFAULT 'developer',
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Reports table
CREATE TABLE IF NOT EXISTS reports (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    type VARCHAR(100) NOT NULL,
    parameters JSONB,
    generated_by VARCHAR(255) REFERENCES users(id),
    file_path VARCHAR(500),
    file_size BIGINT,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id VARCHAR(255),
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Performance metrics table
CREATE TABLE IF NOT EXISTS performance_metrics (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) REFERENCES users(id),
    metric_date DATE NOT NULL,
    tasks_completed INTEGER DEFAULT 0,
    tasks_created INTEGER DEFAULT 0,
    total_hours_worked DECIMAL(10,2) DEFAULT 0,
    average_task_completion_time_hours DECIMAL(10,2),
    on_time_completion_rate DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_end_date ON projects(end_date);
CREATE INDEX IF NOT EXISTS idx_users_department ON users(department);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_user_date ON performance_metrics(user_id, metric_date);

-- Create views for common reporting queries

-- Task summary view
CREATE OR REPLACE VIEW task_summary AS
SELECT 
    t.id,
    t.title,
    t.status,
    t.priority,
    t.type,
    t.due_date,
    t.progress,
    t.estimated_hours,
    t.actual_hours,
    u.first_name || ' ' || u.last_name as assignee_name,
    u.email as assignee_email,
    p.name as project_name,
    p.status as project_status,
    t.created_at,
    t.updated_at
FROM tasks t
JOIN users u ON t.assignee_id = u.id
JOIN projects p ON t.project_id = p.id
WHERE t.is_archived = false;

-- User performance view
CREATE OR REPLACE VIEW user_performance AS
SELECT 
    u.id,
    u.first_name || ' ' || u.last_name as full_name,
    u.department,
    u.role,
    COUNT(t.id) as total_tasks,
    COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as completed_tasks,
    COUNT(CASE WHEN t.status = 'pending' THEN 1 END) as pending_tasks,
    COUNT(CASE WHEN t.status = 'in-progress' THEN 1 END) as in_progress_tasks,
    SUM(t.actual_hours) as total_hours_worked,
    AVG(t.actual_hours) as avg_hours_per_task,
    AVG(CASE WHEN t.status = 'completed' THEN EXTRACT(EPOCH FROM (t.completed_date - t.start_date))/3600 END) as avg_completion_time_hours
FROM users u
LEFT JOIN tasks t ON u.id = t.assignee_id AND t.is_archived = false
GROUP BY u.id, u.first_name, u.last_name, u.department, u.role;

-- Project status view
CREATE OR REPLACE VIEW project_status AS
SELECT 
    p.id,
    p.name,
    p.status,
    p.priority,
    p.start_date,
    p.end_date,
    p.estimated_hours,
    p.actual_hours,
    p.budget,
    COUNT(t.id) as total_tasks,
    COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as completed_tasks,
    COUNT(CASE WHEN t.status = 'pending' THEN 1 END) as pending_tasks,
    COUNT(CASE WHEN t.status = 'in-progress' THEN 1 END) as in_progress_tasks,
    ROUND(
        CASE 
            WHEN COUNT(t.id) > 0 THEN 
                (COUNT(CASE WHEN t.status = 'completed' THEN 1 END)::DECIMAL / COUNT(t.id)) * 100
            ELSE 0 
        END, 2
    ) as completion_percentage,
    u.first_name || ' ' || u.last_name as owner_name
FROM projects p
LEFT JOIN tasks t ON p.id = t.project_id AND t.is_archived = false
LEFT JOIN users u ON p.owner_id = u.id
WHERE p.is_archived = false
GROUP BY p.id, p.name, p.status, p.priority, p.start_date, p.end_date, p.estimated_hours, p.actual_hours, p.budget, u.first_name, u.last_name;

-- Overdue tasks view
CREATE OR REPLACE VIEW overdue_tasks AS
SELECT 
    t.id,
    t.title,
    t.status,
    t.priority,
    t.due_date,
    EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - t.due_date))/86400 as days_overdue,
    u.first_name || ' ' || u.last_name as assignee_name,
    u.email as assignee_email,
    p.name as project_name
FROM tasks t
JOIN users u ON t.assignee_id = u.id
JOIN projects p ON t.project_id = p.id
WHERE t.due_date < CURRENT_TIMESTAMP 
    AND t.status NOT IN ('completed', 'cancelled')
    AND t.is_archived = false;

-- Create functions for common operations

-- Function to update task progress
CREATE OR REPLACE FUNCTION update_task_progress()
RETURNS TRIGGER AS $$
BEGIN
    -- Update progress based on status
    IF NEW.status = 'completed' THEN
        NEW.progress = 100;
        NEW.completed_date = CURRENT_TIMESTAMP;
    ELSIF NEW.status = 'in-progress' THEN
        NEW.progress = 50;
    ELSIF NEW.status = 'review' THEN
        NEW.progress = 75;
    ELSIF NEW.status = 'pending' THEN
        NEW.progress = 0;
    END IF;
    
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update task progress
CREATE TRIGGER trigger_update_task_progress
    BEFORE UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_task_progress();

-- Function to log audit trail
CREATE OR REPLACE FUNCTION log_audit_trail()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
        VALUES (NEW.reporter_id, 'CREATE', 'TASK', NEW.id, to_jsonb(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values, new_values)
        VALUES (NEW.reporter_id, 'UPDATE', 'TASK', NEW.id, to_jsonb(OLD), to_jsonb(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values)
        VALUES (OLD.reporter_id, 'DELETE', 'TASK', OLD.id, to_jsonb(OLD));
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically log audit trail
CREATE TRIGGER trigger_log_audit_trail
    AFTER INSERT OR UPDATE OR DELETE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION log_audit_trail();

-- Function to calculate user performance metrics
CREATE OR REPLACE FUNCTION calculate_user_performance(user_id_param VARCHAR(255), metric_date DATE)
RETURNS VOID AS $$
DECLARE
    tasks_completed_count INTEGER;
    tasks_created_count INTEGER;
    total_hours DECIMAL(10,2);
    avg_completion_time DECIMAL(10,2);
    on_time_rate DECIMAL(5,2);
BEGIN
    -- Count completed tasks
    SELECT COUNT(*) INTO tasks_completed_count
    FROM tasks 
    WHERE assignee_id = user_id_param 
        AND status = 'completed' 
        AND DATE(completed_date) = metric_date;
    
    -- Count created tasks
    SELECT COUNT(*) INTO tasks_created_count
    FROM tasks 
    WHERE reporter_id = user_id_param 
        AND DATE(created_at) = metric_date;
    
    -- Calculate total hours worked
    SELECT COALESCE(SUM(actual_hours), 0) INTO total_hours
    FROM tasks 
    WHERE assignee_id = user_id_param 
        AND DATE(updated_at) = metric_date;
    
    -- Calculate average completion time
    SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (completed_date - start_date))/3600), 0) INTO avg_completion_time
    FROM tasks 
    WHERE assignee_id = user_id_param 
        AND status = 'completed' 
        AND DATE(completed_date) = metric_date;
    
    -- Calculate on-time completion rate
    SELECT COALESCE(
        (COUNT(CASE WHEN completed_date <= due_date THEN 1 END)::DECIMAL / COUNT(*)) * 100, 0
    ) INTO on_time_rate
    FROM tasks 
    WHERE assignee_id = user_id_param 
        AND status = 'completed' 
        AND DATE(completed_date) = metric_date;
    
    -- Insert or update performance metrics
    INSERT INTO performance_metrics (
        user_id, metric_date, tasks_completed, tasks_created, 
        total_hours_worked, average_task_completion_time_hours, on_time_completion_rate
    ) VALUES (
        user_id_param, metric_date, tasks_completed_count, tasks_created_count,
        total_hours, avg_completion_time, on_time_rate
    )
    ON CONFLICT (user_id, metric_date) 
    DO UPDATE SET
        tasks_completed = EXCLUDED.tasks_completed,
        tasks_created = EXCLUDED.tasks_created,
        total_hours_worked = EXCLUDED.total_hours_worked,
        average_task_completion_time_hours = EXCLUDED.average_task_completion_time_hours,
        on_time_completion_rate = EXCLUDED.on_time_completion_rate,
        updated_at = CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions (adjust as needed for your setup)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO your_user;
