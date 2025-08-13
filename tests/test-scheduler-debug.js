#!/usr/bin/env node

// Debug test for MIDI Scheduler
import MidiService from '../src/services/midiService.js';
import MidiScheduler from '../src/services/midiScheduler.js';
import AbletonLink from 'abletonlink';

console.log('🎹 Debug Test for MIDI Scheduler\n');

// Initialize MIDI
const midi = new MidiService('Debug Scheduler');
const connected = midi.init();

if (!connected) {
  console.error('❌ Failed to create virtual MIDI port');
  process.exit(1);
}

console.log('✅ Virtual MIDI port created');

// Create Link
const link = new AbletonLink();
link.enable();
link.bpm = 120;
link.quantum = 4;

// Start Link update
link.startUpdate(60, (beat, phase, bpm) => {
  // Keep Link running
});

console.log('✅ Link enabled at', link.bpm, 'BPM');
console.log('Current beat:', link.beat);

// Create scheduler
const scheduler = new MidiScheduler(midi, link);

// Add debug logging
scheduler.on('eventExecuted', (event) => {
  console.log(`✅ EXECUTED: ${event.type} Note:${event.note} Beat:${event.bar}:${event.beat}`);
});

scheduler.on('eventAdded', (event) => {
  console.log(`➕ Added: ${event.type} Note:${event.note} Beat:${event.bar}:${event.beat}`);
});

console.log('\n📝 Adding simple test events...\n');

// Add simple events - one per beat for 4 beats
for (let i = 0; i < 4; i++) {
  scheduler.addNote({
    beat: i,
    bar: 0,
    note: 60 + i,
    duration: 0.5,
    velocity: 100
  });
}

// Set a 4-beat loop
scheduler.setLoop(4, 0);

console.log('\n📊 Scheduler status:');
const stats = scheduler.getStats();
console.log('  Total events:', stats.totalEvents);
console.log('  Loop enabled:', stats.loopEnabled);
console.log('  Current beat:', link.beat);

// Debug the scheduling
console.log('\n🔍 Debugging scheduler state...');
console.log('  Scheduler running:', scheduler.isRunning);
console.log('  MIDI connected:', midi.isConnected);
console.log('  Link beat:', link.beat);
console.log('  Link BPM:', link.bpm);

// Manually check event positions
console.log('\n📍 Event positions:');
scheduler.events.forEach((event, i) => {
  const absBeat = event.getAbsoluteBeat(link.quantum);
  console.log(`  Event ${i}: Beat ${absBeat}, Executed: ${event.executed}`);
});

// Start the scheduler
console.log('\n▶️ Starting scheduler...\n');
scheduler.start();

// Monitor for 10 seconds
let lastBeat = -1;
const monitor = setInterval(() => {
  const currentBeat = Math.floor(link.beat);
  const stats = scheduler.getStats();
  
  if (currentBeat !== lastBeat) {
    console.log(`📍 Beat: ${currentBeat} | Executed: ${stats.eventsExecuted} | Notes: ${stats.notesPlayed} | Active: ${stats.activeNotes}`);
    lastBeat = currentBeat;
    
    // Debug scheduler internals
    if (stats.eventsExecuted === 0 && currentBeat > 2) {
      console.log('⚠️ No events executed yet. Checking scheduler...');
      console.log('  Running:', scheduler.isRunning);
      console.log('  Timer:', scheduler.scheduleTimer !== null);
      console.log('  Link beat:', link.beat);
      console.log('  Last scheduled beat:', scheduler.lastScheduledBeat);
    }
  }
}, 100);

// Stop after 10 seconds
setTimeout(() => {
  clearInterval(monitor);
  scheduler.stop();
  
  const finalStats = scheduler.getStats();
  console.log('\n📊 Final Results:');
  console.log('  Events executed:', finalStats.eventsExecuted);
  console.log('  Notes played:', finalStats.notesPlayed);
  
  if (finalStats.eventsExecuted === 0) {
    console.log('\n❌ No events were executed!');
    console.log('Possible issues:');
    console.log('  - Scheduling logic may be incorrect');
    console.log('  - Timing calculations may be off');
    console.log('  - Events may not be within lookahead window');
  } else {
    console.log('\n✅ Scheduler is working!');
  }
  
  scheduler.destroy();
  link.stopUpdate();
  link.disable();
  midi.close();
  process.exit(0);
}, 10000);

console.log('Running for 10 seconds...\n');
