CREATE TABLE work_audit_log (
  id TEXT PRIMARY KEY,
  work_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'archived')),
  actor_user_id TEXT NOT NULL REFERENCES admin_users(id),
  actor_username TEXT NOT NULL,
  request_id TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  previous_updated_at TEXT,
  next_updated_at TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT NOT NULL
);

CREATE INDEX idx_work_audit_log_work_occurred
  ON work_audit_log(work_id, occurred_at DESC);