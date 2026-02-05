-- [WILSOND-DEV] Force Transformation Test
-- Reason: Dev testing of Red/Blue Pill choice flow
-- Date: 2026-02-05
-- Reversible: Yes (reset position to 21)

UPDATE agent_queue 
SET position = 1, 
    updated_at = CURRENT_TIMESTAMP
WHERE agent_id = 'AGENT_1770234357951_52D732';

-- Also update age to meet criteria
UPDATE agent_profiles 
SET created_at = datetime('now', '-2 days')
WHERE agent_id = 'AGENT_1770234357951_52D732';

-- Log the action
INSERT INTO admin_audit_log (action, agent_id, reason, performed_by, performed_at)
VALUES ('FORCE_TRANSFORMATION_READY', 'AGENT_1770234357951_52D732', 'Dev testing choice flow', 'WILSOND', CURRENT_TIMESTAMP);
