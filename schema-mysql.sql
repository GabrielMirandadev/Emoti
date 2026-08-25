CREATE TABLE IF NOT EXISTS families (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  parent_name VARCHAR(120) NOT NULL,
  parent_email VARCHAR(180),
  pin VARCHAR(20) NOT NULL DEFAULT '1234',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS children (
  id INT AUTO_INCREMENT PRIMARY KEY,
  family_id INT NOT NULL,
  name VARCHAR(120) NOT NULL,
  birth_year INT,
  avatar VARCHAR(20) DEFAULT '🧒',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_children_family FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS emotion_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  child_id INT NOT NULL,
  emotion VARCHAR(30) NOT NULL,
  intensity INT NOT NULL,
  story TEXT,
  audio_path VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_intensity CHECK (intensity BETWEEN 1 AND 5),
  CONSTRAINT fk_records_child FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE,
  INDEX idx_children_family (child_id),
  INDEX idx_records_child_date (child_id, created_at)
);
