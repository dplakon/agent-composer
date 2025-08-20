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

// Measure true timing error as (actual - planned) where planned is the scheduler's compensated timestamp
scheduler.on('eventExecuted', (event) => {
  if (event.type === 'noteOn') {
    const actualTime = Date.now();
    const planned = typeof event.scheduledTime === 'number' ? event.scheduledTime : null;
    if (planned !== null) {
      const offset = actualTime - planned; // >0 = late, <0 = early
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
    console.log('Latency (ms) | Avg Offset (ms) | Median (ms) | StdDev (ms) | Samples');
    console.log('-------------|-----------------|-------------|-------------|---------');
    
    const summary = {};
    timingData.forEach(data => {
      if (!summary[data.latency]) {
        summary[data.latency] = [];
      }
      summary[data.latency].push(data.offset);
    });
    
    const fmt = (n) => (Number.isFinite(n) ? n.toFixed(1).padStart(11) : '     n/a   ');
    Object.keys(summary).sort((a, b) => Number(a) - Number(b)).forEach(latency => {
      const arr = summary[latency].slice().sort((x, y) => x - y);
      const count = arr.length;
      const avg = arr.reduce((s, v) => s + v, 0) / count;
      const median = arr[Math.floor(count / 2)];
      const variance = arr.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / count;
      const std = Math.sqrt(variance);
      console.log(`${String(latency).padStart(12)} | ${fmt(avg)} | ${fmt(median)} | ${fmt(std)} | ${String(count).padStart(7)}`);
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
