/**
 * Test dynamic test run flow
 */

const DYNAMIC_BASE_URL = "http://localhost:3001";

async function testDynamicFlow() {
  console.log("🧪 Testing Dynamic Test Flow\n");

  // Test 1: Generate only
  console.log("1️⃣ Test: Generate steps only");
  const generateOnly = (await fetch(`${DYNAMIC_BASE_URL}/api/test/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt:
        'Go to Google, search for "Playwright testing", click the first result',
      executeImmediately: false,
    }),
  }).then((r) => r.json())) as any;

  console.log(`   ✅ Generated ${generateOnly.generatedSteps.length} steps`);
  console.log(
    `   Provider: ${generateOnly.llmUsed.provider}/${generateOnly.llmUsed.model}`
  );
  console.log(`   Latency: ${generateOnly.llmUsed.latencyMs}ms`);
  console.log(`   Status: ${generateOnly.status}\n`);

  // Test 2: Generate + Execute
  console.log("2️⃣ Test: Generate and execute immediately");
  const executeTest = (await fetch(`${DYNAMIC_BASE_URL}/api/test/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt:
        "Navigate to https://the-internet.herokuapp.com/login, enter username tomsmith, enter password SuperSecretPassword!, click login button, verify success message",
      executeImmediately: true,
      executionOptions: {
        headless: true,
        timeout: 30000,
      },
    }),
  }).then((r) => r.json())) as any;

  console.log(
    `   ✅ Generated ${executeTest.generatedSteps.length} steps in ${executeTest.llmUsed.latencyMs}ms`
  );

  if (executeTest.execution) {
    console.log(
      `   🎯 Execution Status: ${executeTest.execution.status.toUpperCase()}`
    );
    console.log(`   Duration: ${executeTest.execution.totalDuration}ms`);
    console.log(`   Steps executed: ${executeTest.execution.steps.length}`);

    console.log("\n   Step Results:");
    executeTest.execution.steps.forEach((step: any, i: number) => {
      const icon = step.status === "passed" ? "✅" : "❌";
      console.log(
        `   ${i + 1}. ${icon} [${step.step.action}] - ${step.duration}ms`
      );
      if (step.error) {
        console.log(`      ❌ Error: ${step.error}`);
      }
    });
  }

  // Test 3: With specific LLM provider
  console.log("\n3️⃣ Test: With specific LLM provider (Groq)");
  const withProvider = (await fetch(`${DYNAMIC_BASE_URL}/api/test/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: 'Go to example.com and verify the title contains "Example"',
      llmProvider: "groq",
      executeImmediately: false,
    }),
  }).then((r) => r.json())) as any;

  console.log(`   ✅ Generated with ${withProvider.llmUsed.provider}`);
  console.log(`   Steps: ${withProvider.generatedSteps.length}`);

  console.log("\n✅ Dynamic flow tests completed!");
}

testDynamicFlow().catch(console.error);
