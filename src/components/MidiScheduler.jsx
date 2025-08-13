import React, { useState, useEffect, useRef } from 'react';
import { Box, Text, Newline, useApp, useInput } from 'ink';
import Gradient from 'ink-gradient';
import BigText from 'ink-big-text';
import chalk from 'chalk';
import MidiService from '../services/midiService.js';
import MidiScheduler, { EventType } from '../services/midiScheduler.js';
import fs from 'fs';
import path from 'path';

const MidiSchedulerComponent = ({ link, initialPattern = null }) => {
  const [schedulerStatus, setSchedulerStatus] = useState({
    isRunning: false,
    totalEvents: 0,
    eventsExecuted: 0,
    notesPlayed: 0,
    activeNotes: 0,
    pendingEvents: 0,
    loopEnabled: false,
    currentBeat: 0
  });

  const [beatInfo, setBeatInfo] = useState({
    beat: 0,
    phase: 0,
    bpm: 120,
    quantum: 4,
    peers: 0,
    isPlaying: false
  });

  const [midiStatus, setMidiStatus] = useState({
    isConnected: false,
    latencyMs: 0
  });

  const [showHelp, setShowHelp] = useState(false);
  const [selectedPattern, setSelectedPattern] = useState(0);
  const [patterns] = useState([
    'Simple Beat',
    'Chord Progression',
    'Arpeggio',
    'Bass Line',
    'Custom Pattern'
  ]);

  const { exit } = useApp();
  
  // Refs for services
  const midiService = useRef(null);
  const scheduler = useRef(null);

  // Handle keyboard input
  useInput((input, key) => {
    if (input === 'q' || (key.ctrl && input === 'c')) {
      if (scheduler.current) {
        scheduler.current.destroy();
      }
      if (midiService.current) {
        midiService.current.close();
      }
      link.stopUpdate();
      link.disable();
      exit();
    }

    if (input === 'h') {
      setShowHelp(!showHelp);
    }

    // Start/stop scheduler
    if (input === ' ') {
      if (scheduler.current) {
        if (scheduler.current.isRunning) {
          scheduler.current.stop();
        } else {
          scheduler.current.start();
        }
      }
    }

    // Clear events
    if (input === 'c') {
      if (scheduler.current) {
        scheduler.current.clear();
      }
    }

    // Pattern selection
    if (input >= '1' && input <= '5') {
      const patternIndex = parseInt(input) - 1;
      setSelectedPattern(patternIndex);
      loadPresetPattern(patternIndex);
    }

    // Loop toggle
    if (input === 'l') {
      if (scheduler.current) {
        if (scheduler.current.loopLength > 0) {
          scheduler.current.setLoop(0, 0);
        } else {
          // Default 4 bar loop
          scheduler.current.setLoop(16, 0); // 4 bars * 4 beats
        }
      }
    }

    // Latency compensation
    if (input === '[') {
      if (scheduler.current) {
        const newLatency = (midiStatus.latencyMs || 0) - 1;
        scheduler.current.setLatencyCompensation(newLatency);
        setMidiStatus(prev => ({ ...prev, latencyMs: newLatency }));
      }
    }
    if (input === ']') {
      if (scheduler.current) {
        const newLatency = (midiStatus.latencyMs || 0) + 1;
        scheduler.current.setLatencyCompensation(newLatency);
        setMidiStatus(prev => ({ ...prev, latencyMs: newLatency }));
      }
    }

    // Load file
    if (input === 'f') {
      loadPatternFromFile();
    }

    // Export pattern
    if (input === 'e') {
      exportPattern();
    }
  });

  // Load preset patterns
  const loadPresetPattern = (index) => {
    if (!scheduler.current) return;

    scheduler.current.clear();

    switch (index) {
      case 0: // Simple Beat
        scheduler.current.addPattern([
          { note: 60, duration: 0.25 }, // C4
          { note: 64, duration: 0.25 }, // E4
          { note: 67, duration: 0.25 }, // G4
          { note: 64, duration: 0.25 }, // E4
        ], 0);
        scheduler.current.setLoop(4, 0);
        break;

      case 1: // Chord Progression
        // C major
        scheduler.current.addChord({ beat: 0, bar: 0, notes: [60, 64, 67], duration: 2 });
        // A minor
        scheduler.current.addChord({ beat: 2, bar: 0, notes: [57, 60, 64], duration: 2 });
        // F major
        scheduler.current.addChord({ beat: 0, bar: 1, notes: [53, 57, 60], duration: 2 });
        // G major
        scheduler.current.addChord({ beat: 2, bar: 1, notes: [55, 59, 62], duration: 2 });
        scheduler.current.setLoop(8, 0);
        break;

      case 2: // Arpeggio
        const arpNotes = [60, 64, 67, 72, 67, 64]; // C E G C G E
        arpNotes.forEach((note, i) => {
          scheduler.current.addNote({
            beat: i * 0.25,
            bar: 0,
            note,
            duration: 0.25,
            velocity: 80 + (i % 2) * 20
          });
        });
        scheduler.current.setLoop(2, 0);
        break;

      case 3: // Bass Line
        scheduler.current.addPattern([
          { note: 36, duration: 0.5, velocity: 110 }, // C2
          { note: 36, duration: 0.5, velocity: 90 },
          { note: 43, duration: 0.5, velocity: 100 }, // G2
          { note: 43, duration: 0.5, velocity: 90 },
          { note: 41, duration: 0.5, velocity: 100 }, // F2
          { note: 41, duration: 0.5, velocity: 90 },
          { note: 38, duration: 0.5, velocity: 100 }, // D2
          { note: 38, duration: 0.5, velocity: 90 },
        ], 0);
        scheduler.current.setLoop(4, 0);
        break;

      case 4: // Custom Pattern
        // Empty for user to add events
        break;
    }
  };

  // Load pattern from file
  const loadPatternFromFile = async () => {
    try {
      const patternPath = path.join(process.cwd(), 'pattern.json');
      const data = fs.readFileSync(patternPath, 'utf8');
      const pattern = JSON.parse(data);
      
      if (scheduler.current) {
        scheduler.current.loadPattern(pattern);
      }
    } catch (error) {
      console.error('Failed to load pattern:', error.message);
    }
  };

  // Export pattern to file
  const exportPattern = () => {
    if (!scheduler.current) return;
    
    try {
      const pattern = scheduler.current.exportPattern();
      const patternPath = path.join(process.cwd(), 'exported-pattern.json');
      fs.writeFileSync(patternPath, JSON.stringify(pattern, null, 2));
      console.log(`Pattern exported to ${patternPath}`);
    } catch (error) {
      console.error('Failed to export pattern:', error.message);
    }
  };

  // Initialize services
  useEffect(() => {
    // Initialize MIDI service
    midiService.current = new MidiService('Link Scheduler');
    const connected = midiService.current.init();
    setMidiStatus(prev => ({ ...prev, isConnected: connected }));

    // Initialize scheduler
    scheduler.current = new MidiScheduler(midiService.current, link);

    // Listen to scheduler events
    scheduler.current.on('eventExecuted', (event) => {
      // Update stats
      updateSchedulerStatus();
    });

    scheduler.current.on('start', () => {
      updateSchedulerStatus();
    });

    scheduler.current.on('stop', () => {
      updateSchedulerStatus();
    });

    // Load initial pattern if provided
    if (initialPattern) {
      scheduler.current.loadPattern(initialPattern);
    } else {
      // Load default pattern
      loadPresetPattern(0);
    }

    // Cleanup
    return () => {
      if (scheduler.current) {
        scheduler.current.destroy();
      }
      if (midiService.current) {
        midiService.current.close();
      }
    };
  }, []);

  // Update scheduler status
  const updateSchedulerStatus = () => {
    if (scheduler.current) {
      const stats = scheduler.current.getStats();
      setSchedulerStatus(stats);
    }
  };

  // Link update loop
  useEffect(() => {
    let lastBeat = 0;

    link.startUpdate(60, (beat, phase, bpm, playState) => {
      const currentBeat = Math.floor(beat);

      setBeatInfo({
        beat: currentBeat,
        phase,
        bpm,
        quantum: link.quantum,
        peers: link.numPeers,
        isPlaying: link.isPlaying
      });

      // Update scheduler status periodically
      if (currentBeat !== lastBeat) {
        updateSchedulerStatus();
        lastBeat = currentBeat;
      }
    });

    // Enable Link
    link.enable();

    return () => {
      link.stopUpdate();
      link.disable();
    };
  }, [link]);

  // Format event list for display
  const formatEventList = () => {
    if (!scheduler.current || scheduler.current.events.length === 0) {
      return 'No events scheduled';
    }

    const events = scheduler.current.events.slice(0, 5); // Show first 5 events
    return events.map((e, i) => {
      const executed = e.executed ? '✓' : '○';
      const beat = `${e.bar}:${e.beat.toFixed(2)}`;
      const noteStr = e.type === EventType.NOTE_ON ? `Note ${e.note}` : e.type;
      return `${executed} ${beat} ${noteStr}`;
    }).join('\n');
  };

  const normalizedPhase = ((beatInfo.phase % 1) + 1) % 1;
  const phaseBar = '█'.repeat(Math.floor(normalizedPhase * 10)) + '░'.repeat(10 - Math.floor(normalizedPhase * 10));

  return (
    <Box flexDirection="column" padding={1}>
      <Gradient name="rainbow">
        <BigText text="SCHEDULER" font="chrome" />
      </Gradient>

      <Box borderStyle="round" borderColor="cyan" padding={1} flexDirection="column">
        <Text color="cyan" bold>
          MIDI Event Scheduler
        </Text>
        <Newline />

        <Box>
          <Text color="green">Link: </Text>
          <Text color={beatInfo.peers > 0 ? 'greenBright' : 'yellow'}>
            {beatInfo.peers > 0 ? `Connected (${beatInfo.peers} peers)` : 'Waiting...'}
          </Text>
          <Text> | </Text>
          <Text color="magenta">MIDI: </Text>
          <Text color={midiStatus.isConnected ? 'magentaBright' : 'red'}>
            {midiStatus.isConnected ? 'Connected' : 'Failed'}
          </Text>
        </Box>

        <Box>
          <Text color="yellow">Scheduler: </Text>
          <Text color={schedulerStatus.isRunning ? 'greenBright' : 'red'}>
            {schedulerStatus.isRunning ? '▶ Running' : '■ Stopped'}
          </Text>
          <Text> | </Text>
          <Text color="blue">Loop: </Text>
          <Text color={schedulerStatus.loopEnabled ? 'blueBright' : 'gray'}>
            {schedulerStatus.loopEnabled ? 'ON' : 'OFF'}
          </Text>
        </Box>

        <Newline />

        <Box flexDirection="column">
          <Box>
            <Text color="cyan">Beat: </Text>
            <Text color="cyanBright">{beatInfo.beat}</Text>
            <Text> | </Text>
            <Text>{phaseBar}</Text>
          </Box>

          <Box>
            <Text color="magenta">BPM: </Text>
            <Text color="magentaBright">{beatInfo.bpm.toFixed(1)}</Text>
            <Text> | </Text>
            <Text color="yellow">Quantum: </Text>
            <Text color="yellowBright">{beatInfo.quantum}</Text>
          </Box>
        </Box>

        <Newline />

        <Box flexDirection="column">
          <Text color="green" bold>Pattern: {patterns[selectedPattern]}</Text>
          <Text dimColor>Press 1-5 to select pattern</Text>
        </Box>

        <Newline />

        <Box flexDirection="column">
          <Text color="blue" bold>Statistics:</Text>
          <Text>Events: {schedulerStatus.totalEvents} total, {schedulerStatus.pendingEvents} pending</Text>
          <Text>Executed: {schedulerStatus.eventsExecuted} | Notes: {schedulerStatus.notesPlayed}</Text>
          <Text>Active Notes: {schedulerStatus.activeNotes}</Text>
        </Box>
      </Box>

      <Newline />

      <Box borderStyle="single" borderColor="yellow" padding={1}>
        <Box flexDirection="column">
          <Text color="yellow" bold>Event Queue:</Text>
          <Text>{formatEventList()}</Text>
        </Box>
      </Box>

      <Newline />

      {showHelp ? (
        <Box borderStyle="single" borderColor="gray" padding={1}>
          <Box flexDirection="column">
            <Text color="yellow" bold>Controls:</Text>
            <Text>Space     - Start/Stop scheduler</Text>
            <Text>1-5       - Select preset pattern</Text>
            <Text>L         - Toggle loop mode</Text>
            <Text>C         - Clear all events</Text>
            <Text>F         - Load pattern.json</Text>
            <Text>E         - Export current pattern</Text>
            <Text>[/]       - Adjust latency</Text>
            <Text>H         - Toggle help</Text>
            <Text>Q         - Quit</Text>
          </Box>
        </Box>
      ) : (
        <Text dimColor>
          {chalk.gray('Press H for help, Space to start/stop, Q to quit')}
        </Text>
      )}
    </Box>
  );
};

export default MidiSchedulerComponent;
