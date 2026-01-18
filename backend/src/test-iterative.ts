/**
 * Iterative Test Flow - End-to-End Test
 * 
 * Tests the page-aware iterative test generation flow with real scenarios
 */

import { testOrchestrator } from './websocket/websocket-test-orchestrator.js';
import { TestStep, TestStepResult, PageSnapshot } from './types/index.js';

// ============================================
// Test Scenarios
// ============================================

const scenarios = [
  {
    name: 'Simple Navigation and Verification',
    scenario: 'Navigate to https://example.com and verify the heading',
    expectedIntentions: 2,
  },
  {
    name: 'Form Interaction',
    scenario: 'Go to https://httpbin.org/forms/post and fill in the customer name field with "John Doe"',
    expectedIntentions: 3,
  },
  {
    name: 'Multi-Step Login Flow',
    scenario: 'Navigate to https://the-internet.herokuapp.com/login, enter username "tomsmith", password "SuperSecretPassword!", and click login',
    expectedIntentions: 5,
  },
];

// ============================================
// Test Runner
// ============================================

async function runIterativeTests() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║        Iterative Test Generation - E2E Test Suite         ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const results: {
    scenario: string;
    passed: boolean;
    duration: number;
    error?: string;
    details?: any;
  }[] = [];

  for (const testCase of scenarios) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`TEST: ${testCase.name}`);
    console.log(`${'='.repeat(60)}`);
    console.log(`Scenario: ${testCase.scenario}\n`);

    const startTime = Date.now();

    try {
      const sessionId = `test_${Date.now()}`;
      
      // Track captured snapshots
      const capturedSnapshots: PageSnapshot[] = [];
      const generatedSteps: TestStep[] = [];
      const stepResults: TestStepResult[] = [];

      // Run iterative test with callbacks
      const result = await testOrchestrator.runIterativeTest(testCase.scenario, {
        sessionId,
        llmProvider: 'groq', // Use Groq for faster testing
        browser: 'chromium',
        headless: true, // Use headless for automated testing
        
        // Callback for step generation
        onStepGenerated: async (step: TestStep, snapshot?: PageSnapshot) => {
          console.log(`\n  ✓ Step Generated: ${step.action} ${step.target || ''}`);
          if (step.description) {
            console.log(`    Description: ${step.description}`);
          }
          if (snapshot) {
            console.log(`    Snapshot: ${snapshot.elements.length} elements available`);
            console.log(`    Page: ${snapshot.title} (${snapshot.url})`);
          }
          generatedSteps.push(step);
          // Auto-approve all steps in automated test
          return true;
        },
        
        // Callback for step execution
        onStepExecuted: async (stepResult: TestStepResult) => {
          const status = stepResult.status === 'passed' ? '✓' : '✗';
          console.log(`  ${status} Step Executed: ${stepResult.step.action} - ${stepResult.status}`);
          if (stepResult.error) {
            console.log(`    Error: ${stepResult.error}`);
          }
          console.log(`    Duration: ${stepResult.duration}ms`);
          stepResults.push(stepResult);
        },
        
        // Callback for snapshot capture
        onSnapshotCaptured: async (snapshot: PageSnapshot) => {
          console.log(`\n  📸 Snapshot Captured:`);
          console.log(`     URL: ${snapshot.url}`);
          console.log(`     Title: ${snapshot.title}`);
          console.log(`     Elements: ${snapshot.elements.length}`);
          
          // Show top interactive elements
          const buttons = snapshot.elements.filter(el => 
            el.role === 'button' || el.tag === 'button'
          );
          const inputs = snapshot.elements.filter(el => 
            el.tag === 'input' && !['submit', 'button'].includes(el.attributes.type || '')
          );
          
          if (buttons.length > 0) {
            console.log(`     Buttons: ${buttons.length} (e.g., ${buttons[0]?.selector})`);
          }
          if (inputs.length > 0) {
            console.log(`     Inputs: ${inputs.length} (e.g., ${inputs[0]?.selector})`);
          }
          
          capturedSnapshots.push(snapshot);
        },
      });

      const duration = Date.now() - startTime;

      // Verify results
      const passed = result.status === 'completed' && 
                     result.results.every(r => r.status === 'passed');

      console.log(`\n${'─'.repeat(60)}`);
      console.log(`RESULT: ${passed ? '✅ PASSED' : '❌ FAILED'}`);
      console.log(`Duration: ${duration}ms`);
      console.log(`Status: ${result.status}`);
      console.log(`Intentions: ${result.intentions.length} (expected ~${testCase.expectedIntentions})`);
      console.log(`Steps Generated: ${result.steps.length}`);
      console.log(`Snapshots Captured: ${capturedSnapshots.length}`);
      console.log(`Steps Executed: ${result.results.length}`);
      console.log(`Passed: ${result.results.filter(r => r.status === 'passed').length}`);
      console.log(`Failed: ${result.results.filter(r => r.status === 'failed').length}`);

      // Display intentions
      if (result.intentions.length > 0) {
        console.log(`\nIntentions:`);
        result.intentions.forEach((intention, i) => {
          console.log(`  ${i + 1}. ${intention}`);
        });
      }

      // Close session executor
      await testOrchestrator.closeSessionExecutor(sessionId);

      results.push({
        scenario: testCase.name,
        passed,
        duration,
        details: {
          status: result.status,
          intentions: result.intentions.length,
          stepsGenerated: result.steps.length,
          snapshotsCaptured: capturedSnapshots.length,
          stepsExecuted: result.results.length,
          stepsPassed: result.results.filter(r => r.status === 'passed').length,
        },
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      console.log(`\n${'─'.repeat(60)}`);
      console.log(`RESULT: ❌ FAILED`);
      console.log(`Error: ${errorMessage}`);
      console.log(`Duration: ${duration}ms`);
      
      results.push({
        scenario: testCase.name,
        passed: false,
        duration,
        error: errorMessage,
      });
    }
  }

  // Print summary
  console.log(`\n\n${'='.repeat(60)}`);
  console.log('TEST SUMMARY');
  console.log(`${'='.repeat(60)}\n`);

  const totalPassed = results.filter(r => r.passed).length;
  const totalFailed = results.filter(r => !r.passed).length;

  results.forEach((result, i) => {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${i + 1}. ${status} - ${result.scenario} (${result.duration}ms)`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
    if (result.details) {
      console.log(`   Intentions: ${result.details.intentions}, Steps: ${result.details.stepsGenerated}, Snapshots: ${result.details.snapshotsCaptured}`);
    }
  });

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`Total: ${results.length} tests`);
  console.log(`Passed: ${totalPassed} (${Math.round(totalPassed / results.length * 100)}%)`);
  console.log(`Failed: ${totalFailed} (${Math.round(totalFailed / results.length * 100)}%)`);
  console.log(`${'─'.repeat(60)}\n`);

  // Exit with appropriate code
  process.exit(totalFailed === 0 ? 0 : 1);
}

// ============================================
// Run Tests
// ============================================

console.log('Starting iterative test flow E2E tests...\n');

// Add delay to ensure LLM providers are initialized
setTimeout(() => {
  runIterativeTests().catch((error) => {
    console.error('Fatal error running tests:', error);
    process.exit(1);
  });
}, 2000);
