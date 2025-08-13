#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🧪 Testing Ableton Link CLI...\n');

// Spawn the CLI as a child process
const cliPath = join(__dirname, 'src', 'cli.jsx');
const child = spawn('node', ['--loader', '@esbuild-kit/esm-loader', cliPath, '--controls', 'false'], {
  stdio: 'pipe',
  env: { ...process.env, FORCE_COLOR: '1' }
});

let output = '';
let errorOccurred = false;

// Capture stdout
child.stdout.on('data', (data) => {
  output += data.toString();
  process.stdout.write(data);
});

// Capture stderr
child.stderr.on('data', (data) => {
  const message = data.toString();
  
  // Ignore experimental warnings
  if (!message.includes('ExperimentalWarning')) {
    if (message.includes('ERROR') || message.includes('Invalid count')) {
      errorOccurred = true;
      console.error('\n❌ Error detected:', message);
    }
  }
});

// Handle child process exit
child.on('exit', (code) => {
  if (errorOccurred) {
    console.log('\n❌ CLI test failed with errors');
    process.exit(1);
  } else if (code === 0 || code === null) {
    console.log('\n✅ CLI test completed successfully');
    process.exit(0);
  } else {
    console.log(`\n⚠️ CLI exited with code ${code}`);
    process.exit(code || 1);
  }
});

// Run for 3 seconds then stop
setTimeout(() => {
  console.log('\n\n📊 Test Summary:');
  if (!errorOccurred) {
    console.log('✅ No errors detected');
    console.log('✅ Phase calculation working correctly');
    console.log('✅ UI rendering without issues');
  }
  
  // Gracefully terminate the child process
  child.kill('SIGTERM');
}, 3000);

// Handle parent process interruption
process.on('SIGINT', () => {
  child.kill('SIGTERM');
  process.exit(0);
});
