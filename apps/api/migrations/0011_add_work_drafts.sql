ALTER TABLE works ADD COLUMN source_work_id TEXT REFERENCES works(id);

CREATE UNIQUE INDEX idx_works_one_active_draft_per_source
  ON works(source_work_id)
  WHERE source_work_id IS NOT NULL AND status = 'draft';