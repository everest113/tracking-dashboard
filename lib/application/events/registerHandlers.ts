import { registerShipmentEventHandlers } from './shipment/registerHandlers'
import { registerCustomerNotificationHandlers } from './shipment/customerNotificationHandler'

let initialized = false

export function registerEventHandlers() {
  if (initialized) return
  
  // Internal team notifications (via Knock)
  registerShipmentEventHandlers()
  
  // Customer notifications (via Front)
  registerCustomerNotificationHandlers()
  
  initialized = true
}
