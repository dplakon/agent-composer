#!/usr/bin/env node

// Test script for MIDI latency compensation
import MidiService from './src/services/midiService.js';
import AbletonLink from 'abletonlink';
import readline from 'readline';

console.log('🎹 Testing MIDI Latency Compensation\n');
console.log('This tool helps you find the right latency compensation value.\n');

// Setup readline for interactive controls
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Enable raw mode for single key press detection
process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.setEncoding('utf8');

// Create MIDI service
const midi = new MidiService('Link Latency Test');
const connected = midi.init();

if (!connected) {
  console.error('❌ Failed to create virtual MIDI port');
  process.exit(1);
}

console.log('✅ Virtual MIDI port created: "Link Latency Test"');

// Create Link instance
const link = new AbletonLink();
link.enable();
link.bpm = 120;
link.quantum = 4;

let lastBeat = -1;
let noteCount = 0;
let currentLatency = 0;

console.log('\n📊 Controls:');
console.log('  [/]       Adjust latency by ±1ms');
console.log('  {/}       Adjust latency by ±10ms (Shift + [/])');
console.log('  0         Reset latency to 0ms');
console.log('  Space     Toggle playback');
console.log('  Q         Quit\n');

console.log('Starting Link sync...\n');

// Display function
function updateDisplay() {
  process.stdout.write(
    `\rBPM: ${link.bpm.toFixed(1)} | ` +
    `Latency: ${currentLatency > 0 ? '+' : ''}${currentLatency}ms | ` +
    `Notes: ${noteCount} | ` +
    `Status: ${link.isPlaying ? '▶ Playing' : '■ Stopped'} | ` +
    `Peers: ${link.numPeers}`
  );
}

// Start update loop
link.startUpdate(60, (beat, phase, bpm) => {
  const currentBeat = Math.floor(beat);
  
  // Send note on each beat
  if (currentBeat !== lastBeat) {
    lastBeat = currentBeat;
    
    // Calculate timing for latency compensation
    const beatFraction = beat - currentBeat;
    
    if (currentLatency < 0) {
      // Negative latency: schedule note early
      const msUntilNextBeat = ((1 - beatFraction) * 60000) / bpm;
      const scheduleMs = msUntilNextBeat + currentLatency;
      
      if (scheduleMs > 0) {
        setTimeout(() => {
          midi.sendNote(60, 50, 127); // Short, loud click
          noteCount++;
        }, scheduleMs);
      } else {
        midi.sendNote(60, 50, 127);
        noteCount++;
      }
    } else {
      // Positive latency: delay the note
      setTimeout(() => {
        midi.sendNote(60, 50, 127);
        noteCount++;
      }, currentLatency);
    }
    
    updateDisplay();
  }
});

// Handle keyboard input
process.stdin.on('data', (key) => {
  switch(key) {
    case '[':
      currentLatency = Math.max(-100, currentLatency - 1);
      midi.setLatencyCompensation(currentLatency);
      console.log(`\n⚡ Latency: ${currentLatency}ms (notes will play ${Math.abs(currentLatency)}ms ${currentLatency < 0 ? 'earlier' : 'later'})`);
      break;
      
    case ']':
      currentLatency = Math.min(100, currentLatency + 1);
      midi.setLatencyCompensation(currentLatency);
      console.log(`\n⚡ Latency: ${currentLatency}ms (notes will play ${Math.abs(currentLatency)}ms ${currentLatency < 0 ? 'earlier' : 'later'})`);
      break;
      
    case '{':
      currentLatency = Math.max(-100, currentLatency - 10);
      midi.setLatencyCompensation(currentLatency);
      console.log(`\n⚡ Latency: ${currentLatency}ms (notes will play ${Math.abs(currentLatency)}ms ${currentLatency < 0 ? 'earlier' : 'later'})`);
      break;
      
    case '}':
      currentLatency = Math.min(100, currentLatency + 10);
      midi.setLatencyCompensation(currentLatency);
      console.log(`\n⚡ Latency: ${currentLatency}ms (notes will play ${Math.abs(currentLatency)}ms ${currentLatency < 0 ? 'earlier' : 'later'})`);
      break;
      
    case '0':
      currentLatency = 0;
      midi.setLatencyCompensation(0);
      console.log('\n🔄 Latency reset to 0ms');
      break;
      
    case ' ':
      link.isPlaying = !link.isPlaying;
      console.log(`\n${link.isPlaying ? '▶ Playing' : '■ Stopped'}`);
      break;
      
    case 'q':
    case 'Q':
    case '\u0003': // Ctrl+C
      cleanup();
      break;
  }
  
  updateDisplay();
});

// Handle cleanup
const cleanup = () => {
  console.log('\n\n🛑 Stopping...');
  link.stopUpdate();
  link.disable();
  midi.close();
  console.log('✅ MIDI port closed');
  console.log(`📊 Total notes sent: ${noteCount}`);
  console.log(`💡 Final latency setting: ${currentLatency}ms`);
  
  if (currentLatency !== 0) {
    console.log(`\n📌 To use this latency setting, run:`);
    console.log(`   ableton-link-cli --midi --latency ${currentLatency}`);
  }
  
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

updateDisplay();
