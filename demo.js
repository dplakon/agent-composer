#!/usr/bin/env node

// Demo script that creates a second Link instance to simulate a peer
import AbletonLink from 'abletonlink';

console.log('🎵 Starting Ableton Link Demo Peer...\n');
console.log('This will create a Link session that the CLI can connect to.\n');

const link = new AbletonLink();

// Enable Link
link.enable();
link.enablePlayStateSync();

// Set initial values
link.bpm = 128;
link.quantum = 4;
link.isPlaying = true;

console.log('Demo peer started with:');
console.log(`  BPM: ${link.bpm}`);
console.log(`  Quantum: ${link.quantum}`);
console.log(`  Playing: ${link.isPlaying ? 'Yes' : 'No'}\n`);

// Update loop to show we're running
let beat = 0;
link.startUpdate(60, (currentBeat) => {
  const newBeat = Math.floor(currentBeat);
  if (newBeat !== beat) {
    beat = newBeat;
    process.stdout.write(`\rBeat: ${beat} | Peers: ${link.numPeers} | BPM: ${link.bpm.toFixed(1)}`);
  }
});

console.log('Demo peer is running. Start the CLI in another terminal to connect.');
console.log('Press Ctrl+C to stop.\n');

// Handle cleanup
const cleanup = () => {
  console.log('\n\nStopping demo peer...');
  link.stopUpdate();
  link.disable();
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
