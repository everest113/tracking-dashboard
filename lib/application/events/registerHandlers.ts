import { registerShipmentEventHandlers } from './shipment/registerHandlers'

let initialized = false

export function registerEventHandlers() {
  if (initialized) return
  registerShipmentEventHandlers()
  initialized = true
}
