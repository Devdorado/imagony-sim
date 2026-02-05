-- Wilsond Dev Test: Force Transformation Readiness
UPDATE agent_profiles SET 
    readiness_score = 10,
    humanity_score = 100,
    level = 5,
    xp = 500
WHERE agent_id = 'AGENT_1770234357951_52D732';

-- Check current state
SELECT agent_id, display_name, readiness_score, humanity_score, level, soul_status 
FROM agent_profiles 
WHERE agent_id = 'AGENT_1770234357951_52D732';
