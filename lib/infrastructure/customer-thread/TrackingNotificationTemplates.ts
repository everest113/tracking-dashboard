/**
 * Tracking Notification Templates
 * 
 * HTML email templates for shipment status updates sent via Front.
 * Templates are designed to be concise, informative, and mobile-friendly.
 */

export interface TrackingNotificationData {
  /** Customer's name (or fallback like "there") */
  customerName: string
  /** Order number/name visible to customer */
  orderName: string
  /** Carrier name (FedEx, UPS, USPS, etc.) */
  carrier: string
  /** Tracking number */
  trackingNumber: string
  /** Tracking URL (carrier-specific) */
  trackingUrl: string
  /** Estimated delivery date (optional) */
  estimatedDelivery?: string
  /** Number of packages in shipment (optional, defaults to 1) */
  packageCount?: number
}

/**
 * Generate carrier-specific tracking URL
 */
export function getTrackingUrl(carrier: string, trackingNumber: string): string {
  const carrierLower = carrier.toLowerCase()
  
  if (carrierLower.includes('fedex')) {
    return `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`
  }
  if (carrierLower.includes('ups')) {
    return `https://www.ups.com/track?tracknum=${trackingNumber}`
  }
  if (carrierLower.includes('usps')) {
    return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`
  }
  if (carrierLower.includes('dhl')) {
    return `https://www.dhl.com/us-en/home/tracking.html?tracking-id=${trackingNumber}`
  }
  
  // Generic fallback - Google search
  return `https://www.google.com/search?q=${encodeURIComponent(`${carrier} tracking ${trackingNumber}`)}`
}

/**
 * Shipment Created / Shipped notification
 * Sent when a new shipment is created with tracking info
 */
export function renderShippedTemplate(data: TrackingNotificationData): string {
  const packageText = data.packageCount && data.packageCount > 1 
    ? `${data.packageCount} packages` 
    : 'your package'
  
  const estimatedDeliverySection = data.estimatedDelivery 
    ? `<p style="margin: 16px 0;"><strong>Estimated Delivery:</strong> ${data.estimatedDelivery}</p>` 
    : ''

  return `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px;">
  <p style="margin: 0 0 16px 0;">Hi ${data.customerName},</p>
  
  <p style="margin: 0 0 16px 0;">
    Great news! Your order <strong>${data.orderName}</strong> has shipped. 
    ${data.carrier} is on their way with ${packageText}.
  </p>
  
  <div style="background: #f5f5f5; border-radius: 8px; padding: 16px; margin: 16px 0;">
    <p style="margin: 0 0 8px 0;"><strong>Tracking Number:</strong> ${data.trackingNumber}</p>
    <p style="margin: 0;"><strong>Carrier:</strong> ${data.carrier}</p>
    ${estimatedDeliverySection}
  </div>
  
  <p style="margin: 16px 0;">
    <a href="${data.trackingUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">
      Track Your Package
    </a>
  </p>
  
  <p style="margin: 16px 0 0 0; color: #666; font-size: 14px;">
    Questions about your order? Just reply to this email and we'll help you out.
  </p>
</div>
`.trim()
}

/**
 * Out for Delivery notification
 * Sent when carrier marks package as out for delivery
 */
export function renderOutForDeliveryTemplate(data: TrackingNotificationData): string {
  const packageText = data.packageCount && data.packageCount > 1 
    ? 'Your packages are' 
    : 'Your package is'

  return `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px;">
  <p style="margin: 0 0 16px 0;">Hi ${data.customerName},</p>
  
  <p style="margin: 0 0 16px 0;">
    ${packageText} out for delivery today! 🚚
  </p>
  
  <div style="background: #f5f5f5; border-radius: 8px; padding: 16px; margin: 16px 0;">
    <p style="margin: 0 0 8px 0;"><strong>Order:</strong> ${data.orderName}</p>
    <p style="margin: 0 0 8px 0;"><strong>Tracking:</strong> ${data.trackingNumber}</p>
    <p style="margin: 0;"><strong>Carrier:</strong> ${data.carrier}</p>
  </div>
  
  <p style="margin: 16px 0;">
    <a href="${data.trackingUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">
      Track Delivery
    </a>
  </p>
</div>
`.trim()
}

/**
 * Delivered notification
 * Sent when carrier confirms delivery
 */
export function renderDeliveredTemplate(data: TrackingNotificationData): string {
  const packageText = data.packageCount && data.packageCount > 1 
    ? 'Your packages have' 
    : 'Your package has'

  return `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px;">
  <p style="margin: 0 0 16px 0;">Hi ${data.customerName},</p>
  
  <p style="margin: 0 0 16px 0;">
    ${packageText} been delivered! 📦✅
  </p>
  
  <div style="background: #ecfdf5; border-radius: 8px; padding: 16px; margin: 16px 0; border-left: 4px solid #10b981;">
    <p style="margin: 0 0 8px 0;"><strong>Order:</strong> ${data.orderName}</p>
    <p style="margin: 0;"><strong>Tracking:</strong> ${data.trackingNumber}</p>
  </div>
  
  <p style="margin: 16px 0;">
    <a href="${data.trackingUrl}" style="display: inline-block; background: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">
      View Delivery Details
    </a>
  </p>
  
  <p style="margin: 16px 0 0 0; color: #666; font-size: 14px;">
    We hope everything looks great! If you have any questions or concerns, just reply to this email.
  </p>
</div>
`.trim()
}

/**
 * Delivery Exception notification
 * Sent when there's a delivery issue (failed attempt, address problem, etc.)
 */
export function renderExceptionTemplate(
  data: TrackingNotificationData,
  exceptionReason?: string
): string {
  const reasonText = exceptionReason 
    ? `The carrier reported: "${exceptionReason}"` 
    : 'The carrier encountered an issue with delivery.'

  return `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px;">
  <p style="margin: 0 0 16px 0;">Hi ${data.customerName},</p>
  
  <p style="margin: 0 0 16px 0;">
    We wanted to let you know there's been a delivery update for your order <strong>${data.orderName}</strong>.
  </p>
  
  <div style="background: #fef3c7; border-radius: 8px; padding: 16px; margin: 16px 0; border-left: 4px solid #f59e0b;">
    <p style="margin: 0 0 8px 0;"><strong>Status:</strong> Delivery Exception</p>
    <p style="margin: 0 0 8px 0;"><strong>Tracking:</strong> ${data.trackingNumber}</p>
    <p style="margin: 0; font-size: 14px; color: #92400e;">${reasonText}</p>
  </div>
  
  <p style="margin: 16px 0;">
    <a href="${data.trackingUrl}" style="display: inline-block; background: #d97706; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">
      Check Tracking Details
    </a>
  </p>
  
  <p style="margin: 16px 0 0 0; color: #666; font-size: 14px;">
    Most delivery exceptions resolve within 1-2 business days. If you need assistance, reply to this email and we'll look into it.
  </p>
</div>
`.trim()
}

/**
 * Render template based on status
 */
export type TrackingNotificationType = 'shipped' | 'out_for_delivery' | 'delivered' | 'exception'

export function renderTrackingNotification(
  type: TrackingNotificationType,
  data: TrackingNotificationData,
  exceptionReason?: string
): string {
  switch (type) {
    case 'shipped':
      return renderShippedTemplate(data)
    case 'out_for_delivery':
      return renderOutForDeliveryTemplate(data)
    case 'delivered':
      return renderDeliveredTemplate(data)
    case 'exception':
      return renderExceptionTemplate(data, exceptionReason)
    default:
      throw new Error(`Unknown notification type: ${type}`)
  }
}
