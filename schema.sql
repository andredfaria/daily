-- ============================================================
-- Daily App - MySQL Schema
-- Database: daily
-- Connection: mysql://mysql:...@easypanel.eficienciia.com.br:3306/daily
-- ============================================================

CREATE DATABASE IF NOT EXISTS daily;
USE daily;

CREATE TABLE IF NOT EXISTS daily_user (
  id                      BIGINT AUTO_INCREMENT PRIMARY KEY,
  created_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  name                    VARCHAR(255),
  email                   VARCHAR(255) UNIQUE,
  password_hash           VARCHAR(255),
  phone                   VARCHAR(50) UNIQUE,
  title                   VARCHAR(255),
  `option`                JSON,                          -- ← backticks
  time_to_send            INT,
  is_admin                TINYINT(1) NOT NULL DEFAULT 0,
  subscription_status     ENUM('trial','active','cancelled','expired') DEFAULT 'trial',
  trial_ends_at           DATETIME,
  subscription_ends_at    DATETIME,
  subscription_plan       ENUM('basic','premium','enterprise'),
  payment_provider        ENUM('hotmart','stripe','asaas','mercadopago'),
  payment_customer_id     VARCHAR(255),
  payment_subscription_id VARCHAR(255),
  payment_status          ENUM('pending','paid','failed','refunded','cancelled'),
  next_billing_date       DATETIME,
  reset_token             VARCHAR(255),
  reset_token_expires_at  DATETIME
);

CREATE TABLE IF NOT EXISTS daily_data (
  id            BIGINT AUTO_INCREMENT PRIMARY KEY,
  id_user       BIGINT NOT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  activity_date DATE NOT NULL DEFAULT (CURRENT_DATE),
  check_status  TINYINT(1) DEFAULT 0,
  `option`      TEXT,                                    -- ← backticks
  CONSTRAINT fk_daily_data_user FOREIGN KEY (id_user)
    REFERENCES daily_user(id)
    ON DELETE CASCADE
);

CREATE INDEX idx_daily_data_user_date ON daily_data(id_user, activity_date);
CREATE INDEX idx_daily_user_email ON daily_user(email);