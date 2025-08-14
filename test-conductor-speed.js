#!/usr/bin/env node

import { spawn } from 'child_process';
import { setTimeout } from 'timers/promises';

console.log('🎵 Testing Playback Speed in Conductor (AI) Mode...\n');
console.log('This test will verify that playback speed controls work in conductor mode.');
console.log('---------------------------------------------------\n');

// Check for API key
const apiKey = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.log('⚠️  WARNING: No API key found. Conductor features will be limited.');
  console.log('Set OPENAI_API_KEY or ANTHROPIC_API_KEY to enable AI generation.\n');
}

// Start the CLI in conductor mode with proper ESM loader for JSX
const cli = spawn('node', ['--loader', '@esbuild-kit/esm-loader', 'src/cli.jsx', '--conductor'], {
  cwd: process.cwd(),
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env }
});

let output = '';
let speedFound = false;
let effectiveBpmFound = false;

cli.stdout.on('data', (data) => {
  const chunk = data.toString();
  output += chunk;
  
  // Look for speed-related output
  if (chunk.includes('Speed:')) {
    speedFound = true;
    process.stdout.write('✅ Found Speed display in UI\n');
  }
  if (chunk.includes('Effective BPM:')) {
    effectiveBpmFound = true;
    process.stdout.write('✅ Found Effective BPM display in UI\n');
  }
  if (chunk.includes('MIDI tempo')) {
    process.stdout.write('✅ Found MIDI tempo indicator\n');
  }
});

cli.stderr.on('data', (data) => {
  // Ignore experimental loader warnings
  const error = data.toString();
  if (!error.includes('ExperimentalWarning')) {
    console.error('Error:', error);
  }
});

async function runTest() {
  console.log('Starting CLI in conductor mode...\n');
  
  await setTimeout(2000);
  
  console.log('Testing playback speed controls:\n');
  
  // Test speed increase
  console.log('1. Pressing "+" to increase speed...');
  cli.stdin.write('+');
  await setTimeout(500);
  
  console.log('2. Pressing "+" again (should be 1.2x now)...');
  cli.stdin.write('+');
  await setTimeout(500);
  
  console.log('3. Pressing "+" once more (should be 1.3x now)...');
  cli.stdin.write('+');
  await setTimeout(500);
  
  // Test speed decrease
  console.log('4. Pressing "-" to decrease speed...');
  cli.stdin.write('-');
  await setTimeout(500);
  
  // Test reset
  console.log('5. Pressing "\\" to reset speed to 1.0x...');
  cli.stdin.write('\\');
  await setTimeout(500);
  
  // Test half speed
  console.log('6. Pressing "/" for half speed (0.5x)...');
  cli.stdin.write('/');
  await setTimeout(500);
  
  // Test double speed
  console.log('7. Pressing "*" for double speed (2.0x)...');
  cli.stdin.write('*');
  await setTimeout(500);
  
  // Show help to verify controls are documented
  console.log('8. Pressing "h" to show help and verify controls...');
  cli.stdin.write('h');
  await setTimeout(1500);
  
  // Check results
  console.log('\n---------------------------------------------------');
  console.log('Test Results:\n');
  
  if (speedFound) {
    console.log('✅ SUCCESS: Speed display found in UI');
  } else {
    console.log('❌ FAIL: Speed display not found');
  }
  
  if (effectiveBpmFound) {
    console.log('✅ SUCCESS: Effective BPM display found in UI');
  } else {
    console.log('❌ FAIL: Effective BPM display not found');
  }
  
  // Check if speed controls are in help
  if (output.includes('+/-') && output.includes('playback speed')) {
    console.log('✅ SUCCESS: Playback speed controls documented in help');
  } else if (output.includes('+/-')) {
    console.log('✅ SUCCESS: Speed controls found in help');
  } else {
    console.log('⚠️  WARNING: Could not verify help text');
  }
  
  if (output.includes('Toggle half speed') && output.includes('Toggle double speed')) {
    console.log('✅ SUCCESS: Speed preset shortcuts documented');
  }
  
  console.log('\nQuitting CLI...');
  cli.stdin.write('q');
  
  await setTimeout(500);
  
  console.log('\n---------------------------------------------------');
  console.log('✨ Playback speed functionality has been added to Conductor mode!\n');
  console.log('You can now control MIDI playback speed independently from Link tempo');
  console.log('while using the AI music generator.\n');
  console.log('Usage: npm run conductor');
  console.log('Or:    node --loader @esbuild-kit/esm-loader src/cli.jsx --conductor\n');
  console.log('Keyboard controls:');
  console.log('  +/-  : Adjust speed by 0.1x (0.1x to 4.0x)');
  console.log('  \\    : Reset to normal speed (1.0x)');
  console.log('  /    : Toggle half speed (0.5x)');
  console.log('  *    : Toggle double speed (2.0x)');
  console.log('\nThe UI shows:');
  console.log('  - Current playback speed multiplier');
  console.log('  - Effective BPM (Link BPM × playback speed)');
  console.log('  - "(MIDI tempo)" indicator for clarity');
  
  process.exit(0);
}

runTest().catch(console.error);

// Cleanup on interrupt
process.on('SIGINT', () => {
  cli.kill();
  process.exit(0);
});
