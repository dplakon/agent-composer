import React, { useState, useEffect, useRef } from 'react';
import { Box, Text, Newline, useApp, useInput } from 'ink';
import Gradient from 'ink-gradient';
import BigText from 'ink-big-text';
import chalk from 'chalk';
import MidiService from '../services/midiService.js';

const LinkDisplayWithMidi = ({ link, initialLatency = 0 }) => {
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
    lastNote: null,
    notesPlayed: 0,
    latencyMs: 0
  });
  
  const [pulseAnimation, setPulseAnimation] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [midiEnabled, setMidiEnabled] = useState(true);
  const { exit } = useApp();
  
  // Use refs to track state across update callbacks
  const midiService = useRef(null);
  const lastQuarterNote = useRef(-1);

  // Handle keyboard input
  useInput((input, key) => {
    if (input === 'q' || (key.ctrl && input === 'c')) {
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
    
    if (input === 'm') {
      setMidiEnabled(!midiEnabled);
      if (!midiEnabled && midiService.current) {
        midiService.current.init();
      }
    }
    
    // BPM controls
    if (key.upArrow) {
      link.bpm = Math.min(link.bpm + 1, 300);
    }
    if (key.downArrow) {
      link.bpm = Math.max(link.bpm - 1, 20);
    }
    if (key.shift && key.upArrow) {
      link.bpm = Math.min(link.bpm + 10, 300);
    }
    if (key.shift && key.downArrow) {
      link.bpm = Math.max(link.bpm - 10, 20);
    }
    
    // Quantum controls
    if (key.rightArrow) {
      link.quantum = Math.min(link.quantum + 1, 16);
    }
    if (key.leftArrow) {
      link.quantum = Math.max(link.quantum - 1, 1);
    }
    
    // Play/Stop toggle
    if (input === ' ') {
      link.isPlaying = !link.isPlaying;
      
      // Send MIDI start/stop
      if (midiService.current && midiService.current.isConnected) {
        if (link.isPlaying) {
          midiService.current.sendStart();
        } else {
          midiService.current.sendStop();
        }
      }
    }
    
    // Reset beat
    if (input === 'r') {
      link.setBeatForce(0);
      lastQuarterNote.current = -1;
    }
    
    // Change MIDI note
    if (input >= '1' && input <= '8') {
      const noteMap = {
        '1': 'C4',
        '2': 'D4',
        '3': 'E4',
        '4': 'F4',
        '5': 'G4',
        '6': 'A4',
        '7': 'B4',
        '8': 'C5'
      };
      if (midiService.current) {
        midiService.current.setNote(noteMap[input]);
      }
    }
    
    // Latency compensation controls
    if (input === '[') {
      // Decrease latency (send notes earlier)
      if (midiService.current) {
        const newLatency = midiService.current.getLatencyCompensation() - 1;
        midiService.current.setLatencyCompensation(newLatency);
        setMidiStatus(prev => ({ ...prev, latencyMs: newLatency }));
      }
    }
    if (input === ']') {
      // Increase latency (send notes later)
      if (midiService.current) {
        const newLatency = midiService.current.getLatencyCompensation() + 1;
        midiService.current.setLatencyCompensation(newLatency);
        setMidiStatus(prev => ({ ...prev, latencyMs: newLatency }));
      }
    }
    if (key.shift && input === '[') {
      // Large decrease (-10ms)
      if (midiService.current) {
        const newLatency = midiService.current.getLatencyCompensation() - 10;
        midiService.current.setLatencyCompensation(newLatency);
        setMidiStatus(prev => ({ ...prev, latencyMs: newLatency }));
      }
    }
    if (key.shift && input === ']') {
      // Large increase (+10ms)
      if (midiService.current) {
        const newLatency = midiService.current.getLatencyCompensation() + 10;
        midiService.current.setLatencyCompensation(newLatency);
        setMidiStatus(prev => ({ ...prev, latencyMs: newLatency }));
      }
    }
    if (input === '0') {
      // Reset latency compensation to 0
      if (midiService.current) {
        midiService.current.setLatencyCompensation(0);
        setMidiStatus(prev => ({ ...prev, latencyMs: 0 }));
      }
    }
  });

  // Initialize MIDI service
  useEffect(() => {
    midiService.current = new MidiService('Ableton Link CLI');
    
    // Set initial latency compensation
    midiService.current.setLatencyCompensation(initialLatency);
    setMidiStatus(prev => ({ ...prev, latencyMs: initialLatency }));
    
    if (midiEnabled) {
      const connected = midiService.current.init();
      setMidiStatus(prev => ({ ...prev, isConnected: connected, latencyMs: initialLatency }));
    }
    
    return () => {
      if (midiService.current) {
        midiService.current.close();
      }
    };
  }, []);

  useEffect(() => {
    // Start the update loop
    let lastBeat = 0;
    
    link.startUpdate(60, (beat, phase, bpm, playState) => {
      const currentBeat = Math.floor(beat);
      
      // Trigger pulse animation on beat change
      if (currentBeat !== lastBeat) {
        setPulseAnimation(true);
        setTimeout(() => setPulseAnimation(false), 100);
        lastBeat = currentBeat;
      }
      
      // Send MIDI note on quarter notes (every beat)
      if (midiEnabled && midiService.current && midiService.current.isConnected) {
        const quarterNote = Math.floor(beat);
        
        // Check if we've moved to a new quarter note
        if (quarterNote !== lastQuarterNote.current) {
          lastQuarterNote.current = quarterNote;
          
          // Calculate how far we are into the current beat
          const beatFraction = beat - quarterNote;
          
          // If we just crossed into a new beat and we're very close to the boundary,
          // we might need to compensate for processing delay
          const compensationMs = midiService.current.getLatencyCompensation();
          
          if (compensationMs < 0) {
            // Negative compensation: predict the next beat and schedule it early
            // This helps when the CLI appears delayed compared to Ableton
            const msUntilNextBeat = ((1 - beatFraction) * 60000) / bpm;
            const scheduleAheadMs = msUntilNextBeat + compensationMs;
            
            if (scheduleAheadMs > 0) {
              // Schedule the next beat's note
              setTimeout(() => {
                midiService.current.sendNote(midiService.current.currentNote, 100, 100);
              }, scheduleAheadMs);
            } else {
              // Send immediately
              midiService.current.sendNote(midiService.current.currentNote, 100, 100);
            }
          } else {
            // Positive compensation or zero: delay the note
            midiService.current.sendNote(midiService.current.currentNote, 100, 100);
          }
          
          setMidiStatus(prev => ({
            ...prev,
            lastNote: `Note ${midiService.current.currentNote} at beat ${quarterNote}`,
            notesPlayed: prev.notesPlayed + 1
          }));
        }
        
        // Send MIDI clock (24 ppq)
        // Link updates at 60fps, so we need to calculate when to send clock
        const clocksPerBeat = 24;
        const beatsPerSecond = bpm / 60;
        const clocksPerSecond = clocksPerBeat * beatsPerSecond;
        const framesPerClock = 60 / clocksPerSecond;
        
        if (Math.floor(beat * clocksPerBeat) !== Math.floor((beat - 1/60) * clocksPerBeat)) {
          midiService.current.sendClock();
        }
      }
      
      setBeatInfo({
        beat: currentBeat,
        phase,
        bpm,
        quantum: link.quantum,
        peers: link.numPeers,
        isPlaying: link.isPlaying
      });
    });

    // Enable Link
    link.enable();
    
    // Handle cleanup
    return () => {
      link.stopUpdate();
      link.disable();
    };
  }, [link, midiEnabled]);

  const beatIndicator = pulseAnimation ? '●' : '○';
  // Normalize phase to 0-1 range
  const normalizedPhase = ((beatInfo.phase % 1) + 1) % 1;
  const phaseLength = Math.floor(normalizedPhase * 10);
  const phaseBar = '█'.repeat(phaseLength) + '░'.repeat(10 - phaseLength);
  
  const noteNames = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'];
  const currentNoteName = midiService.current ? 
    noteNames.find(name => midiService.current.notes[name] === midiService.current.currentNote) || 'C4' : 
    'C4';
  
  return (
    <Box flexDirection="column" padding={1}>
      <Gradient name="rainbow">
        <BigText text="LINK+MIDI" font="chrome" />
      </Gradient>
      
      <Box borderStyle="round" borderColor="cyan" padding={1} flexDirection="column">
        <Text color="cyan" bold>
          Ableton Link Beat Monitor with MIDI
        </Text>
        <Newline />
        
        <Box>
          <Text color="green">Link Status: </Text>
          <Text color={beatInfo.peers > 0 ? 'greenBright' : 'yellow'}>
            {beatInfo.peers > 0 ? `Connected (${beatInfo.peers} peers)` : 'Waiting for peers...'}
          </Text>
        </Box>
        
        <Box>
          <Text color="magenta">MIDI Status: </Text>
          <Text color={midiStatus.isConnected ? 'magentaBright' : 'red'}>
            {midiStatus.isConnected ? '✓ Virtual Port Active' : '✗ Not Connected'}
          </Text>
          {midiEnabled && (
            <Text dimColor> {chalk.gray(`(${midiStatus.notesPlayed} notes sent)`)}</Text>
          )}
        </Box>
        
        <Newline />
        
        <Box flexDirection="column">
          <Box>
            <Text color="magenta" bold>BPM: </Text>
            <Text color="magentaBright" bold>
              {beatInfo.bpm.toFixed(2)}
            </Text>
            <Text dimColor> {chalk.gray('(↑/↓ to adjust)')}</Text>
          </Box>
          
          <Box>
            <Text color="cyan" bold>Beat: </Text>
            <Text color="cyanBright" bold>
              {beatInfo.beat} {beatIndicator}
            </Text>
            <Text dimColor> {chalk.gray('(R to reset)')}</Text>
          </Box>
          
          <Box>
            <Text color="yellow" bold>Phase: </Text>
            <Text>{phaseBar} {(normalizedPhase * 100).toFixed(1)}%</Text>
          </Box>
          
          <Box>
            <Text color="blue" bold>Quantum: </Text>
            <Text color="blueBright">{beatInfo.quantum}</Text>
            <Text dimColor> {chalk.gray('(←/→ to adjust)')}</Text>
          </Box>
          
          <Box>
            <Text color="green" bold>Playing: </Text>
            <Text color={beatInfo.isPlaying ? 'greenBright' : 'red'}>
              {beatInfo.isPlaying ? '▶ Playing' : '■ Stopped'}
            </Text>
            <Text dimColor> {chalk.gray('(Space to toggle)')}</Text>
          </Box>
          
          <Box>
            <Text color="magenta" bold>MIDI Note: </Text>
            <Text color="magentaBright">{currentNoteName}</Text>
            <Text dimColor> {chalk.gray('(1-8 to change)')}</Text>
          </Box>
          
          <Box>
            <Text color="yellow" bold>Latency: </Text>
            <Text color={midiStatus.latencyMs === 0 ? 'white' : midiStatus.latencyMs < 0 ? 'cyan' : 'yellow'}>
              {midiStatus.latencyMs > 0 ? '+' : ''}{midiStatus.latencyMs}ms
            </Text>
            <Text dimColor> {chalk.gray('([/] to adjust, 0 to reset)')}</Text>
          </Box>
        </Box>
      </Box>
      
      <Newline />
      
      <Box flexDirection="column">
        <Text dimColor>
          {chalk.gray('Beat Grid:')}
        </Text>
        <Text>
          {Array.from({ length: beatInfo.quantum }, (_, i) => {
            const isCurrent = i === (beatInfo.beat % beatInfo.quantum);
            return isCurrent ? chalk.bgCyan.black(` ${i + 1} `) : chalk.gray(` ${i + 1} `);
          }).join(' ')}
        </Text>
      </Box>
      
      <Newline />
      
      <Box borderStyle="single" borderColor="magenta" padding={1}>
        <Box flexDirection="column">
          <Text color="magenta" bold>MIDI Output: "Ableton Link CLI"</Text>
          <Text dimColor>Configure this as MIDI input in Ableton Live</Text>
          {midiStatus.lastNote && (
            <Text dimColor>{chalk.gray(`Last: ${midiStatus.lastNote}`)}</Text>
          )}
        </Box>
      </Box>
      
      <Newline />
      
      {showHelp ? (
        <Box borderStyle="single" borderColor="gray" padding={1}>
          <Box flexDirection="column">
            <Text color="yellow" bold>Keyboard Controls:</Text>
            <Text>↑/↓       - Adjust BPM (±1)</Text>
            <Text>Shift+↑/↓ - Adjust BPM (±10)</Text>
            <Text>←/→       - Adjust Quantum</Text>
            <Text>Space     - Play/Stop</Text>
            <Text>R         - Reset Beat</Text>
            <Text>M         - Toggle MIDI</Text>
            <Text>1-8       - Change MIDI Note (C4-C5)</Text>
            <Text>[/]       - Adjust Latency (±1ms)</Text>
            <Text>Shift+[/] - Adjust Latency (±10ms)</Text>
            <Text>0         - Reset Latency to 0ms</Text>
            <Text>H         - Toggle Help</Text>
            <Text>Q         - Quit</Text>
          </Box>
        </Box>
      ) : (
        <Text dimColor>
          {chalk.gray('Press H for help, M to toggle MIDI, Q to quit')}
        </Text>
      )}
    </Box>
  );
};

export default LinkDisplayWithMidi;
