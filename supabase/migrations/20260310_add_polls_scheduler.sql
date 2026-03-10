-- Poll scheduling and dispatch tracking
CREATE TABLE IF NOT EXISTS polls (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  workspace_id BIGINT NOT NULL,
  question TEXT NOT NULL,
  status ENUM('draft','scheduled','processing','processed','cancelled') NOT NULL DEFAULT 'draft',
  created_by BIGINT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_polls_workspace_status (workspace_id, status),
  CONSTRAINT fk_polls_workspace FOREIGN KEY (workspace_id) REFERENCES daily_user(id) ON DELETE CASCADE,
  CONSTRAINT fk_polls_created_by FOREIGN KEY (created_by) REFERENCES daily_user(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS poll_options (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  poll_id BIGINT NOT NULL,
  label VARCHAR(255) NOT NULL,
  position INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_poll_option_position (poll_id, position),
  CONSTRAINT fk_poll_options_poll FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS poll_schedules (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  poll_id BIGINT NOT NULL,
  scheduled_at DATETIME NOT NULL,
  timezone VARCHAR(64) NOT NULL,
  status ENUM('scheduled','processing','processed','retry','failed') NOT NULL DEFAULT 'scheduled',
  last_run_at DATETIME NULL,
  next_run_at DATETIME NULL,
  attempt_count INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_poll_schedules_due (scheduled_at, status),
  INDEX idx_poll_schedules_next_run (next_run_at, status),
  CONSTRAINT fk_poll_schedules_poll FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS poll_dispatches (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  poll_id BIGINT NOT NULL,
  recipient_phone VARCHAR(50) NOT NULL,
  waha_message_id VARCHAR(255) NULL,
  status ENUM('pending','sent','failed') NOT NULL DEFAULT 'pending',
  error TEXT NULL,
  sent_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_poll_recipient (poll_id, recipient_phone),
  INDEX idx_poll_dispatch_poll_status (poll_id, status),
  CONSTRAINT fk_poll_dispatches_poll FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE
);
