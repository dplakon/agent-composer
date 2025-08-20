#!/usr/bin/env node

/**
 * Test script for safety note-off mechanism
 * This test verifies that:
 * 1. Note-offs are sent at segment boundaries
 * 2. Only one note plays per track at a time
 * 3. No hanging notes persist between segments
 */

import Link from 'abletonlink';
import MidiService from './src/services/midiService.js';
import { MidiScheduler, MidiEvent, EventType } from './src/services/midiScheduler.js';
import chalk from 'chalk';

console.log(chalk.cyan('\n🧪 Testing Safety Note-Off Mechanism\n'));

// Initialize Link
const link = new Link();
link.startUpdate(60, (beat, phase, bpm, quantum) => {
  // Keep Link updating
});

// Initialize MIDI
const midiService = new MidiService('Safety Test');
const midiConnected = midiService.init();

if (!midiConnected) {
  console.error(chalk.red('❌ Failed to create MIDI port'));
  process.exit(1);
}

// Initialize scheduler
const scheduler = new MidiScheduler(midiService, link);

// Track note events for verification
let noteOnCount = 0;
let noteOffCount = 0;
let safetyNoteOffCount = 0;
const activeNotesPerChannel = new Map();

// Listen to scheduler events
scheduler.on('eventExecuted', (event) => {
  if (event.type === EventType.NOTE_ON) {
    noteOnCount++;
    const key = `${event.channel}`;
    const current = activeNotesPerChannel.get(key) || 0;
    activeNotesPerChannel.set(key, current + 1);
    
    console.log(chalk.green(`  ✅ Note ON: ch=${event.channel}, note=${event.note}, active=${current + 1}`));
    
    // Check for multiple notes on same channel
    if (current >= 1) {
      console.log(chalk.yellow(`  ⚠️  Multiple notes on channel ${event.channel}: ${current + 1} notes`));
    }
  } else if (event.type === EventType.NOTE_OFF) {
    noteOffCount++;
    const key = `${event.channel}`;
    const current = activeNotesPerChannel.get(key) || 0;
    activeNotesPerChannel.set(key, Math.max(0, current - 1));
    
    console.log(chalk.blue(`  ❌ Note OFF: ch=${event.channel}, note=${event.note}, active=${Math.max(0, current - 1)}`));
  }
});

scheduler.on('safetyNoteOffs', ({ channels, count }) => {
  safetyNoteOffCount += count;
  console.log(chalk.magenta(`\n🔒 Safety note-offs sent: ${count} notes on channels [${channels.join(', ')}]\n`));
  
  // Reset active notes for cleared channels
  channels.forEach(ch => activeNotesPerChannel.set(String(ch), 0));
});

// Test 1: Schedule notes across segment boundary
console.log(chalk.cyan('\n📝 Test 1: Notes across segment boundary\n'));

// Add notes at different positions
scheduler.addNote({ bar: 0, beat: 0, note: 60, velocity: 100, duration: 0.5, channel: 0 });
scheduler.addNote({ bar: 1, beat: 0, note: 62, velocity: 100, duration: 0.5, channel: 0 });
scheduler.addNote({ bar: 7, beat: 3, note: 64, velocity: 100, duration: 1.0, channel: 0 }); // This should be cut off
scheduler.addNote({ bar: 8, beat: 0, note: 65, velocity: 100, duration: 0.5, channel: 0 }); // New segment

// Schedule safety note-offs at bar 8 (segment boundary)
const segmentEndBeat = 8 * 4 - 0.1; // Just before bar 8
scheduler.scheduleSafetyNoteOffs(segmentEndBeat, [0]);

console.log(chalk.green('✅ Scheduled 4 notes and safety note-off at segment boundary'));

// Test 2: Multiple channels
console.log(chalk.cyan('\n📝 Test 2: Multiple channels\n'));

// Add notes on different channels
scheduler.addNote({ bar: 9, beat: 0, note: 60, velocity: 100, duration: 0.5, channel: 1 });
scheduler.addNote({ bar: 9, beat: 0, note: 64, velocity: 100, duration: 0.5, channel: 2 });
scheduler.addNote({ bar: 9, beat: 0, note: 67, velocity: 100, duration: 0.5, channel: 3 });

// Schedule safety for multiple channels
scheduler.scheduleSafetyNoteOffs(10 * 4 - 0.1, [1, 2, 3]);

console.log(chalk.green('✅ Scheduled notes on 3 channels with safety note-offs'));

// Test 3: Verify scheduled safety clears only
console.log(chalk.cyan('\n📝 Test 3: Scheduled safety clears (no immediate clear)\n'));

// Add overlapping notes that should play naturally until segment boundary
scheduler.addNote({ bar: 10, beat: 0, note: 60, velocity: 100, duration: 4.0, channel: 4 }); // Long note
scheduler.addNote({ bar: 10, beat: 2, note: 64, velocity: 100, duration: 2.0, channel: 4 }); // Overlaps
scheduler.addNote({ bar: 11, beat: 0, note: 67, velocity: 100, duration: 1.0, channel: 4 });

// Safety clear should only happen at segment end, not immediately
scheduler.scheduleSafetyNoteOffs(12 * 4 - 0.1, [4]);

console.log(chalk.green('✅ Scheduled overlapping notes - they should play naturally until segment boundary'));

// Start the scheduler
console.log(chalk.cyan('\n▶️  Starting scheduler...\n'));
scheduler.start();

// Run for 20 seconds to observe the behavior
setTimeout(() => {
  scheduler.stop();
  
  console.log(chalk.cyan('\n📊 Test Results:\n'));
  console.log(chalk.white(`  Total Note ONs: ${noteOnCount}`));
  console.log(chalk.white(`  Total Note OFFs: ${noteOffCount}`));
  console.log(chalk.white(`  Safety Note OFFs: ${safetyNoteOffCount}`));
  
  // Check for any remaining active notes
  let hasActiveNotes = false;
  activeNotesPerChannel.forEach((count, channel) => {
    if (count > 0) {
      console.log(chalk.red(`  ⚠️  Channel ${channel} still has ${count} active notes!`));
      hasActiveNotes = true;
    }
  });
  
  if (!hasActiveNotes) {
    console.log(chalk.green('  ✅ All notes properly cleared!'));
  }
  
  // Clean up
  midiService.close();
  process.exit(0);
}, 20000);

console.log(chalk.gray('Test will run for 20 seconds...'));

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n\n🛑 Interrupted - cleaning up...'));
  scheduler.stop();
  midiService.close();
  process.exit(0);
});
