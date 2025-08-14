#!/usr/bin/env node

import AbletonLink from 'abletonlink';
import MidiService from './src/services/midiService.js';
import { MidiScheduler } from './src/services/midiScheduler.js';

console.log('🎵 Simple Scheduler Timing Test...\n');

// Initialize Link
const link = new AbletonLink();
link.bpm = 120;
link.quantum = 4;
link.enablePlayStateSync();
link.enable();
link.isPlaying = true;

// Initialize MIDI
const midiService = new MidiService('Timing Test');
const connected = midiService.init();

if (!connected) {
  console.error('❌ Failed to create MIDI port');
  process.exit(1);
}

// Initialize scheduler
const scheduler = new MidiScheduler(midiService, link);

// Wait for Link to stabilize
setTimeout(() => {
  const currentBeat = link.beat || 0;
  const currentBar = Math.floor(currentBeat / 4);
  const startBar = currentBar + 2; // Schedule 2 bars ahead
  
  console.log(`Current Link beat: ${currentBeat.toFixed(2)}, bar: ${currentBar}`);
  console.log(`Scheduling notes starting at bar ${startBar}\n`);
  
  // Add notes at specific future bars
  for (let i = 0; i < 4; i++) {
    const bar = startBar + Math.floor(i / 4);
    const beat = i % 4;
    const note = 60 + i * 3;
    
    console.log(`Adding note ${note} at bar ${bar}, beat ${beat}`);
    scheduler.addNote({
      bar: bar,
      beat: beat,
      note: note,
      velocity: 100,
      duration: 0.25,
      channel: 0
    });
  }
  
  // Log execution
  let executedCount = 0;
  scheduler.on('eventExecuted', (event) => {
    if (event.type === 0) { // NOTE_ON
      executedCount++;
      const currentBeat = link.beat || 0;
      console.log(`✅ Executed note ${event.note} at Link beat ${currentBeat.toFixed(2)} | Speed: ${scheduler.getPlaybackSpeed()}x | Count: ${executedCount}`);
    }
  });
  
  // Start scheduler
  console.log('\nStarting scheduler at 1.0x speed...\n');
  scheduler.start();
  
  // Change speed after 3 seconds
  setTimeout(() => {
    console.log('\n🔄 Changing to 2.0x speed (notes should play faster)...\n');
    scheduler.setPlaybackSpeed(2.0);
    
    // Add more notes for the new speed
    const currentBeat = link.beat || 0;
    const currentBar = Math.floor(currentBeat / 4);
    const newStartBar = currentBar + 2;
    
    for (let i = 0; i < 4; i++) {
      const bar = newStartBar + Math.floor(i / 4);
      const beat = i % 4;
      const note = 72 + i * 3; // Higher octave
      
      scheduler.addNote({
        bar: bar,
        beat: beat,
        note: note,
        velocity: 100,
        duration: 0.25,
        channel: 0
      });
    }
  }, 3000);
  
  // Change speed again after 6 seconds
  setTimeout(() => {
    console.log('\n🔄 Changing to 0.5x speed (notes should play slower)...\n');
    scheduler.setPlaybackSpeed(0.5);
  }, 6000);
  
}, 1000);

// Keep running for 15 seconds
setTimeout(() => {
  console.log('\n✅ Test complete!');
  
  const stats = scheduler.getStats();
  console.log(`\nFinal stats:`);
  console.log(`  Events scheduled: ${stats.totalEvents}`);
  console.log(`  Events executed: ${stats.eventsExecuted}`);
  console.log(`  Notes played: ${stats.notesPlayed}`);
  console.log(`  Final speed: ${stats.playbackSpeed}x`);
  
  scheduler.stop();
  scheduler.destroy();
  midiService.close();
  link.stopUpdate();
  link.disable();
  process.exit(0);
}, 15000);

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
