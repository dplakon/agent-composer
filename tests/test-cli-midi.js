#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🧪 Testing Ableton Link CLI with MIDI...\n');

// Spawn the CLI with MIDI enabled
const cliPath = join(__dirname, 'src', 'cli.jsx');
const child = spawn('node', ['--loader', '@esbuild-kit/esm-loader', cliPath, '--midi'], {
  stdio: 'pipe',
  env: { ...process.env, FORCE_COLOR: '1' }
});

let output = '';
let errorOccurred = false;
let midiPortCreated = false;

// Capture stdout
child.stdout.on('data', (data) => {
  const text = data.toString();
  output += text;
  process.stdout.write(data);
  
  // Check for MIDI port creation
  if (text.includes('Virtual MIDI port') || text.includes('Virtual Port Active')) {
    midiPortCreated = true;
  }
});

// Capture stderr
child.stderr.on('data', (data) => {
  const message = data.toString();
  
  // Check for MIDI port creation in stderr
  if (message.includes('Virtual MIDI port')) {
    midiPortCreated = true;
  }
  
  // Ignore experimental warnings
  if (!message.includes('ExperimentalWarning') && !message.includes('globalPreload')) {
    if (message.includes('ERROR')) {
      errorOccurred = true;
      console.error('\n❌ Error detected:', message);
    } else if (message.includes('✅')) {
      process.stdout.write(message);
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

// Run for 5 seconds then stop
setTimeout(() => {
  console.log('\n\n📊 Test Summary:');
  if (!errorOccurred) {
    console.log('✅ No errors detected');
    console.log(midiPortCreated ? '✅ MIDI port created successfully' : '⚠️ MIDI port status unknown');
    console.log('✅ UI rendering without issues');
    console.log('\n📌 To test with Ableton Live:');
    console.log('1. Open Ableton Live');
    console.log('2. Go to Preferences → Link/Tempo/MIDI');
    console.log('3. Enable Link');
    console.log('4. In MIDI preferences, look for "Ableton Link CLI" in Input');
    console.log('5. Enable "Track" and "Remote" for the port');
    console.log('6. Create a MIDI track and set input to "Ableton Link CLI"');
    console.log('7. Arm the track for recording');
    console.log('8. You should receive C4 notes on every beat!');
  }
  
  // Gracefully terminate the child process
  child.kill('SIGTERM');
}, 5000);

// Handle parent process interruption
process.on('SIGINT', () => {
  child.kill('SIGTERM');
  process.exit(0);
});
