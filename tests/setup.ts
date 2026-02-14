/**
 * Global test setup
 * Runs before all tests
 */

import { beforeAll, afterAll, beforeEach } from 'vitest'
import dotenv from 'dotenv'
import path from 'path'

// Load test environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.test') })

// Import after env vars are loaded
import { prisma } from '@/lib/prisma'

// Track if database has been setup
let isSetup = false

/**
 * Setup test database before all tests (runs once per process)
 */
beforeAll(async () => {
  if (isSetup) return
  
  console.log('🔧 Setting up test database...')
  
  try {
    // Just ensure connection works - don't force reset in parallel
    await prisma.$connect()
    console.log('✅ Test database ready')
    isSetup = true
  } catch (error) {
    console.error('❌ Failed to connect to test database:', error)
    throw error
  }
})

/**
 * Clean up database after all tests
 */
afterAll(async () => {
  console.log('🧹 Cleaning up test database...')
  await prisma.$disconnect()
})

/**
 * Clean all tables before each test (ensures isolation)
 */
beforeEach(async () => {
  // Truncate all tables (order matters due to foreign keys)
  // Each deletion is wrapped separately to handle missing tables gracefully
  try {
    await prisma.tracking_events.deleteMany()
  } catch {
    // Table might not exist
  }
  
  try {
    await prisma.omg_purchase_orders.deleteMany()
  } catch {
    // Table might not exist
  }
  
  try {
    await prisma.shipments.deleteMany()
  } catch {
    // Table might not exist
  }
  
  try {
    await prisma.scanned_conversations.deleteMany()
  } catch {
    // Table might not exist
  }
  
  try {
    await prisma.sync_history.deleteMany()
  } catch {
    // Table might not exist
  }
})
