/**
 * WebSocket Test Script - Test human-in-loop approval workflow
 */
import { io } from 'socket.io-client';

const socket = io('http://localhost:3001', {
  transports: ['websocket', 'polling'],
});

socket.on('connect', () => {
  console.log('✅ Connected to WebSocket server');
  
  // Start a test session
  console.log('\n📤 Starting test session...');
  socket.emit('test:start', {
    scenario: 'Navigate to https://example.com and verify the heading',
    llmProvider: 'groq',
    humanInLoop: true,
    approvalTimeoutSeconds: 300,
  });
});

socket.on('session:created', (data: any) => {
  console.log('✅ Session created:', data.sessionId);
});

socket.on('session:status', (status: any) => {
  console.log('📊 Session status:', status.state);
});

socket.on('steps:generated', (data: any) => {
  console.log('✅ Steps generated:', data.steps.length, 'steps');
  console.log('Steps:', JSON.stringify(data.steps, null, 2));
});

socket.on('step:approval_request', (request: any) => {
  console.log('\n⏸️  Approval requested for step:', request.stepIndex + 1);
  console.log('Step:', JSON.stringify(request.step, null, 2));
  
  // Auto-approve after 2 seconds
  setTimeout(() => {
    console.log('✅ Auto-approving step', request.stepIndex + 1);
    socket.emit('step:approval', {
      sessionId: request.sessionId,
      stepIndex: request.stepIndex,
      approved: true,
    });
  }, 2000);
});

socket.on('step:execution_update', (update: any) => {
  console.log('📝 Step', update.stepIndex + 1, 'status:', update.status);
  if (update.result) {
    console.log('   Result:', update.result.status, '-', update.result.message || 'OK');
  }
});

socket.on('session:completed', (data: any) => {
  console.log('\n✅ Session completed!');
  console.log('Results:', data.results.length, 'steps executed');
  socket.close();
  process.exit(0);
});

socket.on('error', (error: any) => {
  console.error('❌ Error:', error);
  socket.close();
  process.exit(1);
});

socket.on('disconnect', () => {
  console.log('🔌 Disconnected from WebSocket server');
});

// Handle timeout
setTimeout(() => {
  console.log('⏱️  Test timeout - closing connection');
  socket.close();
  process.exit(1);
}, 60000); // 60 second timeout
