import { NextResponse } from 'next/server'
import { getFrontClient } from '@/lib/infrastructure/sdks/front/client'
import type { FrontConversation, FrontMessage } from '@/lib/infrastructure/sdks/front/schemas'
import { extractTrackingFromEmail } from '@/lib/application/use-cases/extractTrackingFromEmail'
import { getShipmentTrackingService } from '@/lib/application/ShipmentTrackingService'
import { prisma } from '@/lib/prisma'
import { getErrorMessage } from '@/lib/utils/fetch-helpers'

/**
 * Process conversations in parallel batches
 */
async function processBatch(
  conversations: FrontConversation[]
): Promise<{
  added: number
  skipped: number
  alreadyScanned: number
  noTracking: number
  errors: string[]
}> {
  const results = {
    added: 0,
    skipped: 0,
    alreadyScanned: 0,
    noTracking: 0,
    errors: [] as string[],
  }

  const frontClient = getFrontClient()

  await Promise.allSettled(
    conversations.map(async (conversation) => {
      try {
        console.log(`Processing conversation: ${conversation.id}`)
        
        const messages = await frontClient.getConversationMessages(conversation.id)
        
        if (messages.length === 0) {
          console.log(`No messages found in ${conversation.id}`)
          
          await prisma.scanned_conversations.upsert({
            where: { conversation_id: conversation.id },
            update: { scanned_at: new Date() },
            create: {
              conversation_id: conversation.id,
              subject: conversation.subject,
              shipments_found: 0,
            },
          })
          
          results.noTracking++
          return
        }

        console.log(`Found ${messages.length} messages in ${conversation.id}`)

        const messagesToExtract = messages.map((msg: FrontMessage) => ({
          subject: msg.subject || conversation.subject,
          body: msg.text || msg.body,
          senderEmail: msg.author?.email || msg.recipients[0]?.handle || '',
          senderName: msg.author?.name || msg.author?.username || '',
          date: new Date(msg.created_at * 1000).toISOString(),
        }))

        console.log(`Extracting tracking from ${messagesToExtract.length} messages...`)
        const extractionResult = await extractTrackingFromEmail(messagesToExtract)

        if (!extractionResult || extractionResult.shipments.length === 0) {
          console.log(`No tracking found in ${conversation.id}`)
          
          await prisma.scanned_conversations.upsert({
            where: { conversation_id: conversation.id },
            update: { scanned_at: new Date() },
            create: {
              conversation_id: conversation.id,
              subject: conversation.subject,
              shipments_found: 0,
            },
          })
          
          results.noTracking++
          return
        }

        console.log(`Found ${extractionResult.shipments.length} shipments in ${conversation.id}`)

        const service = getShipmentTrackingService()
        let addedCount = 0
        let skippedCount = 0

        for (const shipment of extractionResult.shipments) {
          try {
            const existing = await prisma.shipments.findUnique({
              where: { tracking_number: shipment.trackingNumber }
            })

            if (existing) {
              console.log(`Shipment already exists: ${shipment.trackingNumber}`)
              skippedCount++
              
              if (!existing.front_conversation_id) {
                await prisma.shipments.update({
                  where: { tracking_number: shipment.trackingNumber },
                  data: { 
                    front_conversation_id: conversation.id,
                    updated_at: new Date()
                  }
                })
              }
              
              continue
            }

            const newShipment = await prisma.shipments.create({
              data: {
                tracking_number: shipment.trackingNumber,
                carrier: shipment.carrier ?? null,
                po_number: shipment.poNumber ?? null,
                supplier: extractionResult.supplier ?? null,
                status: 'pending',
                front_conversation_id: conversation.id,
                updated_at: new Date(),
              }
            })

            console.log(`Created shipment: ${newShipment.tracking_number}`)
            addedCount++

            // Auto-register with Ship24 in background
            service.registerTracker(
              newShipment.tracking_number,
              newShipment.carrier ?? undefined,
              newShipment.po_number ?? undefined
            ).then((result) => {
              if (result.success) {
                console.log(`Registered tracker for ${newShipment.tracking_number}: ${result.trackerId}`)
              }
            }).catch((err) => {
              console.error(`Error registering tracker:`, getErrorMessage(err))
            })

          } catch (shipmentErr) {
            console.error(`Error adding shipment:`, getErrorMessage(shipmentErr))
            results.errors.push(getErrorMessage(shipmentErr))
            skippedCount++
          }
        }

        await prisma.scanned_conversations.upsert({
          where: { conversation_id: conversation.id },
          update: { 
            scanned_at: new Date(),
            shipments_found: addedCount
          },
          create: {
            conversation_id: conversation.id,
            subject: conversation.subject,
            shipments_found: addedCount,
          },
        })

        results.added += addedCount
        results.skipped += skippedCount

      } catch (error) {
        console.error(`Error processing conversation ${conversation.id}:`, getErrorMessage(error))
        results.errors.push(`${conversation.id}: ${getErrorMessage(error)}`)
      }
    })
  )

  return results
}

