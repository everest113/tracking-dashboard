#!/bin/bash
set -e

echo "Fixing remaining ESLint errors..."

# Fix unused imports
sed -i '' '/import type { TrackerRegistrationResult }/d' app/api/trackers/backfill/route.ts
sed -i '' "s/import { z } from 'zod'//" tests/fixtures/shipments.ts
sed -i '' "s/, TRACKING_NUMBERS//" tests/e2e/api/shipments.test.ts

# Fix unused variables  
sed -i '' 's/const data = await/const _data = await/g' components/AddShipmentForm.tsx
sed -i '' 's/logger.trace(message, metadata)/logger.trace(message)/g' lib/infrastructure/logging/client-logger.ts

echo "Fixed simple issues. Now fixing remaining any types..."

