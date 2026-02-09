-- Reset Database Script
-- WARNING: This will DELETE ALL DATA!

-- Truncate tables (CASCADE will also clear tracking_events)
TRUNCATE TABLE shipments CASCADE;
TRUNCATE TABLE scanned_conversations CASCADE;
TRUNCATE TABLE sync_history CASCADE;

-- Verify all tables are empty
SELECT 'shipments' as table_name, COUNT(*) as row_count FROM shipments
UNION ALL
SELECT 'scanned_conversations', COUNT(*) FROM scanned_conversations
UNION ALL
SELECT 'sync_history', COUNT(*) FROM sync_history
UNION ALL
SELECT 'tracking_events', COUNT(*) FROM tracking_events;
