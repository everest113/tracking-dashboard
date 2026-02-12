#!/usr/bin/env tsx

import { getFrontClient } from './lib/infrastructure/sdks/front/client'

async function testFrontInboxes() {
  const client = getFrontClient()
  
  try {
    console.log('🔍 Fetching all inboxes...\n')
    
    // @ts-ignore - accessing private method for testing
    const response = await client.get('/inboxes', (z: any) => z.any())
    
    console.log('📥 Available inboxes:')
    console.log(JSON.stringify(response._results, null, 2))
    
    console.log('\n📋 Summary:')
    for (const inbox of response._results) {
      console.log(`  - ${inbox.name} (${inbox.id})`)
    }
    
    console.log(`\n🎯 Currently configured: inb_jsvaf`)
    const currentInbox = response._results.find((i: any) => i.id === 'inb_jsvaf')
    if (currentInbox) {
      console.log(`   ✅ Found: ${currentInbox.name}`)
    } else {
      console.log(`   ❌ NOT FOUND in your accessible inboxes!`)
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

testFrontInboxes()
