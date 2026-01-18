/**
 * Test Script - Google Search Example
 * 
 * Tests the iterative flow with a real-world scenario:
 * "go to google.com and search ai test"
 * 
 * This should:
 * 1. Navigate to google.com FIRST
 * 2. Capture snapshot to see actual elements
 * 3. Generate search step using REAL selectors from snapshot
 * 4. Execute search
 * 5. No hallucinated locators!
 */

import { testOrchestrator } from './websocket/websocket-test-orchestrator.js';

async function runGoogleSearchTest() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║      Testing: Google Search with Real Locators            ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const scenario = 'go to google.com and search ai test';
  const sessionId = `google_test_${Date.now()}`;

  console.log(`Scenario: "${scenario}"\n`);
  console.log('Expected behavior:');
  console.log('  1. Navigate to google.com');
  console.log('  2. Capture snapshot (should see search input)');
  console.log('  3. Generate search step using ACTUAL selector from snapshot');
  console.log('  4. Execute search');
  console.log('  5. NO HALLUCINATED SELECTORS!\n');
  console.log('='.repeat(60) + '\n');

  let stepCount = 0;
  let snapshotCount = 0;

  try {
    const result = await testOrchestrator.runIterativeTest(scenario, {
      sessionId,
      llmProvider: 'groq',
      browser: 'chromium',
      headless: false, // Show browser to see what's happening
      
      onStepGenerated: async (step, snapshot) => {
        stepCount++;
        console.log(`\n✨ STEP ${stepCount} GENERATED:`);
        console.log(`   Action: ${step.action}`);
        console.log(`   Target: ${step.target || 'N/A'}`);
        console.log(`   Value: ${step.value || 'N/A'}`);
        console.log(`   Description: ${step.description || 'N/A'}`);
        
        if (snapshot) {
          console.log(`\n   📸 Page Context Available:`);
          console.log(`      URL: ${snapshot.url}`);
          console.log(`      Title: ${snapshot.title}`);
          console.log(`      Elements: ${snapshot.elements.length}`);
          
          // Check for search input
          const searchInputs = snapshot.elements.filter(el => 
            (el.tag === 'input' || el.tag === 'textarea') && 
            (el.attributes.type === 'text' || !el.attributes.type) &&
            (el.ariaLabel?.toLowerCase().includes('search') || 
             el.attributes.name?.toLowerCase().includes('search') ||
             el.attributes.id?.toLowerCase().includes('search'))
          );
          
          if (searchInputs.length > 0) {
            console.log(`\n      ✅ Found ${searchInputs.length} search input(s):`);
            searchInputs.slice(0, 3).forEach(input => {
              console.log(`         - Selector: ${input.selector}`);
              console.log(`           Name: ${input.attributes.name || 'N/A'}`);
              console.log(`           Label: ${input.ariaLabel || 'N/A'}`);
            });
          }
        } else {
          console.log(`\n   ⚠️  No page context (expected for navigation steps)`);
        }
        
        // Validate the step
        if (step.action === 'fill') {
          if (!snapshot) {
            console.log(`\n   ❌ ERROR: fill action generated WITHOUT page snapshot!`);
            console.log(`   This is a HALLUCINATION - the LLM made up a selector!`);
            return false; // Reject the step
          }
          
          // Check if the target selector exists in the snapshot
          const targetExists = snapshot.elements.some(el => el.selector === step.target);
          if (!targetExists) {
            console.log(`\n   ❌ ERROR: Selector "${step.target}" NOT found in snapshot!`);
            console.log(`   This is a HALLUCINATION - the LLM made up a selector!`);
            console.log(`\n   Available selectors for input elements:`);
            snapshot.elements
              .filter(el => el.tag === 'input' || el.tag === 'textarea')
              .slice(0, 5)
              .forEach(el => console.log(`      - ${el.selector}`));
            return false; // Reject the step
          }
          
          console.log(`   ✅ Selector validated - exists in page snapshot`);
        }
        
        return true; // Auto-approve
      },
      
      onStepExecuted: async (stepResult) => {
        const icon = stepResult.status === 'passed' ? '✅' : '❌';
        console.log(`\n${icon} STEP EXECUTED:`);
        console.log(`   Action: ${stepResult.step.action}`);
        console.log(`   Status: ${stepResult.status.toUpperCase()}`);
        console.log(`   Duration: ${stepResult.duration}ms`);
        if (stepResult.error) {
          console.log(`   Error: ${stepResult.error}`);
        }
      },
      
      onSnapshotCaptured: async (snapshot) => {
        snapshotCount++;
        console.log(`\n📸 SNAPSHOT ${snapshotCount} CAPTURED:`);
        console.log(`   URL: ${snapshot.url}`);
        console.log(`   Title: ${snapshot.title}`);
        console.log(`   Elements: ${snapshot.elements.length}`);
        
        // Show breakdown
        const buttons = snapshot.elements.filter(el => el.role === 'button' || el.tag === 'button');
        const inputs = snapshot.elements.filter(el => el.tag === 'input' || el.tag === 'textarea');
        const links = snapshot.elements.filter(el => el.tag === 'a');
        
        console.log(`   Breakdown:`);
        console.log(`     - Buttons: ${buttons.length}`);
        console.log(`     - Inputs: ${inputs.length}`);
        console.log(`     - Links: ${links.length}`);
        console.log(`     - Other: ${snapshot.elements.length - buttons.length - inputs.length - links.length}`);
      },
    });

    console.log('\n' + '='.repeat(60));
    console.log('TEST RESULTS');
    console.log('='.repeat(60));
    console.log(`\nStatus: ${result.status.toUpperCase()}`);
    console.log(`\nIntentions Parsed: ${result.intentions.length}`);
    result.intentions.forEach((intention, i) => {
      console.log(`  ${i + 1}. "${intention}"`);
    });
    
    console.log(`\nSteps Generated: ${result.steps.length}`);
    result.steps.forEach((step, i) => {
      console.log(`  ${i + 1}. ${step.action}: ${step.target || 'N/A'}`);
      if (step.value) {
        console.log(`     value="${step.value}"`);
      }
    });
    
    console.log(`\nExecution Results:`);
    console.log(`  ✅ Passed: ${result.results.filter(r => r.status === 'passed').length}`);
    console.log(`  ❌ Failed: ${result.results.filter(r => r.status === 'failed').length}`);
    console.log(`  ⏭️  Skipped: ${result.results.filter(r => r.status === 'skipped').length}`);
    
    // Detailed results
    console.log(`\nDetailed Results:`);
    result.results.forEach((r, i) => {
      const icon = r.status === 'passed' ? '✅' : r.status === 'failed' ? '❌' : '⏭️';
      console.log(`  ${icon} Step ${i + 1}: ${r.step.action} - ${r.status} (${r.duration}ms)`);
      if (r.error) {
        console.log(`     Error: ${r.error}`);
      }
    });
    
    // Cleanup
    await testOrchestrator.closeSessionExecutor(sessionId);
    
    // Final verdict
    console.log('\n' + '='.repeat(60));
    if (result.status === 'completed' && result.results.every(r => r.status === 'passed')) {
      console.log('✅ TEST PASSED!');
      console.log('   - All steps executed successfully');
      console.log('   - No hallucinated locators');
      console.log('   - Snapshots captured correctly');
      console.log('='.repeat(60) + '\n');
      process.exit(0);
    } else {
      console.log('❌ TEST FAILED!');
      if (result.status !== 'completed') {
        console.log(`   - Status: ${result.status}`);
      }
      const failedSteps = result.results.filter(r => r.status === 'failed');
      if (failedSteps.length > 0) {
        console.log(`   - ${failedSteps.length} step(s) failed`);
      }
      console.log('='.repeat(60) + '\n');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ FATAL ERROR:', error);
    if (error instanceof Error) {
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
}

// Run after a short delay to ensure services are initialized
setTimeout(() => {
  runGoogleSearchTest().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}, 2000);
