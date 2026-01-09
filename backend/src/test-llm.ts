/**
 * Test script for LLM providers
 * Run with: npm run test:llm
 */

import { llmManager } from "./llm/index.js";

async function testProviders() {
  console.log("=".repeat(60));
  console.log("🧪 Testing LLM Providers");
  console.log("=".repeat(60));

  // Check all providers
  console.log("\n📊 Checking provider health...\n");
  const statuses = await llmManager.checkAllProviders();

  for (const status of statuses) {
    const icon = status.isAvailable ? "✅" : "❌";
    console.log(`${icon} ${status.name} (${status.model})`);
    console.log(`   Available: ${status.isAvailable}`);
    console.log(`   Free: ${status.isFree}`);
    if (status.error) {
      console.log(`   Error: ${status.error}`);
    }
    console.log("");
  }

  // Find available provider
  const groqAvailable = statuses.find(
    (s) => s.type === "groq" && s.isAvailable
  );
  const ollamaAvailable = statuses.find(
    (s) => s.type === "ollama" && s.isAvailable
  );

  const preferredProvider = groqAvailable
    ? "groq"
    : ollamaAvailable
    ? "ollama"
    : null;

  if (!preferredProvider) {
    console.log("❌ No available providers found!");
    console.log("\nTo fix this:");
    console.log("1. Start Ollama: ollama serve");
    console.log("2. Or set GROQ_API_KEY environment variable");
    process.exit(1);
  }

  console.log(`\n🎯 Using provider: ${preferredProvider}\n`);
  llmManager.setActiveProvider(preferredProvider);

  // Test simple generation
  console.log("=".repeat(60));
  console.log("📝 Test 1: Simple Generation");
  console.log("=".repeat(60));

  try {
    const result = await llmManager.generate(
      "What is 2 + 2? Answer with just the number.",
      "You are a helpful assistant. Be concise."
    );

    console.log(`Response: ${result.content}`);
    console.log(`Model: ${result.model}`);
    console.log(`Provider: ${result.provider}`);
    console.log(`Latency: ${result.latencyMs}ms`);
    console.log(`Tokens: ${result.usage?.totalTokens || "N/A"}`);
  } catch (error) {
    console.error("Generation failed:", error);
  }

  // Test test step generation
  console.log("\n" + "=".repeat(60));
  console.log("🧪 Test 2: Test Step Generation (via Service)");
  console.log("=".repeat(60));

  const { createTestGeneratorService } = await import("./services/index.js");
  const testGenerator = createTestGeneratorService(llmManager);

  const testScenario = `
User goes to login page at https://the-internet.herokuapp.com/login
User enters username "tomsmith" in the username field
User enters password "SuperSecretPassword!" in the password field
User clicks the login button
User should see a success message
  `.trim();

  console.log("\nScenario:");
  console.log(testScenario);
  console.log("\nGenerating steps...\n");

  try {
    const result = await testGenerator.generateSteps({
      scenario: testScenario,
      context: {
        pageType: "login",
        allowedActions: ["goto", "fill", "click", "expectVisible"],
      },
    });

    console.log("Generated Steps:");
    console.log(JSON.stringify(result.steps, null, 2));
    console.log(`\nModel: ${result.model}`);
    console.log(`Provider: ${result.provider}`);
    console.log(`Latency: ${result.latencyMs}ms`);
  } catch (error) {
    console.error("Test step generation failed:", error);
  }

  console.log("\n" + "=".repeat(60));
  console.log("✅ Tests completed!");
  console.log("=".repeat(60));
}

testProviders().catch(console.error);
