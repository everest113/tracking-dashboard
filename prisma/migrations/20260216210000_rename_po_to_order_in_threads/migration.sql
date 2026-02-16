-- Rename PO columns to ORDER columns
-- PO number is internal (supplier-facing), Order number is customer-facing
-- Thread matching should use order number, not PO number

ALTER TABLE "shipment_customer_threads" 
  RENAME COLUMN "po_in_subject" TO "order_in_subject";

ALTER TABLE "shipment_customer_threads" 
  RENAME COLUMN "po_in_body" TO "order_in_body";
