# Final ESLint Fixes Needed

## Remaining Issues (35 errors)

### API Routes
1. **manual-update-tracking/route.ts** - Replace `any` types with proper TrackingUpdateResult
2. **shipments/route.ts** - Replace `any` types with proper error handling  
3. **trackers/backfill/route.ts** - Remove unused TrackerRegistrationResult import

### Components  
4. **AddShipmentForm.tsx** - Fix response typing, remove unused data variable
5. **LastSyncDisplay.tsx** - Fix response typing
6. **ManualTrackingUpdate.tsx** - Fix response typing
7. **ShipmentTable.tsx** - Fix filter typing
8. **SyncDialog.tsx** - Fix setState in useEffect warning, fix response typing

### Lib Files
9. **ShipmentTrackingService.ts** - Fix service method return types
10. **client-logger.ts** - Remove unused parameters
11. **front/client.ts** - Fix response types
12. **ship24/client.ts** - Fix response types
13. **orpc/router.ts** - Fix any types

### Test Files
14. **tests/helpers/db.ts** - Already fixed (empty object types)
15. **tests/helpers/api.ts** - Fix any type in parseResponseBody
16. **tests/e2e/**.test.ts** - Fix response types

## Solution: Configure ESLint to allow require() in logging
Since we need dynamic imports for the logger, add exception:

```json
{
  "rules": {
    "@typescript-eslint/no-require-imports": ["error", {
      "allow": ["./client-logger", "./server-logger"]
    }]
  }
}
```

OR use this pattern everywhere and disable the rule for this specific use case.
