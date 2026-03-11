-- Insert default pipeline stages for all organizations that don't have them yet
INSERT INTO pipeline_stages (org_id, name, description, stage_order, probability, color, is_active)
SELECT
  o.id,
  stage.name,
  stage.description,
  stage.stage_order,
  stage.probability,
  stage.color,
  true
FROM organizations o
CROSS JOIN (VALUES
  ('New Lead', 'Initial contact or inquiry', 1, 10, '#3B82F6'),
  ('Contacted', 'First outreach made', 2, 20, '#06B6D4'),
  ('Qualified', 'Lead meets criteria', 3, 40, '#EAB308'),
  ('Proposal Sent', 'Proposal delivered', 4, 60, '#F97316'),
  ('Negotiation', 'Terms being discussed', 5, 75, '#8B5CF6'),
  ('Closed Won', 'Deal completed successfully', 6, 100, '#22C55E'),
  ('Closed Lost', 'Deal did not close', 7, 0, '#EF4444')
) AS stage(name, description, stage_order, probability, color)
WHERE NOT EXISTS (
  SELECT 1 FROM pipeline_stages ps WHERE ps.org_id = o.id
);
