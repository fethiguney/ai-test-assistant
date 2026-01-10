/**
 * Test MCP integration
 */

const MCP_BASE_URL = 'http://localhost:3001';

async function testMCP() {
  console.log('🧪 Testing MCP Integration\n');

  // 1. Check MCP clients
  console.log('1️⃣ MCP Clients');
  const clients = await fetch(`${MCP_BASE_URL}/api/test/mcp/clients`).then(r => r.json()) as any;
  console.log('   Active:', clients.activeClient);
  console.log('   Clients:', clients.clients.map((c: any) => c.name).join(', '));

  // 2. Check MCP health
  console.log('\n2️⃣ MCP Health Check');
  const health = await fetch(`${MCP_BASE_URL}/api/test/mcp/clients/health`).then(r => r.json()) as any;
  health.clients.forEach((c: any) => {
    const icon = c.isAvailable ? '✅' : '❌';
    console.log(`   ${icon} ${c.name} - Connected: ${c.isConnected}`);
  });

  // 3. Run test with MCP (Playwright)
  console.log('\n3️⃣ Run test with MCP (Playwright)');
  const result = await fetch(`${MCP_BASE_URL}/api/test/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: 'Go to https://the-internet.herokuapp.com/login, enter username tomsmith, password SuperSecretPassword!, click login, verify success',
      llmProvider: 'groq',
      mcpClient: 'playwright',
      executeImmediately: true,
      executionOptions: {
        headless: true,
        timeout: 30000
      }
    })
  }).then(r => r.json()) as any;

  console.log(`   ✅ Generated ${result.generatedSteps.length} steps`);
  console.log(`   LLM: ${result.llmUsed.provider}/${result.llmUsed.model}`);
  console.log(`   Execution Method: ${result.executionMethod}`);
  console.log(`   MCP Client: ${result.mcpClient || 'N/A'}`);
  
  if (result.execution) {
    console.log(`   Status: ${result.execution.status.toUpperCase()}`);
    console.log(`   Duration: ${result.execution.totalDuration}ms`);
    console.log(`   Steps executed: ${result.execution.steps.length}`);
  }

  // 4. Run test with direct execution (no MCP)
  console.log('\n4️⃣ Run test with direct execution');
  const directResult = await fetch(`${MCP_BASE_URL}/api/test/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: 'Visit example.com',
      mcpClient: 'direct',
      executeImmediately: true,
      executionOptions: { headless: true }
    })
  }).then(r => r.json()) as any;

  console.log(`   Execution Method: ${directResult.executionMethod}`);
  console.log(`   Status: ${directResult.execution?.status || 'N/A'}`);

  console.log('\n✅ MCP integration tests completed!');
}

testMCP().catch(console.error);