export async function POST(request: Request) {
  const startTime = Date.now()
  
  try {
    console.log('=== Front Scan Started ===')

    const body = await request.json()
    const { after, batchSize = 10, pageSize = 100, maxPages } = body

    const frontClient = getFrontClient()

    const afterDate = after 
      ? new Date(after)
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    console.log(`Fetching conversations after: ${afterDate.toISOString()}`)

    // Use inbox ID directly from environment
    const inboxId = process.env.FRONT_INBOX_ID
    
    if (!inboxId) {
      return NextResponse.json(
        { success: false, error: 'FRONT_INBOX_ID environment variable is not set' },
        { status: 500 }
      )
    }

    console.log(`Using inbox ID: ${inboxId}`)

    // Fetch ALL conversations (paginated automatically)
    const conversations = await frontClient.searchAllInboxConversations(inboxId, {
      pageSize,
      after: afterDate,
      maxPages,
    })

    console.log(`Found ${conversations.length} total conversations`)

    if (conversations.length === 0) {
      return NextResponse.json({
        success: true,
        summary: {
          conversationsProcessed: 0,
          conversationsAlreadyScanned: 0,
          shipmentsAdded: 0,
          shipmentsSkipped: 0,
          conversationsWithNoTracking: 0,
          batchSize,
          totalConversations: 0,
        },
        errors: [],
        durationMs: Date.now() - startTime,
        timestamp: new Date().toISOString()
      })
    }

    const conversationIds = conversations.map((c: FrontConversation) => c.id)
    const alreadyScanned = await prisma.scanned_conversations.findMany({
      where: {
        conversation_id: { in: conversationIds }
      },
      select: { conversation_id: true }
    })

    const scannedIds = new Set(alreadyScanned.map(s => s.conversation_id))
    const unscannedConversations = conversations.filter(
      (c: FrontConversation) => !scannedIds.has(c.id)
    )

    console.log(`${unscannedConversations.length} conversations need scanning (${scannedIds.size} already scanned)`)

    if (unscannedConversations.length === 0) {
      return NextResponse.json({
        success: true,
        summary: {
          conversationsProcessed: 0,
          conversationsAlreadyScanned: scannedIds.size,
          shipmentsAdded: 0,
          shipmentsSkipped: 0,
          conversationsWithNoTracking: 0,
          batchSize,
          totalConversations: conversations.length,
        },
        errors: [],
        durationMs: Date.now() - startTime,
        timestamp: new Date().toISOString()
      })
    }

    const results = {
      added: 0,
      skipped: 0,
      alreadyScanned: scannedIds.size,
      noTracking: 0,
      errors: [] as string[],
    }

    for (let i = 0; i < unscannedConversations.length; i += batchSize) {
      const batch = unscannedConversations.slice(i, i + batchSize)
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1} (${batch.length} conversations)`)
      
      const batchResults = await processBatch(batch)
      results.added += batchResults.added
      results.skipped += batchResults.skipped
      results.noTracking += batchResults.noTracking
      results.errors.push(...batchResults.errors)
      
      if (i + batchSize < unscannedConversations.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    const duration = Date.now() - startTime

    const summary = {
      conversationsProcessed: unscannedConversations.length,
      conversationsAlreadyScanned: results.alreadyScanned,
      shipmentsAdded: results.added,
      shipmentsSkipped: results.skipped,
      conversationsWithNoTracking: results.noTracking,
      batchSize,
      totalConversations: conversations.length,
    }

    console.log('=== Front Scan Complete ===')

    await prisma.sync_history.create({
      data: {
        conversations_processed: summary.conversationsProcessed,
        conversations_already_scanned: summary.conversationsAlreadyScanned,
        shipments_added: summary.shipmentsAdded,
        shipments_skipped: summary.shipmentsSkipped,
        conversations_with_no_tracking: summary.conversationsWithNoTracking,
        batch_size: batchSize,
        limit: conversations.length,  // Total conversations fetched
        duration_ms: duration,
        errors: results.errors,
        status: results.errors.length > 0 ? 'partial' : 'success',
        completed_at: new Date()
      }
    })

    return NextResponse.json({
      success: true,
      summary,
      errors: results.errors,
      durationMs: duration,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('=== Front Scan Error ===')
    console.error('Error:', getErrorMessage(error))

    return NextResponse.json(
      {
        success: false,
        error: getErrorMessage(error),
        durationMs: Date.now() - startTime,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}
