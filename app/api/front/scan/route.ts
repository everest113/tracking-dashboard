import { NextResponse } from 'next/server'
import { getFrontClient } from '@/lib/infrastructure/sdks/front/client'
import { extractTrackingInfo } from '@/lib/tracking-extractor'
import { getShipmentTrackingService } from '@/lib/application/ShipmentTrackingService'
import { prisma } from '@/lib/prisma'

// Process conversations in parallel batches
async function processBatch(
  conversations: any[],
  force: boolean
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

  // Process all conversations in parallel
  await Promise.allSettled(
    conversations.map(async (conversation) => {
      try {
        console.log(`Processing conversation: ${conversation.id}`)
        
        // Get ALL messages for this conversation
        const messages = await frontClient.getConversationMessages(conversation.id)
        
        if (messages.length === 0) {
          console.log(`No messages found in ${conversation.id}`)
          
          // Mark as scanned even if no messages (avoid re-checking)
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

        // Prepare messages for extraction (include sent date for fallback)
        const messagesToExtract = messages.map(msg => ({
          subject: msg.subject || conversation.subject,
          body: msg.text || msg.body,
          senderEmail: msg.author?.email,
          senderName: msg.author?.name,
          sentDate: msg.created_at ? new Date(msg.created_at * 1000) : undefined,
        }))

        // Extract tracking info and supplier using OpenAI
        const extraction = await extractTrackingInfo(messagesToExtract)
        console.log(`Extracted ${extraction.shipments.length} shipments from ${conversation.id}`)

        // Use AI-extracted supplier name, or fall back to sender info
        const supplierName = extraction.supplier 
          || messages[0]?.author?.name 
          || messages[0]?.author?.email 
          || 'Unknown Supplier'

        console.log(`Supplier identified: ${supplierName}`)

        // Get email sent date for fallback (use first message in thread)
        const emailSentDate = messages[0]?.created_at 
          ? new Date(messages[0].created_at * 1000) 
          : null

        let shipmentsAddedThisConvo = 0

        // Create shipments for each tracking number found
        for (const shipment of extraction.shipments) {
          try {
            // Validate tracking number
            if (!shipment.trackingNumber || typeof shipment.trackingNumber !== 'string') {
              console.warn(`Skipping shipment with invalid tracking number:`, shipment)
              continue
            }

            // Check if tracking number already exists
            const existing = await prisma.shipments.findUnique({
              where: { tracking_number: shipment.trackingNumber },
            })

            if (existing) {
              console.log(`Shipment ${shipment.trackingNumber} already exists`)
              results.skipped++
              continue
            }

            // Use PO number from AI extraction, or leave undefined if not found
            const poNumber = shipment.poNumber && typeof shipment.poNumber === 'string' 
              ? shipment.poNumber 
              : undefined

            if (poNumber) {
              console.log(`PO number found: ${poNumber}`)
            } else {
              console.log(`No PO number found - leaving empty`)
            }

            // Use shipped date from AI extraction, or fall back to email sent date
            let shipped_date: Date | null = null
            if (shipment.shippedDate) {
              shipped_date = new Date(shipment.shippedDate)
            } else if (emailSentDate) {
              shipped_date = emailSentDate
              console.log(`Using email sent date as shipped date: ${emailSentDate.toISOString()}`)
            }

            // Ensure carrier is a valid string
            const carrier = shipment.carrier && typeof shipment.carrier === 'string'
              ? shipment.carrier
              : undefined

            // Prepare shipment data
            const shipmentData: any = {
              po_number: poNumber,
              tracking_number: shipment.trackingNumber,
              carrier,
              supplier: supplierName,
              status: 'pending',
              front_conversation_id: conversation.id,
              shipped_date: shipped_date,
            }

            // Register tracker with Ship24 (non-blocking)
            try {
              const service = getShipmentTrackingService()
              const result = await service.registerTracker(
                shipment.trackingNumber,
                carrier || null,
                poNumber
              )
              
              if (result.success && result.trackerId) {
                shipmentData.ship24_tracker_id = result.trackerId
                console.log(`✅ Registered tracker: ${shipment.trackingNumber} → ${result.trackerId}`)
              }
            } catch (trackerError: any) {
              // Log but don't fail the shipment creation
              console.warn(`⚠️  Failed to register tracker for ${shipment.trackingNumber}:`, trackerError.message)
              // Will be picked up by backfill endpoint later
            }

            // Create shipment
            await prisma.shipments.create({
              data: shipmentData,
            })

            console.log(`Created shipment ${shipment.trackingNumber} - Supplier: ${supplierName} - PO: ${poNumber || 'none'} - Shipped: ${shipped_date?.toISOString() || 'unknown'}`)
            results.added++
            shipmentsAddedThisConvo++
          } catch (err: any) {
            console.error(`Error creating shipment ${shipment.trackingNumber}:`, err)
            results.errors.push(`Failed to create shipment ${shipment.trackingNumber}: ${err.message}`)
          }
        }

        // Mark conversation as scanned
        await prisma.scanned_conversations.upsert({
          where: { conversation_id: conversation.id },
          update: { 
            scanned_at: new Date(),
            shipments_found: shipmentsAddedThisConvo,
          },
          create: {
            conversation_id: conversation.id,
            subject: conversation.subject,
            shipments_found: shipmentsAddedThisConvo,
          },
        })

        if (extraction.shipments.length === 0) {
          results.noTracking++
        }
      } catch (err: any) {
        console.error(`Error processing conversation ${conversation.id}:`, err)
        results.errors.push(`Failed to process conversation ${conversation.id}: ${err.message}`)
      }
    })
  )

  return results
}

export async function POST(request: Request) {
  const startTime = Date.now()
  let syncHistoryId: number | null = null

  try {
    console.log('=== Scan Front Inbox Started ===')
    
    const { 
      after,  // Date string (YYYY-MM-DD) - fetch conversations from this date
      limit = 1000,  // Max conversations to fetch
      force = false,
      batchSize = 10
    } = await request.json().catch(() => ({}))
    
    console.log('Settings:', { after, limit, force, batchSize })

    // Check environment variables
    if (!process.env.FRONT_API_TOKEN) {
      console.error('Missing FRONT_API_TOKEN')
      return NextResponse.json(
        { error: 'Front API token not configured' },
        { status: 500 }
      )
    }

    if (!process.env.OPENAI_API_KEY) {
      console.error('Missing OPENAI_API_KEY')
      return NextResponse.json(
        { error: 'OpenAI API key not configured (required for tracking extraction)' },
        { status: 500 }
      )
    }

    // Create sync history record
    const syncRecord = await prisma.sync_history.create({
      data: {
        status: 'running',
        limit,
        batch_size: batchSize,
      },
    })
    syncHistoryId = syncRecord.id

    // Fetch conversations from Front
    console.log('Fetching conversations from Front...')
    const frontClient = getFrontClient()
    const conversations = await frontClient.listConversations({
      limit,
      after,
    })

    console.log(`Found ${conversations.length} total conversations`)

    if (conversations.length === 0) {
      const duration = Date.now() - startTime

      await prisma.sync_history.update({
        where: { id: syncHistoryId },
        data: {
          status: 'success',
          completed_at: new Date(),
          duration_ms: duration,
        },
      })

      return NextResponse.json({
        success: true,
        message: 'No conversations found',
        conversations_processed: 0,
        shipments_added: 0,
        duration_ms: duration,
      })
    }

    // Filter out already scanned conversations (unless force=true)
    let toProcess = conversations
    let alreadyScanned = 0

    if (!force) {
      const scannedIds = await prisma.scanned_conversations.findMany({
        select: { conversation_id: true },
      })
      const scannedSet = new Set(scannedIds.map((s) => s.conversation_id))

      toProcess = conversations.filter((c) => !scannedSet.has(c.id))
      alreadyScanned = conversations.length - toProcess.length

      console.log(`Skipping ${alreadyScanned} already scanned conversations`)
      console.log(`${toProcess.length} new conversations to process`)
    } else {
      console.log('Force mode: processing all conversations')
    }

    if (toProcess.length === 0) {
      const duration = Date.now() - startTime

      await prisma.sync_history.update({
        where: { id: syncHistoryId },
        data: {
          status: 'success',
          conversations_processed: 0,
          conversations_already_scanned: alreadyScanned,
          shipments_added: 0,
          completed_at: new Date(),
          duration_ms: duration,
        },
      })

      return NextResponse.json({
        success: true,
        message: 'All conversations already scanned',
        conversations_processed: 0,
        conversations_already_scanned: alreadyScanned,
        shipments_added: 0,
        duration_ms: duration,
      })
    }

    // Process in parallel batches
    const results = {
      added: 0,
      skipped: 0,
      alreadyScanned,
      noTracking: 0,
      errors: [] as string[],
    }

    for (let i = 0; i < toProcess.length; i += batchSize) {
      const batch = toProcess.slice(i, i + batchSize)
      console.log(`\nProcessing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(toProcess.length / batchSize)} (${batch.length} conversations)`)
      
      const batchResults = await processBatch(batch, force)
      
      results.added += batchResults.added
      results.skipped += batchResults.skipped
      results.noTracking += batchResults.noTracking
      results.errors.push(...batchResults.errors)

      console.log(`Batch complete: ${batchResults.added} added, ${batchResults.skipped} skipped, ${batchResults.noTracking} no tracking`)

      // Small delay between batches
      if (i + batchSize < toProcess.length) {
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
    }

    const duration = Date.now() - startTime

    // Update sync history with results
    await prisma.sync_history.update({
      where: { id: syncHistoryId },
      data: {
        status: results.errors.length > 0 ? 'partial_success' : 'success',
        conversations_processed: toProcess.length,
        conversations_already_scanned: alreadyScanned,
        shipments_added: results.added,
        shipments_skipped: results.skipped,
        conversations_with_no_tracking: results.noTracking,
        errors: results.errors,
        completed_at: new Date(),
        duration_ms: duration,
      },
    })

    console.log('=== Scan Complete ===')
    console.log(`Processed ${toProcess.length} conversations in ${duration}ms`)
    console.log(`Shipments added: ${results.added}`)
    console.log(`Shipments skipped (duplicates): ${results.skipped}`)
    console.log(`Conversations with no tracking: ${results.noTracking}`)
    console.log(`Errors: ${results.errors.length}`)

    return NextResponse.json({
      success: true,
      conversations_processed: toProcess.length,
      conversations_already_scanned: alreadyScanned,
      shipments_added: results.added,
      shipments_skipped: results.skipped,
      conversations_with_no_tracking: results.noTracking,
      errors: results.errors.slice(0, 10), // Limit error list in response
      duration_ms: duration,
    })
  } catch (error: any) {
    console.error('=== FATAL ERROR ===')
    console.error('Error:', error.message)
    console.error('Stack:', error.stack)

    // Update sync history with error
    if (syncHistoryId) {
      try {
        await prisma.sync_history.update({
          where: { id: syncHistoryId },
          data: {
            status: 'error',
            errors: [error.message],
            completed_at: new Date(),
            duration_ms: Date.now() - startTime,
          },
        })
      } catch (updateErr) {
        console.error('Failed to update sync history:', updateErr)
      }
    }

    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Failed to scan Front inbox',
        duration_ms: Date.now() - startTime,
      },
      { status: 500 }
    )
  }
}
