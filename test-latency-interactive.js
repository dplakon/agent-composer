#!/usr/bin/env node

/**
 * Interactive latency test - allows real-time adjustment to verify the fix
 */

import MidiService from './src/services/midiService.js';
import MidiScheduler from './src/services/midiScheduler.js';
import AbletonLink from 'abletonlink';
import readline from 'readline';

console.log('🎹 Interactive Latency Compensation Test\n');

// Initialize services
const midi = new MidiService('Interactive Latency Test');
const connected = midi.init();

if (!connected) {
  console.error('❌ Failed to create virtual MIDI port');
  process.exit(1);
}

console.log('✅ Virtual MIDI port created: "Interactive Latency Test"');

// Create Link instance
const link = new AbletonLink();
link.enable();
link.bpm = 120;
link.quantum = 4;

console.log('✅ Ableton Link enabled');
console.log(`   BPM: ${link.bpm}, Quantum: ${link.quantum}\n`);

// Create scheduler
const scheduler = new MidiScheduler(midi, link);

// Setup keyboard input
readline.emitKeypressEvents(process.stdin);
process.stdin.setRawMode(true);

let currentLatency = 0;

// Add a simple metronome pattern
const addMetronome = () => {
  scheduler.clear();
  
  // Add click on every beat for 8 bars
  for (let bar = 0; bar < 8; bar++) {
    for (let beat = 0; beat < 4; beat++) {
      scheduler.addNote({
        bar: bar,
        beat: beat,
        note: beat === 0 ? 76 : 77, // High note on downbeat, mid note on others
        duration: 0.1,
        velocity: beat === 0 ? 127 : 100,
        channel: 9 // Drum channel
      });
    }
  }
  
  scheduler.setLoop(32, 0); // 8-bar loop
};

// Display current status
const displayStatus = () => {
  console.clear();
  console.log('🎹 Interactive Latency Compensation Test');
  console.log('=========================================\n');
  console.log(`Current Latency: ${currentLatency}ms`);
  console.log(`Effective BPM: ${link.bpm}`);
  console.log(`Beat: ${Math.floor(link.beat)}`);
  console.log(`Scheduler Running: ${scheduler.isRunning ? '✅' : '❌'}`);
  console.log('\n📊 Timing Info:');
  console.log(`Lookahead: ${scheduler.lookaheadTime}ms`);
  console.log(`Schedule Interval: ${scheduler.scheduleInterval}ms`);
  
  if (currentLatency < 0) {
    console.log(`\n⚡ Predictive mode: Notes fire ${Math.abs(currentLatency)}ms EARLY`);
  } else if (currentLatency > 0) {
    console.log(`\n⏱ Delayed mode: Notes fire ${currentLatency}ms LATE`);
  } else {
    console.log(`\n🎯 No compensation: Notes fire at scheduled time`);
  }
  
  console.log('\n🎮 Controls:');
  console.log('  ←/→     : Adjust by ±1ms');
  console.log('  ↑/↓     : Adjust by ±10ms');
  console.log('  [/]     : Adjust by ±5ms');
  console.log('  -/+     : Adjust by ±50ms');
  console.log('  0       : Reset to 0ms');
  console.log('  Space   : Start/Stop');
  console.log('  R       : Reload pattern');
  console.log('  Q       : Quit');
  console.log('\n💡 Try extreme values like -200 or -300 to test the fix!');
};

// Keyboard handler
process.stdin.on('keypress', (str, key) => {
  if (key.ctrl && key.name === 'c') {
    cleanup();
    return;
  }
  
  switch(key.name) {
    case 'left':
      currentLatency -= 1;
      scheduler.setLatencyCompensation(currentLatency);
      break;
    case 'right':
      currentLatency += 1;
      scheduler.setLatencyCompensation(currentLatency);
      break;
    case 'up':
      currentLatency += 10;
      scheduler.setLatencyCompensation(currentLatency);
      break;
    case 'down':
      currentLatency -= 10;
      scheduler.setLatencyCompensation(currentLatency);
      break;
    case '[':
      currentLatency -= 5;
      scheduler.setLatencyCompensation(currentLatency);
      break;
    case ']':
      currentLatency += 5;
      scheduler.setLatencyCompensation(currentLatency);
      break;
    case '-':
      currentLatency -= 50;
      scheduler.setLatencyCompensation(currentLatency);
      break;
    case '+':
    case '=':
      currentLatency += 50;
      scheduler.setLatencyCompensation(currentLatency);
      break;
    case '0':
      currentLatency = 0;
      scheduler.setLatencyCompensation(currentLatency);
      break;
    case 'space':
      if (scheduler.isRunning) {
        scheduler.stop();
      } else {
        scheduler.start();
      }
      break;
    case 'r':
      addMetronome();
      console.log('\n✅ Pattern reloaded');
      setTimeout(displayStatus, 500);
      return;
    case 'q':
      cleanup();
      return;
  }
  
  // Get actual value after clamping
  currentLatency = scheduler.getLatencyCompensation();
  displayStatus();
});

// Start Link update
link.startUpdate(60, () => {});

// Initialize
addMetronome();
scheduler.start();
displayStatus();

// Update display periodically
setInterval(displayStatus, 1000);

// Cleanup
const cleanup = () => {
  console.clear();
  console.log('🛑 Stopping...');
  scheduler.stop();
  scheduler.destroy();
  link.stopUpdate();
  link.disable();
  midi.close();
  process.stdin.setRawMode(false);
  console.log('✅ Test complete');
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

console.log('\n🎵 Use arrow keys to adjust latency and listen to the metronome');
console.log('💡 Open a DAW with a click track to compare timing!');
