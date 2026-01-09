/**
 * Test API endpoints
 */

const API_BASE_URL = "http://localhost:3001";

async function testAPI() {
  console.log("🧪 Testing API Endpoints\n");

  // 1. Health check
  console.log("1️⃣ Health Check");
  const health = await fetch(`${API_BASE_URL}/health`).then((r) => r.json());
  console.log("   ", health);

  // 2. Get providers
  console.log("\n2️⃣ Get Providers");
  const providers = (await fetch(`${API_BASE_URL}/api/llm/providers`).then(
    (r) => r.json()
  )) as any;
  console.log("   Active:", providers.active);
  console.log(
    "   Providers:",
    providers.providers.map((p: any) => p.name).join(", ")
  );

  // 3. Set active provider to Groq
  console.log("\n3️⃣ Set Active Provider to Groq");
  const setProvider = await fetch(`${API_BASE_URL}/api/llm/providers/active`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider: "groq" }),
  }).then((r) => r.json());
  console.log("   ", setProvider);

  // 4. Generate test steps
  console.log("\n4️⃣ Generate Test Steps (with Groq)");
  const scenario = `
    User navigates to https://the-internet.herokuapp.com/login
    User enters "tomsmith" as username
    User enters "SuperSecretPassword!" as password
    User clicks login button
    User should see success message
  `;

  console.log("   Scenario:", scenario.trim().split("\n")[0].trim(), "...");
  console.log("   Generating...");

  const startTime = Date.now();
  const result = (await fetch(`${API_BASE_URL}/api/test/generate-steps`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scenario }),
  }).then((r) => r.json())) as any;

  console.log(
    `\n   ✅ Generated ${result.steps?.length || 0} steps in ${
      result.latencyMs
    }ms`
  );
  console.log("   Provider:", result.provider);
  console.log("   Model:", result.model);
  console.log("\n   Steps:");
  result.steps?.forEach((step: any, i: number) => {
    console.log(
      `   ${i + 1}. [${step.action}] ${step.target || ""} ${
        step.value ? `= "${step.value}"` : ""
      }`
    );
  });

  console.log("\n✅ All tests completed!");
}

testAPI().catch(console.error);
