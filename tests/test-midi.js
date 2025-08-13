#!/usr/bin/env node

// Test script for MIDI functionality
import MidiService from './src/services/midiService.js';
import AbletonLink from 'abletonlink';

console.log('🎹 Testing MIDI functionality...\n');

// Create MIDI service
const midi = new MidiService('Ableton Link CLI Test');
const connected = midi.init();

if (!connected) {
  console.error('❌ Failed to create virtual MIDI port');
  process.exit(1);
}

console.log('✅ Virtual MIDI port created successfully');
console.log('📌 Port name: "Ableton Link CLI Test"');
console.log('\n🎵 Open Ableton Live and look for this port in MIDI preferences\n');

// Create Link instance
const link = new AbletonLink();
link.enable();
link.bpm = 120;
link.quantum = 4;

console.log('Starting to send MIDI notes on quarter beats...');
console.log('Press Ctrl+C to stop\n');

let lastBeat = -1;
let noteCount = 0;

// Start update loop
link.startUpdate(60, (beat, phase, bpm) => {
  const currentBeat = Math.floor(beat);
  
  // Send note on each beat (quarter note)
  if (currentBeat !== lastBeat) {
    lastBeat = currentBeat;
    
    // Send C4 note
    midi.sendNote(60, 100, 100);
    noteCount++;
    
    // Show progress
    process.stdout.write(`\rBeat: ${currentBeat} | Notes sent: ${noteCount} | BPM: ${bpm.toFixed(1)}`);
  }
});

// Handle cleanup
const cleanup = () => {
  console.log('\n\n🛑 Stopping...');
  link.stopUpdate();
  link.disable();
  midi.close();
  console.log('✅ MIDI port closed');
  console.log(`📊 Total notes sent: ${noteCount}`);
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
