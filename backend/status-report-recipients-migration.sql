CREATE TABLE IF NOT EXISTS status_report_recipients (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  history_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT NOT NULL,
  email VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  attempts INT NOT NULL DEFAULT 0,
  last_attempt_at DATETIME NULL,
  sent_at DATETIME NULL,
  error_message TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_status_report_recipient (history_id, user_id),
  KEY idx_status_report_recipient_status (history_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
