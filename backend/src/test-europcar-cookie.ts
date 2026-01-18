/**
 * Test Script - Europcar Cookie Policy
 *
 * Tests the selector generation fix for sites with Tailwind CSS classes
 * Scenario: "navigate to https://www.europcar.com.tr/en and accept cookie policy"
 *
 * Previous issue: Generated invalid selector `.focus:outline-none`
 * Fix: Skip classes with special characters, prefer text-based selectors
 */

import { testOrchestrator } from "./websocket/websocket-test-orchestrator.js";

async function runEuropcarTest() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║      Testing: Europcar Cookie Policy (Selector Fix)       ║");
  console.log(
    "╚════════════════════════════════════════════════════════════╝\n"
  );

  const scenario =
    "navigate to https://www.europcar.com.tr/en and accept cookie policy";
  const sessionId = `europcar_test_${Date.now()}`;

  console.log(`Scenario: "${scenario}"\n`);
  console.log("Expected behavior:");
  console.log("  1. Navigate to Europcar website");
  console.log("  2. Capture snapshot with cookie dialog elements");
  console.log(
    "  3. Generate click step using VALID selector (not .focus:outline-none)"
  );
  console.log("  4. Click the accept button successfully");
  console.log("  5. NO SELECTOR ERRORS!\n");
  console.log("=".repeat(60) + "\n");

  let stepCount = 0;
  let snapshotCount = 0;
  let selectorErrors: string[] = [];

  try {
    const result = await testOrchestrator.runIterativeTest(scenario, {
      sessionId,
      llmProvider: "groq",
      browser: "chromium",
      headless: false,

      onStepGenerated: async (step, snapshot) => {
        stepCount++;
        console.log(`\n✨ STEP ${stepCount} GENERATED:`);
        console.log(`   Action: ${step.action}`);
        console.log(`   Target: ${step.target || "N/A"}`);
        console.log(`   Value: ${step.value || "N/A"}`);
        console.log(`   Description: ${step.description || "N/A"}`);

        if (snapshot) {
          console.log(`\n   📸 Page Context Available:`);
          console.log(`      URL: ${snapshot.url}`);
          console.log(`      Title: ${snapshot.title}`);
          console.log(`      Elements: ${snapshot.elements.length}`);

          // Check for cookie-related buttons
          const cookieButtons = snapshot.elements.filter((el) => {
            const text = (el.text || "").toLowerCase();
            const ariaLabel = (el.ariaLabel || "").toLowerCase();
            return (
              (el.tag === "button" || el.role === "button") &&
              (text.includes("accept") ||
                text.includes("cookie") ||
                ariaLabel.includes("accept") ||
                ariaLabel.includes("cookie"))
            );
          });

          if (cookieButtons.length > 0) {
            console.log(
              `\n      ✅ Found ${cookieButtons.length} cookie button(s):`
            );
            cookieButtons.slice(0, 3).forEach((btn) => {
              console.log(`         - Selector: ${btn.selector}`);
              console.log(`           Text: "${btn.text || "N/A"}"`);
              console.log(`           Label: ${btn.ariaLabel || "N/A"}`);

              // Validate selector doesn't contain unescaped special chars
              if (
                btn.selector.includes(".") &&
                /[:\/\[\]@!#]/.test(btn.selector)
              ) {
                console.log(
                  `           ⚠️  WARNING: Selector contains special chars!`
                );
              }
            });
          }
        } else {
          console.log(
            `\n   ⚠️  No page context (expected for navigation steps)`
          );
        }

        // Validate the selector format
        if (step.target) {
          // Check for invalid CSS selectors with unescaped special chars
          if (step.target.startsWith(".") && /[:\/\[\]@!#]/.test(step.target)) {
            const error = `Invalid selector detected: ${step.target}`;
            console.log(`\n   ❌ ERROR: ${error}`);
            selectorErrors.push(error);
            return false; // Reject the step
          }

          console.log(`   ✅ Selector format validated`);
        }

        return true; // Auto-approve
      },

      onStepExecuted: async (stepResult) => {
        const icon = stepResult.status === "passed" ? "✅" : "❌";
        console.log(`\n${icon} STEP EXECUTED:`);
        console.log(`   Action: ${stepResult.step.action}`);
        console.log(`   Status: ${stepResult.status.toUpperCase()}`);
        console.log(`   Duration: ${stepResult.duration}ms`);
        if (stepResult.error) {
          console.log(`   Error: ${stepResult.error}`);

          // Check if error is related to selector syntax
          if (stepResult.error.includes("not a valid selector")) {
            selectorErrors.push(stepResult.error);
          }
        }
      },

      onSnapshotCaptured: async (snapshot) => {
        snapshotCount++;
        console.log(`\n📸 SNAPSHOT ${snapshotCount} CAPTURED:`);
        console.log(`   URL: ${snapshot.url}`);
        console.log(`   Title: ${snapshot.title}`);
        console.log(`   Elements: ${snapshot.elements.length}`);

        // Show breakdown
        const buttons = snapshot.elements.filter(
          (el) => el.role === "button" || el.tag === "button"
        );
        const inputs = snapshot.elements.filter(
          (el) => el.tag === "input" || el.tag === "textarea"
        );
        const links = snapshot.elements.filter((el) => el.tag === "a");

        console.log(`   Breakdown:`);
        console.log(`     - Buttons: ${buttons.length}`);
        console.log(`     - Inputs: ${inputs.length}`);
        console.log(`     - Links: ${links.length}`);

        // Check for problematic selectors in snapshot
        const problematicSelectors = snapshot.elements.filter(
          (el) =>
            el.selector.startsWith(".") && /[:\/\[\]@!#]/.test(el.selector)
        );

        if (problematicSelectors.length > 0) {
          console.log(
            `\n   ⚠️  WARNING: ${problematicSelectors.length} elements have potentially problematic class selectors`
          );
          console.log(
            `   These should have been avoided by the selector generation logic!`
          );
        }
      },
    });

    console.log("\n" + "=".repeat(60));
    console.log("TEST RESULTS");
    console.log("=".repeat(60));
    console.log(`\nStatus: ${result.status.toUpperCase()}`);
    console.log(`\nIntentions Parsed: ${result.intentions.length}`);
    result.intentions.forEach((intention, i) => {
      console.log(`  ${i + 1}. "${intention}"`);
    });

    console.log(`\nSteps Generated: ${result.steps.length}`);
    result.steps.forEach((step, i) => {
      console.log(`  ${i + 1}. ${step.action}: ${step.target || "N/A"}`);
      if (step.value) {
        console.log(`     value="${step.value}"`);
      }
    });

    console.log(`\nExecution Results:`);
    console.log(
      `  ✅ Passed: ${
        result.results.filter((r) => r.status === "passed").length
      }`
    );
    console.log(
      `  ❌ Failed: ${
        result.results.filter((r) => r.status === "failed").length
      }`
    );
    console.log(
      `  ⏭️  Skipped: ${
        result.results.filter((r) => r.status === "skipped").length
      }`
    );

    // Check for selector errors
    console.log(`\n📊 Selector Validation:`);
    if (selectorErrors.length === 0) {
      console.log(`  ✅ No selector syntax errors detected!`);
    } else {
      console.log(`  ❌ ${selectorErrors.length} selector error(s):`);
      selectorErrors.forEach((err) => console.log(`     - ${err}`));
    }

    // Cleanup
    await testOrchestrator.closeSessionExecutor(sessionId);

    // Final verdict
    console.log("\n" + "=".repeat(60));
    if (selectorErrors.length === 0 && result.status === "completed") {
      console.log("✅ TEST PASSED!");
      console.log("   - No selector syntax errors");
      console.log("   - All steps executed successfully");
      console.log("   - Tailwind CSS classes handled correctly");
      console.log("=".repeat(60) + "\n");
      process.exit(0);
    } else if (selectorErrors.length === 0) {
      console.log("⚠️  TEST PARTIAL SUCCESS");
      console.log("   - No selector syntax errors (FIX VERIFIED)");
      console.log(`   - Status: ${result.status}`);
      console.log("=".repeat(60) + "\n");
      process.exit(0);
    } else {
      console.log("❌ TEST FAILED!");
      console.log(`   - ${selectorErrors.length} selector error(s) detected`);
      console.log("   - The fix did not work correctly");
      console.log("=".repeat(60) + "\n");
      process.exit(1);
    }
  } catch (error) {
    console.error("\n❌ FATAL ERROR:", error);
    if (error instanceof Error) {
      console.error("Stack:", error.stack);
    }

    // Check if error mentions selector syntax
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (errorMsg.includes("not a valid selector")) {
      console.error(
        "\n⚠️  This is a selector syntax error - the fix may not be working!"
      );
    }

    process.exit(1);
  }
}

// Run after a short delay to ensure services are initialized
setTimeout(() => {
  runEuropcarTest().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}, 2000);
