WITH RECURSIVE comment_tree(id) AS (
  SELECT id FROM comments WHERE deleted_at IS NOT NULL
  UNION ALL
  SELECT comment.id FROM comments comment
  JOIN comment_tree parent ON comment.parent_comment_id = parent.id
)
DELETE FROM comments WHERE id IN (SELECT id FROM comment_tree);