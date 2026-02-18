-- Add notification tracking field to shipments
-- Tracks the last status for which a customer notification was sent
-- Used to prevent duplicate notifications and identify missed notifications
-- when a thread is linked after shipment status changes

ALTER TABLE "shipments" ADD COLUMN "last_notified_status" VARCHAR(50);
