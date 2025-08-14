#!/usr/bin/env node

import AbletonLink from 'abletonlink';
import MidiService from './src/services/midiService.js';
import { MidiScheduler } from './src/services/midiScheduler.js';

console.log('🔍 Diagnosing Playback Speed Issue...\n');

// Initialize Link
const link = new AbletonLink();
link.bpm = 120; // 2 beats per second
link.quantum = 4;
link.enablePlayStateSync();
link.enable();

// Initialize MIDI
const midiService = new MidiService('Speed Diagnosis');
const connected = midiService.init();

if (!connected) {
  console.error('❌ Failed to create MIDI port');
  process.exit(1);
}

// Initialize scheduler
const scheduler = new MidiScheduler(midiService, link);

// Add diagnostic logging
let noteTimings = [];

scheduler.on('eventExecuted', (event) => {
  if (event.type === 'noteOn') {
    const now = Date.now();
    const linkBeat = link.beat || 0;
    noteTimings.push({ time: now, beat: linkBeat, note: event.note });
    
    console.log(`✅ Note ${event.note} at Link beat ${linkBeat.toFixed(2)}`);
    
    if (noteTimings.length > 1) {
      const prev = noteTimings[noteTimings.length - 2];
      const interval = now - prev.time;
      const beatDiff = linkBeat - prev.beat;
      console.log(`   Time interval: ${interval}ms, Beat interval: ${beatDiff.toFixed(2)} beats`);
      console.log(`   Speed setting: ${scheduler.getPlaybackSpeed()}x`);
      console.log(`   Expected interval at ${scheduler.getPlaybackSpeed()}x: ${500 / scheduler.getPlaybackSpeed()}ms`);
    }
  }
});

console.log('Test Plan:');
console.log('1. Add 4 notes at 1-beat intervals');
console.log('2. Start at 1x speed (should be 500ms between notes at 120 BPM)');
console.log('3. Change to 2x speed (should be 250ms between notes)');
console.log('4. Observe if timing actually changes\n');

// Start the scheduler
scheduler.start();

// Wait for Link to stabilize, then add notes
setTimeout(() => {
  const currentBeat = link.beat || 0;
  const currentBar = Math.floor(currentBeat / 4);
  const startBar = currentBar + 1; // Start 1 bar ahead
  
  console.log(`\n📍 Current Link beat: ${currentBeat.toFixed(2)}, bar: ${currentBar}`);
  console.log(`Adding 8 notes starting at bar ${startBar} (beat ${startBar * 4})\n`);
  
  // Add 8 notes, one per beat
  for (let i = 0; i < 8; i++) {
    const bar = startBar + Math.floor(i / 4);
    const beat = i % 4;
    scheduler.addNote({
      bar: bar,
      beat: beat,
      note: 60 + i,
      velocity: 100,
      duration: 0.25,
      channel: 0
    });
  }
  
  console.log('Speed: 1.0x - Notes should play every 500ms\n');
  
  // After 2 seconds (4 notes), change speed to 2x
  setTimeout(() => {
    console.log('\n🔄 CHANGING TO 2x SPEED');
    console.log('Remaining notes should now play every 250ms\n');
    scheduler.setPlaybackSpeed(2.0);
    noteTimings = []; // Reset to measure new intervals
  }, 2000);
  
  // After 4 seconds, add more notes at current speed
  setTimeout(() => {
    const currentBeat2 = link.beat || 0;
    const currentBar2 = Math.floor(currentBeat2 / 4);
    const startBar2 = currentBar2 + 1;
    
    console.log(`\n📍 Adding 4 more notes at bar ${startBar2} with 2x speed active\n`);
    
    for (let i = 0; i < 4; i++) {
      scheduler.addNote({
        bar: startBar2,
        beat: i,
        note: 72 + i,
        velocity: 100,
        duration: 0.25,
        channel: 0
      });
    }
  }, 4000);
  
}, 1000);

// Clean up after 10 seconds
setTimeout(() => {
  console.log('\n📊 Summary:');
  console.log('If playback speed is working correctly:');
  console.log('- First 4 notes should have ~500ms intervals');
  console.log('- After speed change, intervals should be ~250ms');
  console.log('- But if all intervals are ~500ms, speed is NOT affecting playback\n');
  
  scheduler.stop();
  scheduler.destroy();
  midiService.close();
  link.stopUpdate();
  link.disable();
  process.exit(0);
}, 10000);

process.on('SIGINT', () => {
  scheduler.stop();
  scheduler.destroy();
  midiService.close();
  link.stopUpdate();
  link.disable();
  process.exit(0);
});
