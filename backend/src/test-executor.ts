/**
 * Test step executor end-to-end
 */

const EXECUTOR_BASE_URL = "http://localhost:3001";

// Define test scenarios
const TEST_SCENARIOS = {
  login:
    "User goes to https://the-internet.herokuapp.com/login, enters username tomsmith, enters password SuperSecretPassword!, clicks login button, verifies success message is visible",

  google:
    'Navigate to https://google.com, search for "Playwright testing", verify results are displayed',

  example:
    "Go to https://example.com and verify the title contains 'Example Domain'",

  form: "Navigate to https://the-internet.herokuapp.com/add_remove_elements, click Add Element button twice, verify two delete buttons appear",

  dropdown:
    "Go to https://the-internet.herokuapp.com/dropdown, select Option 2 from the dropdown, verify it is selected",
} as const;

type ScenarioName = keyof typeof TEST_SCENARIOS;

async function testExecutor(scenarioName: ScenarioName = "login") {
  const scenario = TEST_SCENARIOS[scenarioName];

  console.log(`🧪 Testing Step Executor: ${scenarioName.toUpperCase()}\n`);
  console.log(`📝 Scenario: ${scenario.substring(0, 80)}...\n`);

  // 1. Generate steps
  console.log("1️⃣ Generating test steps...");
  const generateResponse = await fetch(
    `${EXECUTOR_BASE_URL}/api/test/generate-steps`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenario }),
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
        scenario: `${scenarioName} test`,
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

// Get scenario from command line or use default
const scenarioArg = process.argv[2] as ScenarioName | undefined;
const availableScenarios = Object.keys(TEST_SCENARIOS);

if (scenarioArg && !availableScenarios.includes(scenarioArg)) {
  console.error(`❌ Invalid scenario: ${scenarioArg}`);
  console.log(`\nAvailable scenarios: ${availableScenarios.join(", ")}`);
  console.log(`\nUsage: tsx src/test-executor.ts [scenario]`);
  console.log(`Example: tsx src/test-executor.ts google\n`);
  process.exit(1);
}

testExecutor(scenarioArg || "login").catch(console.error);
