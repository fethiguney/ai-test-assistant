/**
 * Test step executor end-to-end
 */

const EXECUTOR_BASE_URL = "http://localhost:3001";

async function testExecutor() {
  console.log("🧪 Testing Step Executor\n");

  // 1. Generate steps
  console.log("1️⃣ Generating test steps...");
  const generateResponse = await fetch(
    `${EXECUTOR_BASE_URL}/api/test/generate-steps`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scenario:
          "User goes to https://the-internet.herokuapp.com/login, enters username tomsmith, enters password SuperSecretPassword!, clicks login button, verifies success message is visible",
      }),
    }
  );

  const generated = (await generateResponse.json()) as any;
  console.log(
    `   ✅ Generated ${generated.steps.length} steps in ${generated.latencyMs}ms`
  );
  console.log("   Steps:", JSON.stringify(generated.steps, null, 2));

  // 2. Execute steps
  console.log("\n2️⃣ Executing steps with Playwright...");
  const executeResponse = await fetch(
    `${EXECUTOR_BASE_URL}/api/test/execute-steps`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        steps: generated.steps,
        scenario: "Login test",
        options: {
          headless: true,
          timeout: 30000,
          screenshot: false,
        },
      }),
    }
  );

  const result = (await executeResponse.json()) as any;

  console.log(`\n   Status: ${result.status.toUpperCase()}`);
  console.log(`   Duration: ${result.totalDuration}ms`);
  console.log(`   Steps executed: ${result.steps.length}`);

  // Show step results
  console.log("\n   Step Results:");
  result.steps.forEach((step: any, i: number) => {
    const icon = step.status === "passed" ? "✅" : "❌";
    console.log(
      `   ${i + 1}. ${icon} [${step.step.action}] ${step.step.target || ""} - ${
        step.duration
      }ms`
    );
    if (step.error) {
      console.log(`      Error: ${step.error}`);
    }
  });

  console.log("\n✅ Test completed!");
}

testExecutor().catch(console.error);
