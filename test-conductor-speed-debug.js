#!/usr/bin/env node

import AbletonLink from 'abletonlink';
import MidiService from './src/services/midiService.js';
import { MidiScheduler } from './src/services/midiScheduler.js';

console.log('🎵 Testing Playback Speed with MIDI Events...\n');

// Initialize Link
const link = new AbletonLink();
link.bpm = 120;
link.quantum = 4;
link.enablePlayStateSync();
link.enable();

// Initialize MIDI
const midiService = new MidiService('Speed Test');
const connected = midiService.init();

if (!connected) {
  console.error('❌ Failed to create MIDI port');
  process.exit(1);
}

// Initialize scheduler
const scheduler = new MidiScheduler(midiService, link);

// Add a simple repeating pattern - one note per beat
console.log('Adding test pattern: 4 notes, one per beat...');
for (let i = 0; i < 4; i++) {
  scheduler.addNote({
    bar: 0,
    beat: i,
    note: 60 + i * 4, // C, E, G#, C
    velocity: 100,
    duration: 0.5,
    channel: 0
  });
}

// Set up loop
scheduler.setLoop(4, 0); // 4 beat loop

// Track when notes are played
let lastNoteTime = Date.now();
let noteCount = 0;
let averageInterval = 0;

scheduler.on('eventExecuted', (event) => {
  if (event.type === 0) { // NOTE_ON
    const now = Date.now();
    const interval = now - lastNoteTime;
    
    if (noteCount > 0) { // Skip the first interval
      averageInterval = (averageInterval * (noteCount - 1) + interval) / noteCount;
      const expectedInterval = 60000 / (link.bpm * scheduler.getPlaybackSpeed());
      const difference = interval - expectedInterval;
      
      console.log(`Note ${noteCount}: ${event.note} | Interval: ${interval}ms | Expected: ${expectedInterval.toFixed(0)}ms | Diff: ${difference > 0 ? '+' : ''}${difference.toFixed(0)}ms | Speed: ${scheduler.getPlaybackSpeed()}x`);
    }
    
    lastNoteTime = now;
    noteCount++;
  }
});

// Start Link update
link.startUpdate(60, (beat, phase, bpm) => {
  // Keep Link running
});

// Start scheduler
console.log('\nStarting scheduler at 1.0x speed...');
console.log('You should hear notes every 500ms (120 BPM)\n');
scheduler.start();

// Test different speeds
setTimeout(() => {
  console.log('\n🔄 Changing to 2.0x speed...');
  console.log('Notes should now play every 250ms\n');
  scheduler.setPlaybackSpeed(2.0);
  noteCount = 0;
  averageInterval = 0;
}, 5000);

setTimeout(() => {
  console.log('\n🔄 Changing to 0.5x speed...');
  console.log('Notes should now play every 1000ms\n');
  scheduler.setPlaybackSpeed(0.5);
  noteCount = 0;
  averageInterval = 0;
}, 10000);

setTimeout(() => {
  console.log('\n🔄 Changing back to 1.0x speed...');
  console.log('Notes should play every 500ms again\n');
  scheduler.setPlaybackSpeed(1.0);
  noteCount = 0;
  averageInterval = 0;
}, 15000);

// Stop after 20 seconds
setTimeout(() => {
  console.log('\n✅ Test complete!');
  console.log('If the note intervals changed with speed, playback speed is working correctly.');
  
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
