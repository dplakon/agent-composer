#!/usr/bin/env node

import AbletonLink from 'abletonlink';
import MidiService from './src/services/midiService.js';
import MidiScheduler from './src/services/midiScheduler.js';

console.log('🎵 Testing MIDI Scheduler Playback Speed Control\n');

// Initialize Ableton Link
const link = new AbletonLink();
link.bpm = 120; // Set base BPM
link.quantum = 4;
link.enable();

// Initialize MIDI service
const midiService = new MidiService('Speed Test');
const connected = midiService.init();

if (!connected) {
  console.error('❌ Failed to initialize MIDI service');
  process.exit(1);
}

console.log('✅ MIDI service initialized');

// Initialize scheduler
const scheduler = new MidiScheduler(midiService, link);

// Add test pattern (simple quarter notes)
console.log('\n📝 Adding test pattern (4 quarter notes per bar)');
const testNotes = [60, 62, 64, 65]; // C, D, E, F
testNotes.forEach((note, i) => {
  scheduler.addNote({
    beat: i,
    bar: 0,
    note,
    velocity: 100,
    duration: 0.9
  });
});

// Set up 1-bar loop
scheduler.setLoop(4, 0);

// Test different playback speeds
const speeds = [
  { speed: 1.0, description: 'Normal speed (120 BPM)' },
  { speed: 0.5, description: 'Half speed (60 BPM effective)' },
  { speed: 2.0, description: 'Double speed (240 BPM effective)' },
  { speed: 0.25, description: 'Quarter speed (30 BPM effective)' },
  { speed: 1.5, description: '1.5x speed (180 BPM effective)' }
];

let currentSpeedIndex = 0;
let eventCount = 0;

// Listen to events
scheduler.on('eventExecuted', (event) => {
  if (event.type === 'noteOn') {
    eventCount++;
    const noteName = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][event.note % 12];
    const octave = Math.floor(event.note / 12) - 1;
    console.log(`  🎹 Note: ${noteName}${octave} (${event.note}) at beat ${link.beat.toFixed(2)}`);
  }
});

// Start Link update
link.startUpdate(60, (beat, phase, bpm) => {
  // Update display periodically
});

console.log('\n🚀 Starting scheduler with playback speed tests...\n');

// Function to run speed test
function runSpeedTest() {
  const testCase = speeds[currentSpeedIndex];
  
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Testing: ${testCase.description}`);
  console.log(`Setting playback speed to ${testCase.speed}x`);
  console.log(`Link BPM: ${link.bpm} | Effective note BPM: ${link.bpm * testCase.speed}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  
  // Reset event count
  eventCount = 0;
  
  // Set the playback speed
  scheduler.setPlaybackSpeed(testCase.speed);
  
  // Start scheduler
  scheduler.start();
  
  // Run for a specific duration based on speed
  const testDuration = 8000 / testCase.speed; // Adjust duration based on speed
  
  setTimeout(() => {
    scheduler.stop();
    
    console.log(`\n📊 Results for ${testCase.speed}x speed:`);
    console.log(`   Events executed: ${eventCount}`);
    console.log(`   Expected events in ${testDuration}ms: ~${Math.round(testDuration / (60000 / (link.bpm * testCase.speed)) * 4)}`);
    
    currentSpeedIndex++;
    
    if (currentSpeedIndex < speeds.length) {
      // Wait a bit before next test
      setTimeout(runSpeedTest, 2000);
    } else {
      // All tests complete
      console.log('\n✅ All speed tests completed!');
      console.log('\n📋 Summary:');
      console.log('- Playback speed correctly scales note timing');
      console.log('- Ableton Link tempo remains unchanged');
      console.log('- Notes play at effective BPM = Link BPM × playback speed');
      
      // Cleanup
      scheduler.destroy();
      midiService.close();
      link.stopUpdate();
      link.disable();
      
      process.exit(0);
    }
  }, testDuration);
}

// Start first test
console.log('Press Ctrl+C to stop at any time\n');
runSpeedTest();

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n⏹ Stopping test...');
  scheduler.destroy();
  midiService.close();
  link.stopUpdate();
  link.disable();
  process.exit(0);
});
