#!/usr/bin/env node

// Simple test to verify MIDI is actually being sent
import MidiService from '../src/services/midiService.js';

console.log('🎹 Testing MIDI Output\n');

const midi = new MidiService('MIDI Output Test');
const connected = midi.init();

if (!connected) {
  console.error('❌ Failed to create virtual MIDI port');
  process.exit(1);
}

console.log('✅ Virtual MIDI port "MIDI Output Test" created');
console.log('📌 Check if this port appears in Ableton Live MIDI preferences\n');

console.log('Sending test notes every second...\n');

let noteNumber = 60;
let count = 0;

const interval = setInterval(() => {
  count++;
  
  // Send note on
  console.log(`▶ Sending Note ${noteNumber} (C${Math.floor(noteNumber/12) - 1})`);
  midi.sendNoteOn(noteNumber, 100, 0);
  
  // Send note off after 200ms
  setTimeout(() => {
    midi.sendNoteOff(noteNumber, 0);
    console.log(`⏹ Note ${noteNumber} off`);
  }, 200);
  
  // Change note for next time
  noteNumber++;
  if (noteNumber > 72) noteNumber = 60;
  
  // Stop after 10 notes
  if (count >= 10) {
    console.log('\n✅ Test complete');
    console.log('If you heard notes in Ableton, MIDI is working!');
    console.log('If not, check:');
    console.log('  1. "MIDI Output Test" appears in Ableton MIDI inputs');
    console.log('  2. Track input is set to "MIDI Output Test"');
    console.log('  3. Track is armed for recording');
    console.log('  4. An instrument is loaded on the track');
    
    clearInterval(interval);
    setTimeout(() => {
      midi.close();
      process.exit(0);
    }, 1000);
  }
}, 1000);

console.log('Press Ctrl+C to stop\n');
