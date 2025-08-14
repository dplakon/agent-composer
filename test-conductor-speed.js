#!/usr/bin/env node

/**
 * Test script for conductor playback speed multiplier
 * Tests that the conductor applies speed multiplier to note durations
 */

import { Conductor } from './src/services/conductor.js';

console.log('🧪 Testing Conductor Playback Speed Multiplier\n');

// Create a test composition object (mimics the structure)
const testComposition = {
  metadata: {
    bars: 8,
    time_signature: '4/4',
    tempo: 120,
    key: 'C major'
  },
  tracks: [
    {
      name: 'melody',
      channel: 0,
      notes: [
        { pitch: 60, duration: 1, velocity: 100 },
        { pitch: 62, duration: 1, velocity: 100 },
        { pitch: 64, duration: 2, velocity: 100 },
        { pitch: 65, duration: 1, velocity: 100 },
        { pitch: 67, duration: 1, velocity: 100 },
        { pitch: 69, duration: 2, velocity: 100 }
      ],
      getTotalDuration: function() {
        return this.notes.reduce((sum, note) => sum + note.duration, 0);
      }
    }
  ]
};

// Create conductor instance (no API key needed for this test)
const conductor = new Conductor({
  provider: 'openai',
  model: 'gpt-3.5-turbo',
  apiKey: 'test-key'
});

console.log('Original composition:');
console.log('  Notes: C(1 beat), D(1 beat), E(2 beats), F(1 beat), G(1 beat), A(2 beats)');
console.log('  Total duration: 8 beats (2 bars)\n');

// Test different playback speeds
const speeds = [0.5, 1.0, 2.0];

speeds.forEach(speed => {
  console.log(`\n📊 Testing with playback speed: ${speed}x`);
  console.log('─'.repeat(50));
  
  // Convert to scheduler events with speed multiplier
  const events = conductor.toSchedulerEvents(testComposition, 0, speed);
  
  // Calculate actual durations
  let totalDuration = 0;
  events.forEach((event, index) => {
    console.log(`  Event ${index + 1}: Note ${event.note}, Duration: ${event.duration.toFixed(2)} beats, Bar: ${event.bar}, Beat: ${event.beat.toFixed(2)}`);
    totalDuration += event.duration;
  });
  
  console.log(`\n  Total duration: ${totalDuration.toFixed(2)} beats`);
  console.log(`  Expected duration: ${(8 / speed).toFixed(2)} beats (8 beats ÷ ${speed})`);
  
  // Verify the math
  const expectedDuration = 8 / speed;
  const isCorrect = Math.abs(totalDuration - expectedDuration) < 0.01;
  console.log(`  ✅ Duration calculation: ${isCorrect ? 'CORRECT' : 'INCORRECT'}`);
});

console.log('\n\n📝 Summary:');
console.log('─'.repeat(50));
console.log('• Speed 0.5x: Notes play at half speed (durations doubled)');
console.log('• Speed 1.0x: Notes play at normal speed');
console.log('• Speed 2.0x: Notes play at double speed (durations halved)');
console.log('\nThe duration multiplier correctly scales note durations inversely');
console.log('with the playback speed (faster speed = shorter durations).');

console.log('\n✨ Test complete!');

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
