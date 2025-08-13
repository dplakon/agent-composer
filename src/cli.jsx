#!/usr/bin/env node

import React from 'react';
import { render } from 'ink';
import meow from 'meow';
import AbletonLink from 'abletonlink';
import LinkDisplay from './components/LinkDisplay.jsx';
import LinkDisplayWithControls from './components/LinkDisplayWithControls.jsx';
import LinkDisplayWithMidi from './components/LinkDisplayWithMidi.jsx';

const cli = meow(`
  Usage
    $ ableton-link-cli

  Options
    --bpm, -b      Initial BPM (default: 120)
    --quantum, -q  Quantum/Bar length (default: 4)
    --controls, -c Enable keyboard controls (default: true)
    --midi, -m     Enable MIDI output (default: false)
    --latency, -l  MIDI latency compensation in ms (default: 0)
    --help, -h     Show help
    --version, -v  Show version

  Examples
    $ ableton-link-cli
    $ ableton-link-cli --bpm 128 --quantum 8
    $ ableton-link-cli -b 140 -q 4
    $ ableton-link-cli --midi  # Enable MIDI output

  Info
    This CLI tool connects to Ableton Link and displays
    real-time beat information from any Link-enabled
    application on your network.

    Make sure you have Ableton Live or another Link-enabled
    application running on your network for this tool to
    sync with.
`, {
  importMeta: import.meta,
  flags: {
    bpm: {
      type: 'number',
      shortFlag: 'b',
      default: 120
    },
    quantum: {
      type: 'number',
      shortFlag: 'q',
      default: 4
    },
    controls: {
      type: 'boolean',
      shortFlag: 'c',
      default: true
    },
    midi: {
      type: 'boolean',
      shortFlag: 'm',
      default: false
    },
    latency: {
      type: 'number',
      shortFlag: 'l',
      default: 0
    },
    help: {
      type: 'boolean',
      shortFlag: 'h'
    },
    version: {
      type: 'boolean',
      shortFlag: 'v'
    }
  }
});

// Initialize Ableton Link
const link = new AbletonLink();

// Set initial values from CLI flags
link.bpm = cli.flags.bpm;
link.quantum = cli.flags.quantum;

// Enable play state sync
link.enablePlayStateSync();

// Render the Ink app with the appropriate component
let Component;
let componentProps = { link };

if (cli.flags.midi) {
  Component = LinkDisplayWithMidi;
  componentProps.initialLatency = cli.flags.latency;
} else if (cli.flags.controls) {
  Component = LinkDisplayWithControls;
} else {
  Component = LinkDisplay;
}

const app = render(<Component {...componentProps} />);

// Handle app exit
const handleExit = () => {
  link.stopUpdate();
  link.disable();
  app.unmount();
  process.exit(0);
};

process.on('exit', handleExit);
process.on('SIGINT', handleExit);
process.on('SIGTERM', handleExit);

// Log initial startup message
console.clear();
console.log('🎵 Starting Ableton Link CLI Monitor...\n');
