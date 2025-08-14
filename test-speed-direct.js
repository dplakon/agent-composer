#!/usr/bin/env node

import AbletonLink from 'abletonlink';
import MidiService from './src/services/midiService.js';
import { MidiScheduler } from './src/services/midiScheduler.js';

console.log('🎵 Direct Speed Test - Checking if msPerBeat affects timing...\n');

// Initialize Link
const link = new AbletonLink();
link.bpm = 60; // Slow BPM for easier observation - 1 beat per second
link.quantum = 4;
link.enablePlayStateSync();
link.enable();

// Initialize MIDI
const midiService = new MidiService('Direct Speed Test');
const connected = midiService.init();

if (!connected) {
  console.error('❌ Failed to create MIDI port');
  process.exit(1);
}

// Initialize scheduler
const scheduler = new MidiScheduler(midiService, link);

console.log('Settings:');
console.log('  Link BPM: 60 (1 beat per second)');
console.log('  Initial speed: 1.0x');
console.log('  Events will be scheduled 8 beats ahead\n');

// Wait a moment then add events
setTimeout(() => {
  const currentBeat = link.beat || 0;
  const currentBar = Math.floor(currentBeat / 4);
  const startBar = currentBar + 2; // 8 beats ahead
  
  console.log(`Current beat: ${currentBeat.toFixed(2)}`);
  console.log(`Scheduling 4 notes starting at bar ${startBar} (beat ${startBar * 4})\n`);
  
  // Add 4 notes, one per beat
  for (let i = 0; i < 4; i++) {
    scheduler.addNote({
      bar: startBar,
      beat: i,
      note: 60 + i * 3,
      velocity: 100,
      duration: 0.25,
      channel: 0
    });
  }
  
  // Track executions
  let noteTimestamps = [];
  scheduler.on('eventExecuted', (event) => {
    if (event.type === 'noteOn') { // NOTE_ON
      const now = Date.now();
      noteTimestamps.push(now);
      const linkBeat = link.beat || 0;
      console.log(`✅ Note ${event.note} executed at Link beat ${linkBeat.toFixed(2)}, speed: ${scheduler.getPlaybackSpeed()}x`);
      
      if (noteTimestamps.length > 1) {
        const interval = now - noteTimestamps[noteTimestamps.length - 2];
        const expectedMs = 1000 / scheduler.getPlaybackSpeed(); // 1 second per beat at 60 BPM
        console.log(`   Interval: ${interval}ms (expected: ${expectedMs}ms at ${scheduler.getPlaybackSpeed()}x speed)`);
      }
    }
  });
  
  // Start scheduler
  console.log('Starting scheduler...\n');
  scheduler.start();
  
  // After 3 seconds, change speed to 2x (notes should play twice as fast)
  setTimeout(() => {
    console.log('\n🔄 CHANGING SPEED TO 2.0x');
    console.log('Next notes should play at 500ms intervals (twice as fast)\n');
    scheduler.setPlaybackSpeed(2.0);
    noteTimestamps = []; // Reset timestamps
    
    // Add more notes to observe speed change
    const currentBeat2 = link.beat || 0;
    const currentBar2 = Math.floor(currentBeat2 / 4);
    const startBar2 = currentBar2 + 2;
    
    console.log(`Adding 4 more notes at bar ${startBar2}\n`);
    for (let i = 0; i < 4; i++) {
      scheduler.addNote({
        bar: startBar2,
        beat: i,
        note: 72 + i * 3, // Higher octave
        velocity: 100,
        duration: 0.25,
        channel: 0
      });
    }
  }, 3000);
  
  // After 10 seconds, change speed to 0.5x
  setTimeout(() => {
    console.log('\n🔄 CHANGING SPEED TO 0.5x');
    console.log('Next notes should play at 2000ms intervals (half speed)\n');
    scheduler.setPlaybackSpeed(0.5);
    noteTimestamps = []; // Reset timestamps
    
    // Add more notes
    const currentBeat3 = link.beat || 0;
    const currentBar3 = Math.floor(currentBeat3 / 4);
    const startBar3 = currentBar3 + 2;
    
    console.log(`Adding 4 more notes at bar ${startBar3}\n`);
    for (let i = 0; i < 4; i++) {
      scheduler.addNote({
        bar: startBar3,
        beat: i,
        note: 48 + i * 3, // Lower octave
        velocity: 100,
        duration: 0.25,
        channel: 0
      });
    }
  }, 10000);
  
}, 1000);

// Stop after 20 seconds
setTimeout(() => {
  console.log('\n✅ Test complete!');
  
  scheduler.stop();
  scheduler.destroy();
  midiService.close();
  link.stopUpdate();
  link.disable();
  process.exit(0);
}, 20000);

// Handle exit
process.on('SIGINT', () => {
  console.log('\n\nStopping...');
  scheduler.stop();
  scheduler.destroy();
  midiService.close();
  link.stopUpdate();
  link.disable();
  process.exit(0);
});
