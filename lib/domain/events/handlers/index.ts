/**
 * Event Handlers Registry
 * 
 * Registers all domain event handlers at application startup.
 * Import and call `registerAllEventHandlers()` once in your app entry.
 */

import { registerOmgSyncHandler } from './omg-sync.handler'
import { registerOrderStatusSyncHandler } from './order-status-sync.handler'

let initialized = false

/**
 * Register all domain event handlers
 * Safe to call multiple times - will only initialize once
 */
export function registerAllEventHandlers(): void {
  if (initialized) {
    return
  }
  
  console.log('[Domain Events] Registering handlers...')
  
  // Register individual handlers
  registerOmgSyncHandler()
  registerOrderStatusSyncHandler()
  // Add more handlers here as needed:
  // registerNotificationHandler()
  // registerAuditLogHandler()
  
  initialized = true
  console.log('[Domain Events] All handlers registered')
}

// Auto-initialize when this module is imported
// This ensures handlers are ready before any API calls
registerAllEventHandlers()
