#!/usr/bin/env node

import AbletonLink from 'abletonlink';
import MidiService from './src/services/midiService.js';
import MidiScheduler from './src/services/midiScheduler.js';
import readline from 'readline';

console.log('🎵 Interactive Playback Speed Test\n');

// Initialize Ableton Link
const link = new AbletonLink();
link.bpm = 120;
link.quantum = 4;
link.enable();

// Initialize MIDI service
const midiService = new MidiService('Speed Test');
const connected = midiService.init();

if (!connected) {
  console.error('❌ Failed to initialize MIDI service');
  process.exit(1);
}

// Initialize scheduler
const scheduler = new MidiScheduler(midiService, link);

// Add a simple metronome pattern
console.log('📝 Adding metronome pattern (quarter notes)');
for (let bar = 0; bar < 2; bar++) {
  for (let beat = 0; beat < 4; beat++) {
    const note = beat === 0 ? 76 : 77; // High/low woodblock
    scheduler.addNote({
      beat,
      bar,
      note,
      velocity: beat === 0 ? 127 : 80,
      duration: 0.1
    });
  }
}

// Set up 2-bar loop
scheduler.setLoop(8, 0);

// Start Link update
link.startUpdate(60, () => {});

// Track stats
let lastBeat = 0;
setInterval(() => {
  const currentBeat = Math.floor(link.beat);
  if (currentBeat !== lastBeat) {
    lastBeat = currentBeat;
    const speed = scheduler.getPlaybackSpeed();
    const effectiveBpm = link.bpm * speed;
    
    // Clear line and update status
    process.stdout.write(`\r🎹 Beat: ${currentBeat} | Link BPM: ${link.bpm} | Speed: ${speed.toFixed(1)}x | Effective BPM: ${effectiveBpm.toFixed(1)} `);
  }
}, 50);

console.log('\n📋 Controls:');
console.log('  +/-  : Adjust speed by 0.1x');
console.log('  1    : Set speed to 0.5x (half)');
console.log('  2    : Set speed to 1.0x (normal)');
console.log('  3    : Set speed to 1.5x');
console.log('  4    : Set speed to 2.0x (double)');
console.log('  space: Start/Stop');
console.log('  q    : Quit\n');

// Setup keyboard input
readline.emitKeypressEvents(process.stdin);
if (process.stdin.setRawMode) {
  process.stdin.setRawMode(true);
}
process.stdin.resume();

let isRunning = false;

process.stdin.on('keypress', (str, key) => {
  if (key.ctrl && key.name === 'c') {
    cleanup();
  }
  
  switch (str) {
    case 'q':
      cleanup();
      break;
      
    case ' ':
      if (isRunning) {
        scheduler.stop();
        console.log('\n⏹ Stopped');
        isRunning = false;
      } else {
        scheduler.start();
        console.log('\n▶️ Started');
        isRunning = true;
      }
      break;
      
    case '+':
    case '=':
      {
        const newSpeed = Math.min(4.0, scheduler.getPlaybackSpeed() + 0.1);
        scheduler.setPlaybackSpeed(newSpeed);
        console.log(`\n⚡ Speed: ${newSpeed.toFixed(1)}x`);
      }
      break;
      
    case '-':
    case '_':
      {
        const newSpeed = Math.max(0.1, scheduler.getPlaybackSpeed() - 0.1);
        scheduler.setPlaybackSpeed(newSpeed);
        console.log(`\n⚡ Speed: ${newSpeed.toFixed(1)}x`);
      }
      break;
      
    case '1':
      scheduler.setPlaybackSpeed(0.5);
      console.log('\n⚡ Speed: 0.5x (half)');
      break;
      
    case '2':
      scheduler.setPlaybackSpeed(1.0);
      console.log('\n⚡ Speed: 1.0x (normal)');
      break;
      
    case '3':
      scheduler.setPlaybackSpeed(1.5);
      console.log('\n⚡ Speed: 1.5x');
      break;
      
    case '4':
      scheduler.setPlaybackSpeed(2.0);
      console.log('\n⚡ Speed: 2.0x (double)');
      break;
  }
});

function cleanup() {
  console.log('\n\n👋 Goodbye!');
  scheduler.destroy();
  midiService.close();
  link.stopUpdate();
  link.disable();
  process.exit(0);
}

console.log('\n🚀 Ready! Press space to start...\n');
