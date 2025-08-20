#!/usr/bin/env node

/**
 * Test script to verify extended latency compensation range
 * Tests both negative (predictive) and positive (delayed) compensation
 */

import MidiService from './src/services/midiService.js';
import MidiScheduler from './src/services/midiScheduler.js';
import AbletonLink from 'abletonlink';

console.log('🎹 Testing Latency Compensation Range...\n');

// Initialize services
const midi = new MidiService('Latency Range Test');
const connected = midi.init();

if (!connected) {
  console.error('❌ Failed to create virtual MIDI port');
  process.exit(1);
}

console.log('✅ Virtual MIDI port created');

// Create Link instance
const link = new AbletonLink();
link.enable();
link.bpm = 120;
link.quantum = 4;

console.log('✅ Ableton Link enabled');
console.log(`   BPM: ${link.bpm}, Quantum: ${link.quantum}\n`);

// Create scheduler
const scheduler = new MidiScheduler(midi, link);

// Track timing accuracy
const timingData = [];
let expectedTime = null;

scheduler.on('eventExecuted', (event) => {
  if (event.type === 'noteOn') {
    const actualTime = Date.now();
    if (expectedTime) {
      const offset = actualTime - expectedTime;
      timingData.push({
        latency: scheduler.getLatencyCompensation(),
        offset: offset,
        note: event.note
      });
      console.log(`📊 Note ${event.note} fired with ${offset}ms offset (latency: ${scheduler.getLatencyCompensation()}ms)`);
    }
  }
});

// Test different latency values
const testLatencies = [
  -500, // Maximum negative (predictive)
  -200, // High negative
  -100, // Medium negative
  -50,  // Low negative
  0,    // No compensation
  50,   // Low positive
  100,  // Medium positive
  200,  // High positive
  500   // Maximum positive
];

let currentTest = 0;

// Add a simple repeating note pattern
const addTestPattern = () => {
  scheduler.clear();
  // Add notes at each beat for 4 bars
  for (let bar = 0; bar < 4; bar++) {
    for (let beat = 0; beat < 4; beat++) {
      scheduler.addNote({
        bar: bar,
        beat: beat,
        note: 60 + (bar * 4 + beat) % 8,
        duration: 0.5,
        velocity: 100,
        channel: 0
      });
    }
  }
  scheduler.setLoop(16, 0); // 4-bar loop
};

// Start Link update
link.startUpdate(60, () => {});

// Function to run next test
const runNextTest = () => {
  if (currentTest >= testLatencies.length) {
    console.log('\n📊 Test Results Summary:');
    console.log('Latency (ms) | Avg Offset (ms) | Notes');
    console.log('-------------|-----------------|-------');
    
    const summary = {};
    timingData.forEach(data => {
      if (!summary[data.latency]) {
        summary[data.latency] = { total: 0, count: 0 };
      }
      summary[data.latency].total += data.offset;
      summary[data.latency].count++;
    });
    
    Object.keys(summary).sort((a, b) => Number(a) - Number(b)).forEach(latency => {
      const avg = summary[latency].total / summary[latency].count;
      console.log(`${String(latency).padStart(12)} | ${avg.toFixed(1).padStart(15)} | ${summary[latency].count}`);
    });
    
    cleanup();
    return;
  }
  
  const latency = testLatencies[currentTest];
  console.log(`\n🔧 Testing latency compensation: ${latency}ms`);
  
  scheduler.setLatencyCompensation(latency);
  addTestPattern();
  
  if (!scheduler.isRunning) {
    scheduler.start();
  }
  
  // Calculate expected time for first note based on current beat
  const currentBeat = link.beat || 0;
  const nextBeat = Math.ceil(currentBeat);
  const beatsUntil = nextBeat - currentBeat;
  const msPerBeat = 60000 / link.bpm;
  expectedTime = Date.now() + (beatsUntil * msPerBeat) + latency;
  
  currentTest++;
  
  // Run each test for 5 seconds
  setTimeout(runNextTest, 5000);
};

// Start tests after a short delay
console.log('⏰ Starting tests in 2 seconds...\n');
setTimeout(() => {
  runNextTest();
}, 2000);

// Cleanup function
const cleanup = () => {
  console.log('\n🛑 Stopping test...');
  scheduler.stop();
  scheduler.destroy();
  link.stopUpdate();
  link.disable();
  midi.close();
  
  console.log('✅ Test complete');
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

console.log('🎼 Testing various latency compensation values...');
console.log('   Each test runs for 5 seconds');
console.log('   Press Ctrl+C to stop early\n');
