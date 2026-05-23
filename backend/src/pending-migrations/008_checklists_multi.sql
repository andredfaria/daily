ALTER TABLE checklists DROP INDEX IF EXISTS uq_checklists_user;
ALTER TABLE checklists ADD COLUMN IF NOT EXISTS recurrence_type ENUM('daily','weekdays','custom') NOT NULL DEFAULT 'daily' AFTER send_time;
ALTER TABLE checklists ADD COLUMN IF NOT EXISTS recurrence_days JSON DEFAULT NULL AFTER recurrence_type;
