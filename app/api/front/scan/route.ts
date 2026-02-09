import { NextResponse } from 'next/server'
import { frontClient } from '@/lib/front-client'
import { extractTrackingInfo } from '@/lib/tracking-extractor'
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

  // Process all conversations in parallel
  await Promise.allSettled(
    conversations.map(async (conversation) => {
      try {
        console.log(`Processing conversation: ${conversation.id}`)
        
        // Get ALL messages for this conversation
        const messages = await frontClient.getFullConversation(conversation.id)
        
        if (messages.length === 0) {
          console.log(`No messages found in ${conversation.id}`)
          
          // Mark as scanned even if no messages (avoid re-checking)
          await prisma.scannedConversation.upsert({
            where: { conversationId: conversation.id },
            update: { scannedAt: new Date() },
            create: {
              conversationId: conversation.id,
              subject: conversation.subject,
              shipmentsFound: 0,
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
            const existing = await prisma.shipment.findUnique({
              where: { trackingNumber: shipment.trackingNumber },
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
            let shippedDate: Date | null = null
            if (shipment.shippedDate) {
              shippedDate = new Date(shipment.shippedDate)
            } else if (emailSentDate) {
              shippedDate = emailSentDate
              console.log(`Using email sent date as shipped date: ${emailSentDate.toISOString()}`)
            }

            // Ensure carrier is a valid string
            const carrier = shipment.carrier && typeof shipment.carrier === 'string'
              ? shipment.carrier
              : undefined

            // Create shipment
            await prisma.shipment.create({
              data: {
                poNumber,
                trackingNumber: shipment.trackingNumber,
                carrier,
                supplier: supplierName,
                status: 'pending',
                frontConversationId: conversation.id,
                shippedDate,
              },
            })

            console.log(`Created shipment ${shipment.trackingNumber} - Supplier: ${supplierName} - PO: ${poNumber || 'none'} - Shipped: ${shippedDate?.toISOString() || 'unknown'}`)
            results.added++
            shipmentsAddedThisConvo++
          } catch (err: any) {
            console.error(`Error creating shipment ${shipment.trackingNumber}:`, err)
            results.errors.push(`Failed to create shipment ${shipment.trackingNumber}: ${err.message}`)
          }
        }

        // Mark conversation as scanned
        await prisma.scannedConversation.upsert({
          where: { conversationId: conversation.id },
          update: { 
            scannedAt: new Date(),
            shipmentsFound: shipmentsAddedThisConvo,
          },
          create: {
            conversationId: conversation.id,
            subject: conversation.subject,
            shipmentsFound: shipmentsAddedThisConvo,
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
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      )
    }

    const suppliersInboxName = process.env.FRONT_SUPPLIERS_INBOX || 'Suppliers'

    // Create sync history entry
    const syncHistory = await prisma.syncHistory.create({
      data: {
        limit,
        batchSize,
        status: 'running',
      },
    })
    syncHistoryId = syncHistory.id

    // 1. Get Suppliers inbox ID
    console.log(`Fetching inbox: ${suppliersInboxName}`)
    const inboxId = await frontClient.getInboxId(suppliersInboxName)
    console.log('Inbox ID:', inboxId)
    
    if (!inboxId) {
      await prisma.syncHistory.update({
        where: { id: syncHistoryId },
        data: {
          status: 'failed',
          errors: [`${suppliersInboxName} inbox not found in Front`],
          completedAt: new Date(),
          durationMs: Date.now() - startTime,
        },
      })

      return NextResponse.json(
        { error: `${suppliersInboxName} inbox not found in Front` },
        { status: 404 }
      )
    }

    // 2. Get conversations (filtered by date if provided)
    console.log('Fetching conversations...')
    const afterDate = after ? new Date(after) : undefined
    const allConversations = await frontClient.getInboxConversations(inboxId, {
      limit,
      after: afterDate
    })
    console.log('Found conversations:', allConversations.length)

    // 3. BULK CHECK: Query database once for all conversation IDs
    if (!force && allConversations.length > 0) {
      const conversationIds = allConversations.map(c => c.id)
      
      console.log('Checking which conversations are already scanned...')
      const scannedConversations = await prisma.scannedConversation.findMany({
        where: {
          conversationId: {
            in: conversationIds
          }
        },
        select: {
          conversationId: true
        }
      })
      
      const scannedIds = new Set(scannedConversations.map(c => c.conversationId))
      const alreadyScannedCount = scannedIds.size
      
      // Filter out already-scanned conversations
      const conversations = allConversations.filter(c => !scannedIds.has(c.id))
      
      console.log(`Already scanned: ${alreadyScannedCount}, New to process: ${conversations.length}`)
      
      if (conversations.length === 0) {
        // All conversations already scanned!
        const summary = {
          conversationsProcessed: allConversations.length,
          conversationsAlreadyScanned: alreadyScannedCount,
          shipmentsAdded: 0,
          shipmentsSkipped: 0,
          conversationsWithNoTracking: 0,
          batchSize,
        }

        await prisma.syncHistory.update({
          where: { id: syncHistoryId },
          data: {
            conversationsProcessed: summary.conversationsProcessed,
            conversationsAlreadyScanned: summary.conversationsAlreadyScanned,
            shipmentsAdded: 0,
            shipmentsSkipped: 0,
            conversationsWithNoTracking: 0,
            errors: [],
            status: 'success',
            completedAt: new Date(),
            durationMs: Date.now() - startTime,
          },
        })

        console.log('=== Scan Complete (All Already Scanned) ===', summary)

        return NextResponse.json({
          success: true,
          summary,
        })
      }

      // 4. Process only new conversations in parallel batches
      const totalResults = {
        added: 0,
        skipped: 0,
        alreadyScanned: alreadyScannedCount,
        noTracking: 0,
        errors: [] as string[],
      }

      for (let i = 0; i < conversations.length; i += batchSize) {
        const batch = conversations.slice(i, i + batchSize)
        console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(conversations.length / batchSize)} (${batch.length} conversations)`)
        
        const batchResults = await processBatch(batch, force)
        
        totalResults.added += batchResults.added
        totalResults.skipped += batchResults.skipped
        totalResults.noTracking += batchResults.noTracking
        totalResults.errors.push(...batchResults.errors)
      }

      const summary = {
        conversationsProcessed: allConversations.length,
        conversationsAlreadyScanned: totalResults.alreadyScanned,
        shipmentsAdded: totalResults.added,
        shipmentsSkipped: totalResults.skipped,
        conversationsWithNoTracking: totalResults.noTracking,
        batchSize,
      }

      // Update sync history with results
      await prisma.syncHistory.update({
        where: { id: syncHistoryId },
        data: {
          conversationsProcessed: summary.conversationsProcessed,
          conversationsAlreadyScanned: summary.conversationsAlreadyScanned,
          shipmentsAdded: summary.shipmentsAdded,
          shipmentsSkipped: summary.shipmentsSkipped,
          conversationsWithNoTracking: summary.conversationsWithNoTracking,
          errors: totalResults.errors,
          status: totalResults.errors.length > 0 ? 'partial' : 'success',
          completedAt: new Date(),
          durationMs: Date.now() - startTime,
        },
      })

      console.log('=== Scan Complete ===', summary)

      return NextResponse.json({
        success: true,
        summary,
        errors: totalResults.errors.length > 0 ? totalResults.errors : undefined,
      })
    } else {
      // Force mode or no conversations - process all
      const totalResults = {
        added: 0,
        skipped: 0,
        alreadyScanned: 0,
        noTracking: 0,
        errors: [] as string[],
      }

      for (let i = 0; i < allConversations.length; i += batchSize) {
        const batch = allConversations.slice(i, i + batchSize)
        console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(allConversations.length / batchSize)} (${batch.length} conversations)`)
        
        const batchResults = await processBatch(batch, force)
        
        totalResults.added += batchResults.added
        totalResults.skipped += batchResults.skipped
        totalResults.alreadyScanned += batchResults.alreadyScanned
        totalResults.noTracking += batchResults.noTracking
        totalResults.errors.push(...batchResults.errors)
      }

      const summary = {
        conversationsProcessed: allConversations.length,
        conversationsAlreadyScanned: totalResults.alreadyScanned,
        shipmentsAdded: totalResults.added,
        shipmentsSkipped: totalResults.skipped,
        conversationsWithNoTracking: totalResults.noTracking,
        batchSize,
      }

      await prisma.syncHistory.update({
        where: { id: syncHistoryId },
        data: {
          conversationsProcessed: summary.conversationsProcessed,
          conversationsAlreadyScanned: summary.conversationsAlreadyScanned,
          shipmentsAdded: summary.shipmentsAdded,
          shipmentsSkipped: summary.shipmentsSkipped,
          conversationsWithNoTracking: summary.conversationsWithNoTracking,
          errors: totalResults.errors,
          status: totalResults.errors.length > 0 ? 'partial' : 'success',
          completedAt: new Date(),
          durationMs: Date.now() - startTime,
        },
      })

      console.log('=== Scan Complete ===', summary)

      return NextResponse.json({
        success: true,
        summary,
        errors: totalResults.errors.length > 0 ? totalResults.errors : undefined,
      })
    }
  } catch (error: any) {
    console.error('=== FATAL ERROR ===')
    console.error('Error type:', error.constructor.name)
    console.error('Error message:', error.message)
    console.error('Stack trace:', error.stack)
    
    // Update sync history with error
    if (syncHistoryId) {
      await prisma.syncHistory.update({
        where: { id: syncHistoryId },
        data: {
          status: 'failed',
          errors: [error.message || 'Unknown error'],
          completedAt: new Date(),
          durationMs: Date.now() - startTime,
        },
      })
    }

    return NextResponse.json(
      { 
        error: error.message || 'Failed to scan Front inbox',
        details: error.stack,
      },
      { status: 500 }
    )
  }
}
