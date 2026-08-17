CREATE TRIGGER comments_body_max_length_insert
BEFORE INSERT ON comments
WHEN length(NEW.body) > 250
BEGIN
  SELECT RAISE(ABORT, 'comment body must be 250 characters or fewer');
END;

CREATE TRIGGER comments_body_max_length_update
BEFORE UPDATE OF body ON comments
WHEN length(NEW.body) > 250
BEGIN
  SELECT RAISE(ABORT, 'comment body must be 250 characters or fewer');
END;