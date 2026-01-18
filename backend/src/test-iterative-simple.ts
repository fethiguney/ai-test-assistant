/**
 * Simple Iterative Test - Demonstrates working functionality
 */

import { testOrchestrator } from './websocket/websocket-test-orchestrator.js';

async function runSimpleTest() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║      Iterative Test Flow - Simple Demo                    ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const scenario = 'Navigate to https://example.com and verify the page title is "Example Domain"';
  const sessionId = `demo_${Date.now()}`;

  console.log(`Scenario: ${scenario}\n`);
  console.log('Running iterative test with page-aware generation...\n');

  try {
    const result = await testOrchestrator.runIterativeTest(scenario, {
      sessionId,
      llmProvider: 'groq',
      browser: 'chromium',
      headless: true,
      
      onStepGenerated: async (step, snapshot) => {
        console.log(`\n✓ Generated Step:`);
        console.log(`  Action: ${step.action}`);
        console.log(`  Target: ${step.target || 'N/A'}`);
        console.log(`  Value: ${step.value || 'N/A'}`);
        console.log(`  Description: ${step.description || 'N/A'}`);
        
        if (snapshot) {
          console.log(`\n  📸 Page Context:`);
          console.log(`     URL: ${snapshot.url}`);
          console.log(`     Title: ${snapshot.title}`);
          console.log(`     Elements Available: ${snapshot.elements.length}`);
        }
        
        return true; // Auto-approve
      },
      
      onStepExecuted: async (stepResult) => {
        const icon = stepResult.status === 'passed' ? '✅' : '❌';
        console.log(`\n${icon} Executed: ${stepResult.step.action} - ${stepResult.status.toUpperCase()}`);
        console.log(`   Duration: ${stepResult.duration}ms`);
        if (stepResult.error) {
          console.log(`   Error: ${stepResult.error}`);
        }
      },
      
      onSnapshotCaptured: async (snapshot) => {
        console.log(`\n📸 Snapshot Captured:`);
        console.log(`   URL: ${snapshot.url}`);
        console.log(`   Title: ${snapshot.title}`);
        console.log(`   Elements: ${snapshot.elements.length}`);
        
        // Show sample elements
        const buttons = snapshot.elements.filter(el => el.role === 'button' || el.tag === 'button');
        const inputs = snapshot.elements.filter(el => el.tag === 'input');
        const links = snapshot.elements.filter(el => el.tag === 'a');
        
        if (buttons.length > 0) console.log(`   - Buttons: ${buttons.length}`);
        if (inputs.length > 0) console.log(`   - Inputs: ${inputs.length}`);
        if (links.length > 0) console.log(`   - Links: ${links.length}`);
      },
    });

    console.log('\n' + '='.repeat(60));
    console.log('TEST RESULT');
    console.log('='.repeat(60));
    console.log(`Status: ${result.status.toUpperCase()}`);
    console.log(`Intentions: ${result.intentions.length}`);
    result.intentions.forEach((intention, i) => {
      console.log(`  ${i + 1}. ${intention}`);
    });
    console.log(`\nSteps Generated: ${result.steps.length}`);
    result.steps.forEach((step, i) => {
      console.log(`  ${i + 1}. ${step.action} ${step.target || ''}`);
    });
    console.log(`\nExecution Results:`);
    console.log(`  Passed: ${result.results.filter(r => r.status === 'passed').length}`);
    console.log(`  Failed: ${result.results.filter(r => r.status === 'failed').length}`);
    
    // Cleanup
    await testOrchestrator.closeSessionExecutor(sessionId);
    
    if (result.status === 'completed') {
      console.log('\n✅ TEST PASSED - Iterative flow working correctly!\n');
      process.exit(0);
    } else {
      console.log('\n❌ TEST FAILED\n');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ ERROR:', error);
    process.exit(1);
  }
}

// Run after a short delay to ensure services are initialized
setTimeout(() => {
  runSimpleTest().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}, 2000);
