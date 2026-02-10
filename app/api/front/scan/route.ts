import { NextResponse } from 'next/server'
import { getFrontClient } from '@/lib/infrastructure/sdks/front/client'
import type { FrontConversation, FrontMessage } from '@/lib/infrastructure/sdks/front/schemas'
import { extractTrackingFromEmail } from '@/lib/application/use-cases/extractTrackingFromEmail'
import { getShipmentTrackingService } from '@/lib/application/ShipmentTrackingService'
import { prisma } from '@/lib/prisma'
import { getErrorMessage } from '@/lib/utils/fetch-helpers'

/**
 * Process conversations in parallel batches (OPTIMIZED with bulk Ship24 registration)
 */
async function processBatch(
  conversations: FrontConversation[],
  forceRescan: boolean = false
): Promise<{
  added: number
  updated: number
  skipped: number
  alreadyScanned: number
  noTracking: number
  errors: string[]
}> {
  const results = {
    added: 0,
    updated: 0,
    skipped: 0,
    alreadyScanned: 0,
    noTracking: 0,
    errors: [] as string[],
  }

  const frontClient = getFrontClient()
  const service = getShipmentTrackingService()

  // Process all conversations in parallel
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

        // Process shipments (create new or update existing if force rescan)
        const shipmentsToRegister = []
        
        for (const shipment of extractionResult.shipments) {
          const existing = await prisma.shipments.findUnique({
            where: { tracking_number: shipment.trackingNumber }
          })

          if (existing) {
            if (forceRescan) {
              // Force rescan: Update existing shipment with fresh data from email
              console.log(`Force rescan: Updating existing shipment ${shipment.trackingNumber}`)
              
              const updateData: any = {
                updated_at: new Date(),
              }
              
              // Update fields from extraction if they have values
              if (shipment.carrier) updateData.carrier = shipment.carrier
              if (shipment.poNumber) updateData.po_number = shipment.poNumber
              if (extractionResult.supplier) updateData.supplier = extractionResult.supplier
              if (shipment.shippedDate) updateData.shipped_date = new Date(shipment.shippedDate)
              if (!existing.front_conversation_id) updateData.front_conversation_id = conversation.id
              
              const updatedShipment = await prisma.shipments.update({
                where: { tracking_number: shipment.trackingNumber },
                data: updateData,
              })
              
              shipmentsToRegister.push(updatedShipment)
              results.updated++
            } else {
              // Normal mode: Skip existing, just update conversation ID if needed
              console.log(`Shipment already exists: ${shipment.trackingNumber}`)
              results.skipped++
              
              if (!existing.front_conversation_id) {
                await prisma.shipments.update({
                  where: { tracking_number: shipment.trackingNumber },
                  data: { 
                    front_conversation_id: conversation.id,
                    updated_at: new Date()
                  }
                })
              }
            }
            continue
          }

          // Create new shipment
          const newShipment = await prisma.shipments.create({
            data: {
              tracking_number: shipment.trackingNumber,
              carrier: shipment.carrier ?? null,
              po_number: shipment.poNumber || null,
              supplier: extractionResult.supplier || null,
              shipped_date: shipment.shippedDate ? new Date(shipment.shippedDate) : null,
              status: 'pending',
              front_conversation_id: conversation.id,
              updated_at: new Date(),
            }
          })

          console.log(`Created shipment: ${newShipment.tracking_number}`)
          shipmentsToRegister.push(newShipment)
          results.added++
        }

        // Batch register/update all shipments with Ship24 (AWAIT for force rescan)
        if (shipmentsToRegister.length > 0) {
          console.log(`📦 Bulk registering/updating ${shipmentsToRegister.length} trackers...`)
          
          try {
            // AWAIT the Ship24 registration to ensure data is fetched before continuing
            // The use case handles:
            // 1. Registering trackers with Ship24
            // 2. Fetching initial tracking data
            // 3. Saving all updates to database (tracker IDs + tracking data)
            const bulkResults = await service.registerTrackersBulk(
              shipmentsToRegister.map(s => ({
                trackingNumber: s.tracking_number,
                carrier: s.carrier,
                poNumber: s.po_number || undefined,
              }))
            )
            
            // Just check for errors (no need to manually update database - use case already did it)
            const successCount = bulkResults.filter(r => r.success).length
            const failureCount = bulkResults.filter(r => !r.success).length
            
            console.log(`✅ Bulk registered ${successCount}/${bulkResults.length} trackers with Ship24 data`)
            
            if (failureCount > 0) {
              const failedTrackers = bulkResults.filter(r => !r.success)
              console.error(`❌ Failed to register ${failureCount} trackers:`, failedTrackers.map(r => r.error).join(', '))
              results.errors.push(`${failureCount} trackers failed registration`)
            }
          } catch (err) {
            console.error(`❌ Bulk registration error:`, getErrorMessage(err))
            results.errors.push(`Ship24 registration failed: ${getErrorMessage(err)}`)
          }
        }

        await prisma.scanned_conversations.upsert({
          where: { conversation_id: conversation.id },
          update: { 
            scanned_at: new Date(),
            shipments_found: results.added + results.updated
          },
          create: {
            conversation_id: conversation.id,
            subject: conversation.subject,
            shipments_found: results.added + results.updated,
          },
        })

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
    const { after, batchSize = 50, pageSize = 100, maxPages, forceRescan = false } = body
    
    console.log('📥 Request params:', { 
      after, 
      batchSize, 
      pageSize, 
      maxPages, 
      forceRescan,
      isDevModeEnabled: process.env.DEV_ALLOW_RESCAN === 'true'
    })

    const frontClient = getFrontClient()

    const afterDate = after 
      ? new Date(after)
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    console.log(`Fetching conversations after: ${afterDate.toISOString()}`)

    const inboxId = process.env.FRONT_INBOX_ID
    
    if (!inboxId) {
      return NextResponse.json(
        { success: false, error: 'FRONT_INBOX_ID environment variable is not set' },
        { status: 500 }
      )
    }

    console.log(`Using inbox ID: ${inboxId}`)

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
          shipmentsUpdated: 0,
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

    // Developer Mode: Allow rescanning already analyzed conversations
    const isDevMode = process.env.DEV_ALLOW_RESCAN === 'true'
    const shouldRescan = forceRescan && isDevMode
    
    if (shouldRescan) {
      console.log('🔄 DEV MODE: Force rescanning ALL conversations (will update existing shipments with fresh Ship24 data)')
    }

    const conversationIds = conversations.map((c: FrontConversation) => c.id)
    const alreadyScanned = shouldRescan ? [] : await prisma.scanned_conversations.findMany({
      where: {
        conversation_id: { in: conversationIds }
      },
      select: { conversation_id: true }
    })

    const scannedIds = new Set(alreadyScanned.map(s => s.conversation_id))
    const unscannedConversations = shouldRescan 
      ? conversations 
      : conversations.filter((c: FrontConversation) => !scannedIds.has(c.id))

    console.log(`${unscannedConversations.length} conversations need scanning (${scannedIds.size} already scanned)${shouldRescan ? ' [FORCE RESCAN - WILL UPDATE WITH FRESH SHIP24 DATA]' : ''}`)

    if (unscannedConversations.length === 0) {
      return NextResponse.json({
        success: true,
        summary: {
          conversationsProcessed: 0,
          conversationsAlreadyScanned: scannedIds.size,
          shipmentsAdded: 0,
          shipmentsUpdated: 0,
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
      updated: 0,
      skipped: 0,
      alreadyScanned: scannedIds.size,
      noTracking: 0,
      errors: [] as string[],
    }

    // Process batches (sequentially to ensure Ship24 data is fetched)
    const batches: FrontConversation[][] = []
    
    for (let i = 0; i < unscannedConversations.length; i += batchSize) {
      batches.push(unscannedConversations.slice(i, i + batchSize))
    }

    console.log(`Processing ${batches.length} batches sequentially for force rescan`)

    // For force rescan, process sequentially to ensure Ship24 data is fetched
    if (shouldRescan) {
      for (let i = 0; i < batches.length; i++) {
        console.log(`Processing batch ${i + 1}/${batches.length}`)
        const batchResult = await processBatch(batches[i], forceRescan)
        results.added += batchResult.added
        results.updated += batchResult.updated
        results.skipped += batchResult.skipped
        results.noTracking += batchResult.noTracking
        results.errors.push(...batchResult.errors)
      }
    } else {
      // Normal mode: Process in parallel for speed
      const batchResults = await Promise.all(
        batches.map(batch => processBatch(batch, forceRescan))
      )

      for (const batchResult of batchResults) {
        results.added += batchResult.added
        results.updated += batchResult.updated
        results.skipped += batchResult.skipped
        results.noTracking += batchResult.noTracking
        results.errors.push(...batchResult.errors)
      }
    }

    const duration = Date.now() - startTime
    
    console.log('=== Scan Complete ===')
    console.log(`Processed: ${unscannedConversations.length} conversations in ${duration}ms`)
    console.log(`Added: ${results.added}, Updated: ${results.updated}, Skipped: ${results.skipped}, No tracking: ${results.noTracking}`)
    console.log(`Errors: ${results.errors.length}`)

    return NextResponse.json({
      success: true,
      summary: {
        conversationsProcessed: unscannedConversations.length,
        conversationsAlreadyScanned: results.alreadyScanned,
        shipmentsAdded: results.added,
        shipmentsUpdated: results.updated,
        shipmentsSkipped: results.skipped,
        conversationsWithNoTracking: results.noTracking,
        batchSize,
        totalConversations: conversations.length,
      },
      errors: results.errors,
      durationMs: duration,
      timestamp: new Date().toISOString()
    })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? getErrorMessage(error) : 'Failed to scan conversations'
    const errorStack = error instanceof Error ? error.stack : undefined
    
    console.error('=== Scan Error ===')
    console.error('Error:', errorMessage)
    console.error('Stack:', errorStack)

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        durationMs: Date.now() - startTime,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}
