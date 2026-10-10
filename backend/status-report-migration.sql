CREATE TABLE IF NOT EXISTS status_report_schedules (
  client_id BIGINT NOT NULL,
  weekday TINYINT NOT NULL DEFAULT 1,
  send_time TIME NOT NULL DEFAULT '09:00:00',
  enabled TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (client_id),
  KEY idx_status_report_enabled (enabled, weekday, send_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS status_report_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  client_id BIGINT NOT NULL,
  scheduled_date DATE NOT NULL,
  report_type VARCHAR(10) NOT NULL DEFAULT 'AUTO',
  status VARCHAR(20) NOT NULL,
  recipient_count INT NOT NULL DEFAULT 0,
  sent_count INT NOT NULL DEFAULT 0,
  error_message TEXT NULL,
  started_at DATETIME NULL,
  finished_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_status_report_client_date_type (client_id, scheduled_date, report_type),
  KEY idx_status_report_history_client (client_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
