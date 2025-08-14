#!/usr/bin/env node

/**
 * Live test for conductor playback speed with real music generation
 * Requires API key to generate actual compositions
 */

import { Conductor } from './src/services/conductor.js';
import MidiService from './src/services/midi.js';
import MidiScheduler from './src/services/midiScheduler.js';
import AbletonLink from 'abletonlink-addon';
import chalk from 'chalk';
import readline from 'readline';

// Check for API key
const apiKey = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error(chalk.red('❌ Error: No API key found'));
  console.log('Please set OPENAI_API_KEY or ANTHROPIC_API_KEY environment variable');
  process.exit(1);
}

console.log(chalk.cyan('\n🎼 Live Conductor Playback Speed Test\n'));
console.log('This test will generate a real composition and play it at different speeds.');
console.log('─'.repeat(60));

// Initialize services
const link = new AbletonLink();
link.enable();
link.startUpdate(16, (beat, phase, bpm) => {});

const midiService = new MidiService('Conductor Speed Test');
const midiConnected = midiService.init();

if (!midiConnected) {
  console.error(chalk.red('❌ Failed to create MIDI port'));
  process.exit(1);
}

const scheduler = new MidiScheduler(midiService, link);

// Determine provider
const provider = process.env.OPENAI_API_KEY ? 'openai' : 'anthropic';
const model = provider === 'openai' ? 'gpt-3.5-turbo' : 'claude-3-opus-20240229';

const conductor = new Conductor({
  provider,
  model,
  apiKey,
  temperature: 0.8
});

console.log(chalk.green(`✅ Initialized with ${provider} (${model})`));
console.log(chalk.yellow('\n🎵 Generating a test composition...'));

// Generate a composition
conductor.generate({
  style: 'Classical',
  tempo: 120,
  key: 'C major'
}).then(composition => {
  if (!composition) {
    console.error(chalk.red('❌ Failed to generate composition'));
    process.exit(1);
  }
  
  console.log(chalk.green('✅ Composition generated successfully!'));
  console.log(`   ${composition.tracks.length} tracks, ${composition.metadata.bars} bars\n`);
  
  // Play at different speeds
  const speeds = [
    { value: 1.0, name: 'Normal', color: 'white' },
    { value: 0.5, name: 'Half', color: 'yellow' },
    { value: 2.0, name: 'Double', color: 'cyan' },
    { value: 1.5, name: '1.5x', color: 'magenta' }
  ];
  
  let currentSpeedIndex = 0;
  let startBar = 0;
  
  const scheduleWithSpeed = () => {
    const speed = speeds[currentSpeedIndex];
    
    console.log(chalk[speed.color](`\n▶ Playing at ${speed.name} speed (${speed.value}x)`));
    console.log(chalk.gray(`  Effective tempo: ${120 * speed.value} BPM`));
    
    // Clear scheduler and add events with new speed
    scheduler.clear();
    scheduler.setPlaybackSpeed(speed.value);
    
    // Convert to events with speed adjustment
    const events = conductor.toSchedulerEvents(composition, startBar, speed.value);
    
    // Add to scheduler
    events.forEach(event => {
      scheduler.addNote({
        bar: event.bar,
        beat: event.beat,
        note: event.note,
        velocity: event.velocity,
        duration: event.duration,
        channel: event.channel
      });
    });
    
    // Set loop
    scheduler.setLoop(8 / speed.value, startBar);
    
    if (!scheduler.isRunning) {
      scheduler.start();
    }
    
    startBar += Math.ceil(8 / speed.value);
  };
  
  // Schedule first playback
  scheduleWithSpeed();
  
  // Set up keyboard controls
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  console.log(chalk.gray('\nControls:'));
  console.log(chalk.gray('  [space] - Next speed'));
  console.log(chalk.gray('  [q]     - Quit'));
  
  // Enable raw mode for single key press
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');
  
  process.stdin.on('data', (key) => {
    if (key === ' ') {
      currentSpeedIndex = (currentSpeedIndex + 1) % speeds.length;
      scheduleWithSpeed();
    } else if (key === 'q' || key === '\u0003') { // q or Ctrl+C
      console.log(chalk.yellow('\n\n👋 Stopping playback...'));
      scheduler.stop();
      scheduler.destroy();
      midiService.close();
      link.disable();
      process.exit(0);
    }
  });
  
}).catch(error => {
  console.error(chalk.red('❌ Error:', error.message));
  process.exit(1);
});
