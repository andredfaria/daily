-- A FK fk_checklists_user precisa de um indice em user_id; cria substituto antes de dropar o unico.
ALTER TABLE checklists ADD INDEX idx_checklists_user (user_id);
ALTER TABLE checklists DROP INDEX uq_checklists_user;
ALTER TABLE checklists ADD COLUMN IF NOT EXISTS recurrence_type ENUM('daily','weekdays','custom') NOT NULL DEFAULT 'daily' AFTER send_time;
ALTER TABLE checklists ADD COLUMN IF NOT EXISTS recurrence_days JSON DEFAULT NULL AFTER recurrence_type;
