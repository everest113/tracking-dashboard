require('dotenv').config({ path: '.env.local' });

const FRONT_API_TOKEN = process.env.FRONT_API_TOKEN;

if (!FRONT_API_TOKEN) {
  console.error('❌ FRONT_API_TOKEN not set');
  process.exit(1);
}

async function listInboxes() {
  try {
    const response = await fetch('https://api2.frontapp.com/inboxes', {
      headers: {
        'Authorization': `Bearer ${FRONT_API_TOKEN}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ API Error:', response.status, error);
      process.exit(1);
    }

    const data = await response.json();
    
    console.log('\n📬 Available Front Inboxes:\n');
    console.log('ID'.padEnd(25), '│', 'Name');
    console.log('─'.repeat(25), '┼', '─'.repeat(40));
    
    data._results.forEach(inbox => {
      console.log(inbox.id.padEnd(25), '│', inbox.name);
    });

    console.log('\n💡 Recommendation:');
    console.log('Set FRONT_INBOX_ID in Vercel environment variables to use a specific inbox ID');
    console.log('This is more reliable than finding by name (which requires an API call each time).\n');

    // Find the "Suppliers" inbox
    const suppliersInbox = data._results.find(i => 
      i.name.toLowerCase().includes('supplier')
    );

    if (suppliersInbox) {
      console.log(`🎯 Found "Suppliers" inbox: ${suppliersInbox.id}`);
      console.log(`   Run: vercel env add FRONT_INBOX_ID`);
      console.log(`   Value: ${suppliersInbox.id}\n`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

listInboxes();
