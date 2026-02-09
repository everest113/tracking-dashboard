-- Quick verification queries for conversation caching

-- 1. How many conversations have been scanned?
SELECT COUNT(*) as total_scanned_conversations
FROM scanned_conversations;

-- 2. Recent scans (last 10)
SELECT 
  conversation_id,
  subject,
  shipments_found,
  scanned_at
FROM scanned_conversations
ORDER BY scanned_at DESC
LIMIT 10;

-- 3. Cache statistics
SELECT 
  COUNT(*) as total_conversations,
  SUM(shipments_found) as total_shipments_found,
  AVG(shipments_found)::numeric(10,2) as avg_shipments_per_conversation,
  COUNT(CASE WHEN shipments_found > 0 THEN 1 END) as conversations_with_shipments,
  COUNT(CASE WHEN shipments_found = 0 THEN 1 END) as conversations_without_shipments
FROM scanned_conversations;

-- 4. Scans by date
SELECT 
  DATE(scanned_at) as scan_date,
  COUNT(*) as conversations_scanned,
  SUM(shipments_found) as shipments_found
FROM scanned_conversations
GROUP BY DATE(scanned_at)
ORDER BY scan_date DESC;

-- 5. Most recent scan activity
SELECT 
  MAX(scanned_at) as last_scan_time,
  MIN(scanned_at) as first_scan_time,
  NOW() - MAX(scanned_at) as time_since_last_scan
FROM scanned_conversations;
