-- Revert enums back to UPPERCASE to match SQLAlchemy SAEnum behavior
-- SAEnum sends member NAMES (OPEN, IN_PROGRESS) not values (open, in_progress)

-- Fix taskstatus enum: lowercase -> uppercase
ALTER TABLE tasks ALTER COLUMN status TYPE text;
DROP TYPE taskstatus;
CREATE TYPE taskstatus AS ENUM('OPEN','IN_PROGRESS','COMPLETED','CANCELLED');
UPDATE tasks SET status = UPPER(status);
ALTER TABLE tasks ALTER COLUMN status TYPE taskstatus USING status::taskstatus;

-- Fix sessionstatus enum: lowercase -> uppercase
ALTER TABLE task_sessions ALTER COLUMN status TYPE text;
DROP TYPE sessionstatus;
CREATE TYPE sessionstatus AS ENUM('ACTIVE','PAUSED','COMPLETED','SETTLED');
UPDATE task_sessions SET status = UPPER(status);
ALTER TABLE task_sessions ALTER COLUMN status TYPE sessionstatus USING status::sessionstatus;

-- Fix applicationstatus enum: lowercase -> uppercase
ALTER TABLE applications ALTER COLUMN status TYPE text;
DROP TYPE applicationstatus;
CREATE TYPE applicationstatus AS ENUM('PENDING','APPROVED','REJECTED','WITHDRAWN');
UPDATE applications SET status = UPPER(status);
ALTER TABLE applications ALTER COLUMN status TYPE applicationstatus USING status::applicationstatus;