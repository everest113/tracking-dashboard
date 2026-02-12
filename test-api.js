const fetch = require('node-fetch');

async function test() {
  const response = await fetch('http://localhost:3000/api/shipments?limit=5');
  const data = await response.json();
  console.log(JSON.stringify(data, null, 2));
}

test();
