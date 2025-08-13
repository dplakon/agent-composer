#!/usr/bin/env node

// Test script for MIDI Scheduler
import MidiService from '../src/services/midiService.js';
import MidiScheduler from '../src/services/midiScheduler.js';
import AbletonLink from 'abletonlink';

console.log('🎹 Testing MIDI Scheduler...\n');

// Initialize services
const midi = new MidiService('Scheduler Test');
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

// Add event listeners
scheduler.on('eventExecuted', (event) => {
  console.log(`▶ Executed: ${event.type} - Note ${event.note} at beat ${event.bar}:${event.beat.toFixed(2)}`);
});

scheduler.on('start', () => {
  console.log('🎵 Scheduler started');
});

scheduler.on('stop', () => {
  console.log('⏹ Scheduler stopped');
});

console.log('📝 Adding test pattern...\n');

// Add a simple test pattern
// Bar 0: C major scale ascending
scheduler.addPattern([
  { note: 60, duration: 0.25 }, // C
  { note: 62, duration: 0.25 }, // D
  { note: 64, duration: 0.25 }, // E
  { note: 65, duration: 0.25 }, // F
  { note: 67, duration: 0.25 }, // G
  { note: 69, duration: 0.25 }, // A
  { note: 71, duration: 0.25 }, // B
  { note: 72, duration: 0.25 }, // C
], 0);

// Bar 1: Chord progression
scheduler.addChord({ beat: 0, bar: 1, notes: [60, 64, 67], duration: 1 }); // C major
scheduler.addChord({ beat: 1, bar: 1, notes: [62, 65, 69], duration: 1 }); // D minor
scheduler.addChord({ beat: 2, bar: 1, notes: [64, 67, 71], duration: 1 }); // E minor
scheduler.addChord({ beat: 3, bar: 1, notes: [65, 69, 72], duration: 1 }); // F major

// Bar 2: Bass line
scheduler.addPattern([
  { note: 36, duration: 0.5, velocity: 110 }, // C2
  { note: 38, duration: 0.5, velocity: 100 }, // D2
  { note: 40, duration: 0.5, velocity: 100 }, // E2
  { note: 41, duration: 0.5, velocity: 100 }, // F2
  { note: 43, duration: 0.5, velocity: 110 }, // G2
  { note: 41, duration: 0.5, velocity: 100 }, // F2
  { note: 40, duration: 0.5, velocity: 100 }, // E2
  { note: 38, duration: 0.5, velocity: 100 }, // D2
], 2);

// Bar 3: Drums (using GM drum map)
scheduler.addPattern([
  { note: 36, duration: 0.25, velocity: 127, channel: 9 }, // Kick
  { note: 42, duration: 0.25, velocity: 80, channel: 9 },  // Hi-hat
  { note: 38, duration: 0.25, velocity: 100, channel: 9 }, // Snare
  { note: 42, duration: 0.25, velocity: 80, channel: 9 },  // Hi-hat
  { note: 36, duration: 0.25, velocity: 100, channel: 9 }, // Kick
  { note: 42, duration: 0.25, velocity: 80, channel: 9 },  // Hi-hat
  { note: 38, duration: 0.25, velocity: 100, channel: 9 }, // Snare
  { note: 46, duration: 0.25, velocity: 90, channel: 9 },  // Open hi-hat
], 3);

// Set up 4-bar loop
scheduler.setLoop(16, 0); // 4 bars * 4 beats

const stats = scheduler.getStats();
console.log(`📊 Pattern loaded:`);
console.log(`   Total events: ${stats.totalEvents}`);
console.log(`   Loop: ${stats.loopEnabled ? 'Enabled (4 bars)' : 'Disabled'}\n`);

// Start Link update
link.startUpdate(60, (beat, phase, bpm) => {
  // This keeps Link running
});

// Start scheduler after a short delay
console.log('⏰ Starting scheduler in 2 seconds...\n');
setTimeout(() => {
  scheduler.start();
  
  // Display status
  setInterval(() => {
    const stats = scheduler.getStats();
    process.stdout.write(
      `\r📈 Beat: ${Math.floor(link.beat)} | ` +
      `Events: ${stats.eventsExecuted}/${stats.totalEvents} | ` +
      `Notes: ${stats.notesPlayed} | ` +
      `Active: ${stats.activeNotes} | ` +
      `BPM: ${link.bpm.toFixed(1)}`
    );
  }, 100);
}, 2000);

// Handle cleanup
const cleanup = () => {
  console.log('\n\n🛑 Stopping...');
  scheduler.stop();
  scheduler.destroy();
  link.stopUpdate();
  link.disable();
  midi.close();
  
  const finalStats = scheduler.getStats();
  console.log('📊 Final statistics:');
  console.log(`   Events executed: ${finalStats.eventsExecuted}`);
  console.log(`   Notes played: ${finalStats.notesPlayed}`);
  console.log('✅ Test complete');
  process.exit(0);
};

// Run for 20 seconds then stop
setTimeout(cleanup, 20000);

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

console.log('🎼 Scheduler will run for 20 seconds...');
console.log('📌 Connect Ableton Live to hear the pattern!');
console.log('   Press Ctrl+C to stop early\n');
