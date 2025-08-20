#!/usr/bin/env node

/**
 * Test script to verify NoteOff events are firing correctly
 * This tests the scheduler fixes for dropped NoteOff events
 */

import MidiService from './src/services/midiService.js';
import MidiScheduler from './src/services/midiScheduler.js';
import AbletonLink from 'abletonlink';

console.log('🎹 Testing NoteOff event handling...\n');

// Initialize services
const midi = new MidiService('NoteOff Test');
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

// Create scheduler with debug mode
const scheduler = new MidiScheduler(midi, link);
scheduler.debugNoteOffs = true; // Enable NoteOff debug logging

// Track NoteOn and NoteOff events
let noteOnCount = 0;
let noteOffCount = 0;
let activeNotes = new Map();

// Add event listeners
scheduler.on('eventExecuted', (event) => {
  if (event.type === 'noteOn') {
    noteOnCount++;
    const key = `${event.channel}-${event.note}`;
    activeNotes.set(key, Date.now());
    console.log(`✅ NoteOn #${noteOnCount}: note=${event.note}, channel=${event.channel}`);
  } else if (event.type === 'noteOff') {
    noteOffCount++;
    const key = `${event.channel}-${event.note}`;
    if (activeNotes.has(key)) {
      const duration = Date.now() - activeNotes.get(key);
      activeNotes.delete(key);
      console.log(`✅ NoteOff #${noteOffCount}: note=${event.note}, channel=${event.channel}, duration=${duration}ms`);
    } else {
      console.log(`⚠️ NoteOff #${noteOffCount}: note=${event.note}, channel=${event.channel} (no matching NoteOn)`);
    }
  }
});

console.log('📝 Adding test patterns...\n');

// Test 1: Simple notes with varying durations
console.log('Test 1: Simple notes with varying durations');
scheduler.addNote({ bar: 0, beat: 0, note: 60, duration: 0.5, velocity: 100, channel: 0 });
scheduler.addNote({ bar: 0, beat: 1, note: 64, duration: 1.0, velocity: 100, channel: 0 });
scheduler.addNote({ bar: 0, beat: 2, note: 67, duration: 2.0, velocity: 100, channel: 0 });

// Test 2: Overlapping notes on different channels
console.log('Test 2: Overlapping notes on different channels');
scheduler.addNote({ bar: 1, beat: 0, note: 48, duration: 4.0, velocity: 110, channel: 1 }); // Bass
scheduler.addNote({ bar: 1, beat: 0, note: 60, duration: 1.0, velocity: 90, channel: 2 });  // Mid
scheduler.addNote({ bar: 1, beat: 1, note: 64, duration: 1.0, velocity: 90, channel: 2 });  // Mid
scheduler.addNote({ bar: 1, beat: 2, note: 67, duration: 1.0, velocity: 90, channel: 2 });  // Mid

// Test 3: Rapid succession notes
console.log('Test 3: Rapid succession notes');
for (let i = 0; i < 8; i++) {
  scheduler.addNote({ 
    bar: 2, 
    beat: i * 0.5, 
    note: 60 + i, 
    duration: 0.25, 
    velocity: 100, 
    channel: 3 
  });
}

// Test 4: Long sustained note across bars
console.log('Test 4: Long sustained note across bars');
scheduler.addNote({ bar: 3, beat: 0, note: 36, duration: 8.0, velocity: 127, channel: 4 });

// Start Link update
link.startUpdate(60, () => {});

// Start scheduler after a short delay
console.log('\n⏰ Starting scheduler in 2 seconds...\n');
setTimeout(() => {
  scheduler.start();
  
  // Display status
  const statusInterval = setInterval(() => {
    const stats = scheduler.getStats();
    const beat = Math.floor(link.beat);
    const bar = Math.floor(beat / 4);
    
    process.stdout.write(
      `\r📊 Bar ${bar}:${(beat % 4) + 1} | ` +
      `NoteOn: ${noteOnCount} | NoteOff: ${noteOffCount} | ` +
      `Active: ${activeNotes.size} | ` +
      `Pending: ${stats.pendingEvents}`
    );
  }, 100);
  
  // Check for stuck notes periodically
  setInterval(() => {
    if (activeNotes.size > 0) {
      console.log(`\n⚠️ Active notes that haven't received NoteOff:`);
      activeNotes.forEach((startTime, key) => {
        const [channel, note] = key.split('-');
        const duration = Date.now() - startTime;
        console.log(`   Channel ${channel}, Note ${note}: ${(duration/1000).toFixed(1)}s`);
      });
    }
  }, 5000);
}, 2000);

// Cleanup function
const cleanup = () => {
  console.log('\n\n🛑 Stopping test...');
  scheduler.stop();
  scheduler.destroy();
  link.stopUpdate();
  link.disable();
  midi.close();
  
  console.log('\n📊 Final Report:');
  console.log(`   Total NoteOn events: ${noteOnCount}`);
  console.log(`   Total NoteOff events: ${noteOffCount}`);
  console.log(`   Stuck notes: ${activeNotes.size}`);
  
  if (activeNotes.size > 0) {
    console.log('\n❌ TEST FAILED: Some notes did not receive NoteOff');
    activeNotes.forEach((_, key) => {
      const [channel, note] = key.split('-');
      console.log(`   Stuck: Channel ${channel}, Note ${note}`);
    });
    process.exit(1);
  } else if (noteOffCount === noteOnCount) {
    console.log('\n✅ TEST PASSED: All NoteOn events had matching NoteOff events');
    process.exit(0);
  } else {
    console.log(`\n⚠️ WARNING: NoteOn/NoteOff count mismatch (${noteOnCount} vs ${noteOffCount})`);
    process.exit(1);
  }
};

// Run for 30 seconds then stop
setTimeout(cleanup, 30000);

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

console.log('🎼 Test will run for 30 seconds...');
console.log('   Monitor MIDI output to verify NoteOff events');
console.log('   Press Ctrl+C to stop early\n');
