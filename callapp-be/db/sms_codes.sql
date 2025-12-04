-- Table for storing SMS codes
CREATE TABLE IF NOT EXISTS sms_codes (
  id INT NOT NULL AUTO_INCREMENT,
  phone_number VARCHAR(20) NOT NULL,
  code VARCHAR(10) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  is_used BOOLEAN DEFAULT FALSE,
  PRIMARY KEY (id),
  INDEX idx_phone_number (phone_number),
  INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;