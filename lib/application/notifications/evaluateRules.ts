import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getNotificationQueue } from '@/lib/infrastructure/notifications/PrismaNotificationQueue'
import { renderTemplate } from './renderTemplate'
import type { TemplateData } from './types'

/**
 * Evaluate notification rules for a given event and enqueue notifications.
 */
export async function evaluateAndEnqueue(
  triggerEvent: string,
  eventId: string,
  payload: TemplateData
): Promise<{ rulesMatched: number; notificationsQueued: number }> {
  // Find matching rules with templates and recipients
  const rules = await prisma.notification_rules.findMany({
    where: {
      trigger_event: triggerEvent,
      enabled: true,
    },
    include: {
      template: true,
      recipients: true,
    },
  })

  let notificationsQueued = 0
  const queue = getNotificationQueue()

  for (const rule of rules) {
    // Evaluate filter if present
    if (rule.filter) {
      const filterResult = evaluateFilter(rule.filter, payload)
      if (!filterResult) continue
    }

    // Render template
    const renderedSubject = rule.template.subject
      ? renderTemplate(rule.template.subject, payload)
      : null
    const renderedBody = renderTemplate(rule.template.body, payload)

    // Build notification payloads for each recipient
    const payloads = rule.recipients.map((recipient) => ({
      channel: recipient.channel,
      recipient: recipient.target,
      subject: renderedSubject,
      body: renderedBody,
      metadata: {
        templateId: rule.template_id,
        ruleId: rule.id,
        recipientMetadata: recipient.metadata,
        templateMetadata: rule.template.metadata,
      },
    }))

    if (payloads.length > 0) {
      await queue.enqueue(payloads, { ruleId: rule.id, eventId })
      notificationsQueued += payloads.length
    }
  }

  return { rulesMatched: rules.length, notificationsQueued }
}

/**
 * Simple filter evaluation.
 * Supports basic JSON predicates: { "field": "value" } for equality checks.
 * Returns true if all conditions match.
 */
function evaluateFilter(filter: Prisma.JsonValue, payload: TemplateData): boolean {
  if (!filter || typeof filter !== 'object' || Array.isArray(filter)) {
    return true
  }

  for (const [key, expected] of Object.entries(filter)) {
    const actual = getNestedValue(payload, key)
    if (actual !== expected) {
      return false
    }
  }

  return true
}

/**
 * Get a nested value from an object using dot notation.
 * e.g., getNestedValue({ a: { b: 1 } }, 'a.b') => 1
 */
function getNestedValue(obj: TemplateData, path: string): unknown {
  return path.split('.').reduce((acc: unknown, key) => {
    if (acc && typeof acc === 'object' && key in acc) {
      return (acc as Record<string, unknown>)[key]
    }
    return undefined
  }, obj)
}
