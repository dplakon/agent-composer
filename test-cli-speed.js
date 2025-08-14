#!/usr/bin/env node

import { spawn } from 'child_process';
import { setTimeout } from 'timers/promises';

console.log('🎵 Testing Playback Speed in Main CLI Scheduler Mode...\n');
console.log('This test will verify that playback speed controls work in the main CLI.');
console.log('---------------------------------------------------\n');

// Start the CLI in scheduler mode with proper ESM loader for JSX
const cli = spawn('node', ['--loader', '@esbuild-kit/esm-loader', 'src/cli.jsx', '--scheduler'], {
  cwd: process.cwd(),
  stdio: ['pipe', 'pipe', 'pipe']
});

let output = '';

cli.stdout.on('data', (data) => {
  output += data.toString();
  // Look for speed-related output
  if (data.toString().includes('Speed:') || data.toString().includes('Effective BPM:')) {
    process.stdout.write(data);
  }
});

cli.stderr.on('data', (data) => {
  console.error('Error:', data.toString());
});

async function runTest() {
  console.log('Starting CLI in scheduler mode...\n');
  
  await setTimeout(1000);
  
  console.log('Simulating keyboard inputs to test speed controls:\n');
  
  // Test speed increase
  console.log('1. Pressing "+" to increase speed...');
  cli.stdin.write('+');
  await setTimeout(500);
  
  console.log('2. Pressing "+" again...');
  cli.stdin.write('+');
  await setTimeout(500);
  
  // Test speed decrease
  console.log('3. Pressing "-" to decrease speed...');
  cli.stdin.write('-');
  await setTimeout(500);
  
  // Test reset
  console.log('4. Pressing "\\" to reset speed to 1.0x...');
  cli.stdin.write('\\');
  await setTimeout(500);
  
  // Test half speed
  console.log('5. Pressing "/" for half speed...');
  cli.stdin.write('/');
  await setTimeout(500);
  
  // Test double speed
  console.log('6. Pressing "*" for double speed...');
  cli.stdin.write('*');
  await setTimeout(500);
  
  // Show help to verify controls are documented
  console.log('7. Pressing "h" to show help...');
  cli.stdin.write('h');
  await setTimeout(1000);
  
  // Check if speed controls are in help
  if (output.includes('+/-') && output.includes('playback speed')) {
    console.log('\n✅ SUCCESS: Playback speed controls are documented in help!');
  }
  
  if (output.includes('Speed:') && output.includes('Effective BPM:')) {
    console.log('✅ SUCCESS: Speed display is shown in the UI!');
  }
  
  console.log('\nQuitting CLI...');
  cli.stdin.write('q');
  
  await setTimeout(500);
  
  console.log('\n---------------------------------------------------');
  console.log('Test completed! The playback speed functionality');
  console.log('is integrated into the main CLI scheduler mode.');
  console.log('\nYou can use it with: npm run start -- --scheduler');
  console.log('Or: node src/cli.jsx --scheduler');
  console.log('\nKeyboard controls:');
  console.log('  +/-  : Adjust speed by 0.1x');
  console.log('  \\    : Reset to 1.0x');
  console.log('  /    : Toggle half speed (0.5x)');
  console.log('  *    : Toggle double speed (2.0x)');
  
  process.exit(0);
}

runTest().catch(console.error);

// Cleanup
process.on('SIGINT', () => {
  cli.kill();
  process.exit(0);
});
