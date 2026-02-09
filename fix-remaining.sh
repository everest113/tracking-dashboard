#!/bin/bash

# Fix logging require() imports
sed -i '' "s/const { getClientLogger } = require/import { getClientLogger } from/g" lib/infrastructure/logging/index.ts
sed -i '' "s/const { getServerLogger } = require/import { getServerLogger } from/g" lib/infrastructure/logging/index.ts

# Fix repository empty object types
sed -i '' "s/Prisma\.shipmentsGetPayload<{}>/Prisma.shipmentsGetPayload<object>/g" lib/infrastructure/repositories/types.ts
sed -i '' "s/Prisma\.tracking_eventsGetPayload<{}>/Prisma.tracking_eventsGetPayload<object>/g" lib/infrastructure/repositories/types.ts
sed -i '' "s/Prisma\.scanned_conversationsGetPayload<{}>/Prisma.scanned_conversationsGetPayload<object>/g" lib/infrastructure/repositories/types.ts
sed -i '' "s/Prisma\.sync_historyGetPayload<{}>/Prisma.sync_historyGetPayload<object>/g" lib/infrastructure/repositories/types.ts

# Fix test helpers empty object types  
sed -i '' "s/Prisma\.shipmentsGetPayload<{}>/Prisma.shipmentsGetPayload<object>/g" tests/helpers/db.ts

# Fix unused imports
sed -i '' "s/import { z } from 'zod'//" tests/fixtures/shipments.ts
sed -i '' "s/import type { TRACKING_NUMBERS } from/import type {/" tests/e2e/api/shipments.test.ts

echo "Done fixing files!"
