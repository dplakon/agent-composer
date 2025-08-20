import React, { useState, useEffect, useRef } from 'react';
import { Box, Text, Newline, useApp, useInput } from 'ink';
import TextInput from 'ink-text-input';
import Gradient from 'ink-gradient';
import BigText from 'ink-big-text';
import chalk from 'chalk';
import MidiService from '../services/midiService.js';
import MidiScheduler from '../services/midiScheduler.js';
import Conductor from '../services/conductor.js';

const ConductorComponent = ({ link, apiKey, provider = 'openai', model, initialLatency = 0 }) => {
  const [conductorStatus, setConductorStatus] = useState({
    isGenerating: false,
    generationCount: 0,
    queueSize: 0,
    currentBar: 0,
    lastError: null
  });

  const [schedulerStatus, setSchedulerStatus] = useState({
    isRunning: false,
    totalEvents: 0,
    eventsExecuted: 0,
    notesPlayed: 0,
    playbackSpeed: 1.0,
    latencyMs: initialLatency
  });

  const [beatInfo, setBeatInfo] = useState({
    beat: 0,
    phase: 0,
    bpm: 120,
    quantum: 4,
    peers: 0
  });

  const [showHelp, setShowHelp] = useState(false);
  const [style, setStyle] = useState('Electronic');
  const [autoGenerate, setAutoGenerate] = useState(false);
  const [isEditingStyle, setIsEditingStyle] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [isUsingCustomStyle, setIsUsingCustomStyle] = useState(false);

  const { exit } = useApp();
  
  // Service refs
  const midiService = useRef(null);
  const scheduler = useRef(null);
  const conductor = useRef(null);
  const nextBarToSchedule = useRef(0);

  // Style presets
  const styles = [
    'Electronic',
    'Classical',
    'Jazz',
    'Ambient',
    'Funk',
    'Minimal'
  ];
  let currentStyleIndex = 0;

  // Handle keyboard input
  useInput((input, key) => {
    // Don't process other inputs while editing style
    if (isEditingStyle) {
      if (key.escape) {
        setIsEditingStyle(false);
        setCustomPrompt('');
      }
      return;
    }
    
    if (input === 'q' || (key.ctrl && input === 'c')) {
      cleanup();
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
          if (conductor.current) {
            conductor.current.stopContinuousGeneration();
          }
        } else {
          scheduler.current.start();
          if (autoGenerate && conductor.current) {
            startContinuousGeneration();
          }
        }
      }
    }

    // Generate single composition
    if (input === 'g') {
      generateComposition();
      
      // If auto-generate is on, ensure continuous generation is running
      if (autoGenerate && conductor.current && !conductor.current.continuousGenerationActive) {
        startContinuousGeneration();
      }
    }

    // Toggle auto-generation
    if (input === 'a') {
      const newAutoGenerate = !autoGenerate;
      setAutoGenerate(newAutoGenerate);
      
      if (newAutoGenerate) {
        // Turning ON auto-generation
        if (scheduler.current?.isRunning && conductor.current) {
          startContinuousGeneration();
        }
      } else {
        // Turning OFF auto-generation
        if (conductor.current) {
          conductor.current.stopContinuousGeneration();
        }
      }
    }

    // Clear scheduler
    if (input === 'c') {
      if (scheduler.current) {
        scheduler.current.clear();
        nextBarToSchedule.current = 0;
      }
      if (conductor.current) {
        conductor.current.reset();
      }
    }

    // Change style - now opens text input
    if (input === 's') {
      setIsEditingStyle(true);
      setCustomPrompt(isUsingCustomStyle ? customPrompt : '');
    }
    
    // Quick preset styles (number keys)
    if (input >= '1' && input <= '6') {
      const index = parseInt(input) - 1;
      if (index < styles.length) {
        setStyle(styles[index]);
        setIsUsingCustomStyle(false);
        if (conductor.current) {
          conductor.current.setSystemInjection(`Style: ${styles[index]}`);
        }
      }
    }

    // Set loop
    if (input === 'l') {
      if (scheduler.current) {
        if (scheduler.current.loopLength > 0) {
          scheduler.current.setLoop(0, 0);
        } else {
          scheduler.current.setLoop(32, 0); // 8 bars
        }
      }
    }

    // Playback speed controls
    if (input === '-' || input === '_') {
      if (scheduler.current) {
        const currentSpeed = scheduler.current.getPlaybackSpeed();
        const newSpeed = Math.max(0.1, currentSpeed - 0.1);
        scheduler.current.setPlaybackSpeed(newSpeed);
        updateStatus();
      }
    }
    if (input === '+' || input === '=') {
      if (scheduler.current) {
        const currentSpeed = scheduler.current.getPlaybackSpeed();
        const newSpeed = Math.min(4.0, currentSpeed + 0.1);
        scheduler.current.setPlaybackSpeed(newSpeed);
        updateStatus();
      }
    }
    // Quick speed presets
    if (input === '\\') {
      if (scheduler.current) {
        scheduler.current.setPlaybackSpeed(1.0); // Reset to normal
        updateStatus();
      }
    }
    if (input === '/') {
      if (scheduler.current) {
        const currentSpeed = scheduler.current.getPlaybackSpeed();
        scheduler.current.setPlaybackSpeed(currentSpeed === 0.5 ? 1.0 : 0.5); // Toggle half speed
        updateStatus();
      }
    }
    if (input === '*') {
      if (scheduler.current) {
        const currentSpeed = scheduler.current.getPlaybackSpeed();
        scheduler.current.setPlaybackSpeed(currentSpeed === 2.0 ? 1.0 : 2.0); // Toggle double speed
        updateStatus();
      }
    }

    // Latency compensation controls
    if (input === '[' && !key.shift) {
      if (scheduler.current) {
        const currentLatency = scheduler.current.getLatencyCompensation();
        const newLatency = currentLatency - 1;
        scheduler.current.setLatencyCompensation(newLatency);
        setSchedulerStatus(prev => ({ ...prev, latencyMs: newLatency }));
      }
    }
    if (input === ']' && !key.shift) {
      if (scheduler.current) {
        const currentLatency = scheduler.current.getLatencyCompensation();
        const newLatency = currentLatency + 1;
        scheduler.current.setLatencyCompensation(newLatency);
        setSchedulerStatus(prev => ({ ...prev, latencyMs: newLatency }));
      }
    }
    // Large latency adjustments
    if (key.shift && input === '[') {
      if (scheduler.current) {
        const currentLatency = scheduler.current.getLatencyCompensation();
        const newLatency = currentLatency - 10;
        scheduler.current.setLatencyCompensation(newLatency);
        setSchedulerStatus(prev => ({ ...prev, latencyMs: newLatency }));
      }
    }
    if (key.shift && input === ']') {
      if (scheduler.current) {
        const currentLatency = scheduler.current.getLatencyCompensation();
        const newLatency = currentLatency + 10;
        scheduler.current.setLatencyCompensation(newLatency);
        setSchedulerStatus(prev => ({ ...prev, latencyMs: newLatency }));
      }
    }
    // Reset latency
    if (input === '0') {
      if (scheduler.current) {
        scheduler.current.setLatencyCompensation(0);
        setSchedulerStatus(prev => ({ ...prev, latencyMs: 0 }));
      }
    }
  });

  // Initialize services
  useEffect(() => {
    // Initialize MIDI
    midiService.current = new MidiService('AI Conductor');
    const midiConnected = midiService.current.init();
    
    if (!midiConnected) {
      console.error('❌ Failed to create MIDI port');
    }

    // Initialize scheduler
    scheduler.current = new MidiScheduler(midiService.current, link);
    
    // Set initial latency compensation
    scheduler.current.setLatencyCompensation(initialLatency);

    // Initialize conductor
    if (apiKey) {
      conductor.current = new Conductor({
        provider,
        model: model || (provider === 'openai' ? 'gpt-4-turbo-preview' : 'claude-3-opus-20240229'),
        apiKey,
        temperature: 0.8
      });

      // Listen to conductor events
      conductor.current.on('compositionGenerated', ({ composition, segmentNumber }) => {
        console.log(`📝 Received composition #${segmentNumber}`);
        scheduleComposition(composition);
      });

      conductor.current.on('generationError', (error) => {
        setConductorStatus(prev => ({ ...prev, lastError: error.message }));
      });

      conductor.current.on('scheduleEvents', (events) => {
        // Note: These events should already be speed-adjusted from toSchedulerEvents
        // Add events to scheduler
        events.forEach(event => {
          scheduler.current.addNote({
            bar: event.bar,
            beat: event.beat,
            note: event.note,
            velocity: event.velocity,
            duration: event.duration,
            channel: event.channel
          });
        });
      });
    } else {
      console.warn('⚠️ No API key provided - conductor disabled');
    }

    // Cleanup
    return () => {
      cleanup();
    };
  }, [initialLatency]);

  // Handle custom prompt submission
  const handleCustomPromptSubmit = (value) => {
    if (value.trim()) {
      setCustomPrompt(value);
      setStyle('Custom');
      setIsUsingCustomStyle(true);
      if (conductor.current) {
        conductor.current.setSystemInjection(value);
      }
      console.log(`💉 Custom style injection: ${value}`);
    }
    setIsEditingStyle(false);
  };
  
  // Cleanup function
  const cleanup = () => {
    if (conductor.current) {
      conductor.current.stopContinuousGeneration();
    }
    if (scheduler.current) {
      scheduler.current.destroy();
    }
    if (midiService.current) {
      midiService.current.close();
    }
  };

  // Generate a composition
  const generateComposition = async () => {
    if (!conductor.current) {
      console.error('❌ Conductor not initialized');
      return;
    }

    // Use custom prompt if active, otherwise use preset style
    const stylePrompt = isUsingCustomStyle ? customPrompt : style;
    
    const composition = await conductor.current.generate({
      style: stylePrompt,
      tempo: link.bpm,
      key: 'C major',
      playbackSpeed: scheduler.current?.getPlaybackSpeed ? scheduler.current.getPlaybackSpeed() : 1.0
    });

    if (composition) {
      scheduleComposition(composition);
      
      // Immediately check if we need another generation
      if (autoGenerate && conductor.current.triggerGenerationCheck) {
        conductor.current.triggerGenerationCheck();
      }
    }
  };

  // Schedule a composition
  const scheduleComposition = (composition) => {
    if (!scheduler.current) return;

    // Get current bar position from Link and schedule ahead
    const currentBeat = link.beat || 0;
    const currentBar = Math.floor(currentBeat / link.quantum);
    
    // Schedule events 2 bars ahead to ensure they're in the future
    const startBar = Math.max(nextBarToSchedule.current, currentBar + 2);
    
    // Get current playback speed from scheduler
    const playbackSpeed = scheduler.current.getPlaybackSpeed ? scheduler.current.getPlaybackSpeed() : 1.0;
    
    // Convert to scheduler events with playback speed adjustment
    const events = conductor.current.toSchedulerEvents(composition, startBar, playbackSpeed);
    
    console.log(`🎵 Scheduling ${events.length} events starting at bar ${startBar} (speed: ${playbackSpeed.toFixed(1)}x)`);
    
    // Extract unique channels used in this composition
    const usedChannels = new Set();
    events.forEach(event => {
      usedChannels.add(event.channel || 0);
    });
    const channelsArray = Array.from(usedChannels);
    
    // Schedule safety note-offs at the end of this segment
    // Each composition is 8 bars, but we need to account for playback speed
    // At 0.5x speed, 8 bars of music takes 16 timeline bars to play
    const musicBars = 8; // The composition is always 8 bars of music
    const timelineBarsForSegment = musicBars / playbackSpeed; // How long it takes to play in timeline
    const segmentEndBar = startBar + timelineBarsForSegment;
    const segmentEndBeat = (segmentEndBar * link.quantum) - 0.1; // Slightly before the bar boundary
    
    if (scheduler.current.scheduleSafetyNoteOffs) {
      scheduler.current.scheduleSafetyNoteOffs(segmentEndBeat, channelsArray);
      console.log(`🔒 Scheduled safety note-offs at bar ${segmentEndBar.toFixed(1)} (beat ${segmentEndBeat.toFixed(2)}) for channels: ${channelsArray.join(', ')}`);
    }
    
    // Add to scheduler
    events.forEach(event => {
      scheduler.current.addNote({
        bar: event.bar,
        beat: event.beat,
        note: event.note,
        velocity: event.velocity,
        duration: event.duration,
        channel: event.channel
      });
    });

    // Update next bar position - adjust for playback speed
    // When playing faster, we consume bars quicker
    const timelineBars = 8 / playbackSpeed;  // How many timeline bars this represents
    nextBarToSchedule.current = startBar + timelineBars;
    
    // Update conductor's tracking
    if (conductor.current) {
      conductor.current.currentBar = startBar + timelineBars;
      // Track bars scheduled for continuous generation
      if (conductor.current.continuousGenerationActive) {
        conductor.current.barsScheduled = (conductor.current.barsScheduled || 0) + timelineBars;
        console.log(`📊 Buffer: ${conductor.current.barsScheduled.toFixed(1)} timeline bars`);
      }
    }

    // If scheduler is not running, start it
    if (!scheduler.current.isRunning) {
      scheduler.current.start();
    }

    updateStatus();
    
    // Trigger next generation immediately if auto-generate is on
    if (autoGenerate && conductor.current && conductor.current.triggerGenerationCheck) {
      conductor.current.triggerGenerationCheck();
    }
  };

  // Start continuous generation
  const startContinuousGeneration = () => {
    if (!conductor.current) return;

    // Use custom prompt if active, otherwise use preset style
    const stylePrompt = isUsingCustomStyle ? customPrompt : style;
    const playbackSpeed = scheduler.current?.getPlaybackSpeed ? scheduler.current.getPlaybackSpeed() : 1.0;
    
    // Initialize bars scheduled based on what's already queued
    const currentBeat = link.beat || 0;
    const currentBar = Math.floor(currentBeat / 4);
    const barsAlreadyScheduled = Math.max(0, nextBarToSchedule.current - currentBar);
    
    conductor.current.startContinuousGeneration({
      style: stylePrompt,
      tempo: link.bpm,
      playbackSpeed: playbackSpeed
    });
    
    // Set initial buffer if we have bars already scheduled
    if (barsAlreadyScheduled > 0) {
      conductor.current.barsScheduled = barsAlreadyScheduled;
    }
  };

  // Update status
  const updateStatus = () => {
    if (scheduler.current) {
      const stats = scheduler.current.getStats();
      const playbackSpeed = scheduler.current.getPlaybackSpeed();
      const latencyMs = scheduler.current.getLatencyCompensation();
      setSchedulerStatus({
        ...stats,
        playbackSpeed,
        latencyMs
      });
    }

    if (conductor.current) {
      const stats = conductor.current.getStats();
      setConductorStatus(prev => ({
        ...prev,
        ...stats
      }));
    }
  };

  // Link update loop
  useEffect(() => {
    let lastBeat = 0;
    let lastBarPlayed = 0;

    link.startUpdate(60, (beat, phase, bpm) => {
      const currentBeat = Math.floor(beat);
      const currentBar = Math.floor(currentBeat / 4);

      setBeatInfo({
        beat: currentBeat,
        phase,
        bpm,
        quantum: link.quantum,
        peers: link.numPeers
      });

      // Update status periodically
      if (currentBeat !== lastBeat) {
        updateStatus();
        
        // Track bar consumption
        if (currentBar > lastBarPlayed && conductor.current && autoGenerate) {
          const barsConsumed = currentBar - lastBarPlayed;
          conductor.current.consumeBars(barsConsumed);
          lastBarPlayed = currentBar;
        }
        
        lastBeat = currentBeat;
      }
    });

    link.enable();

    return () => {
      link.stopUpdate();
      link.disable();
    };
  }, [link, autoGenerate, style]);

  const normalizedPhase = ((beatInfo.phase % 1) + 1) % 1;
  const phaseBar = '█'.repeat(Math.floor(normalizedPhase * 10)) + '░'.repeat(10 - Math.floor(normalizedPhase * 10));

  return (
    <Box flexDirection="column" padding={1}>
      <Gradient name="rainbow">
        <BigText text="AI CONDUCTOR" font="chrome" />
      </Gradient>

      <Box borderStyle="round" borderColor="cyan" padding={1} flexDirection="column">
        <Text color="cyan" bold>
          LLM Music Generator + MIDI Scheduler
        </Text>
        <Newline />

        <Box>
          <Text color="green">Provider: </Text>
          <Text color="greenBright">{provider}</Text>
          <Text> | </Text>
          <Text color="yellow">Style: </Text>
          <Text color="yellowBright">{style}</Text>
        </Box>

        <Box>
          <Text color="magenta">Auto-Gen: </Text>
          <Text color={autoGenerate ? 'magentaBright' : 'gray'}>
            {autoGenerate ? 'ON' : 'OFF'}
          </Text>
          <Text> | </Text>
          <Text color="blue">Scheduler: </Text>
          <Text color={schedulerStatus.isRunning ? 'blueBright' : 'red'}>
            {schedulerStatus.isRunning ? '▶ Running' : '■ Stopped'}
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
            <Text color="yellow">Bars Queued: </Text>
            <Text color="yellowBright">{nextBarToSchedule.current}</Text>
          </Box>

          <Box>
            <Text color="cyan">Speed: </Text>
            <Text color={schedulerStatus.playbackSpeed === 1.0 ? 'cyanBright' : 'yellowBright'}>
              {schedulerStatus.playbackSpeed.toFixed(1)}x
            </Text>
            <Text> | </Text>
            <Text color="green">Effective BPM: </Text>
            <Text color="greenBright">
              {(beatInfo.bpm * schedulerStatus.playbackSpeed).toFixed(1)}
            </Text>
            <Text dimColor> (MIDI tempo)</Text>
          </Box>
          
          <Box>
            <Text color="blue">Latency: </Text>
            <Text color={schedulerStatus.latencyMs === 0 ? 'blueBright' : 'yellowBright'}>
              {schedulerStatus.latencyMs > 0 ? '+' : ''}{schedulerStatus.latencyMs}ms
            </Text>
            <Text dimColor> {schedulerStatus.latencyMs < 0 ? '(notes play earlier)' : schedulerStatus.latencyMs > 0 ? '(notes play later)' : '(no compensation)'}</Text>
          </Box>
        </Box>

        <Newline />

        <Box flexDirection="column">
          <Text color="green" bold>Conductor Status:</Text>
          <Text>Generations: {conductorStatus.generationCount}</Text>
          <Text>Queue: {conductorStatus.queueSize} segments</Text>
          <Text>Current Bar: {conductorStatus.currentBar}</Text>
          <Text>Bars Scheduled: {conductorStatus.barsScheduled?.toFixed(1) || '0'}</Text>
          {conductorStatus.isGenerating && (
            <Text color="yellow">⏳ Generating...</Text>
          )}
          {conductorStatus.lastError && (
            <Text color="red">Error: {conductorStatus.lastError}</Text>
          )}
        </Box>

        <Newline />

        <Box flexDirection="column">
          <Text color="blue" bold>Scheduler Status:</Text>
          <Text>Events: {schedulerStatus.totalEvents}</Text>
          <Text>Executed: {schedulerStatus.eventsExecuted}</Text>
          <Text>Notes Played: {schedulerStatus.notesPlayed}</Text>
        </Box>
      </Box>

      <Newline />
      
      {isEditingStyle && (
        <Box borderStyle="double" borderColor="cyan" padding={1} flexDirection="column">
          <Text color="cyan" bold>Enter custom style prompt:</Text>
          <Text dimColor>Press Enter to submit, Esc to cancel</Text>
          <Newline />
          <TextInput
            value={customPrompt}
            onChange={setCustomPrompt}
            onSubmit={handleCustomPromptSubmit}
            placeholder="e.g., 'Dark ambient with glitchy drums and ethereal pads'"
          />
        </Box>
      )}

      {!apiKey && (
        <Box borderStyle="single" borderColor="red" padding={1}>
          <Text color="red">
            ⚠️ No API key provided! Set OPENAI_API_KEY or ANTHROPIC_API_KEY environment variable.
          </Text>
        </Box>
      )}

      {showHelp ? (
        <Box borderStyle="single" borderColor="gray" padding={1}>
          <Box flexDirection="column">
            <Text color="yellow" bold>Controls:</Text>
            <Text key="space">Space     - Start/Stop scheduler</Text>
            <Text key="g">G         - Generate single composition</Text>
            <Text key="a">A         - Toggle auto-generation</Text>
            <Text key="s">S         - Enter custom style prompt</Text>
            <Text key="nums">1-6       - Quick select preset styles</Text>
            <Text key="l">L         - Toggle loop mode</Text>
            <Text key="c">C         - Clear and reset</Text>
            <Text key="plus">+/-       - Adjust playback speed</Text>
            <Text key="backslash">\         - Reset speed to 1.0x</Text>
            <Text key="slash">/         - Toggle half speed (0.5x)</Text>
            <Text key="star">*         - Toggle double speed (2.0x)</Text>
            <Text key="bracket">[/]       - Adjust latency (±1ms)</Text>
            <Text key="shift-bracket">Shift+[/] - Adjust latency (±10ms)</Text>
            <Text key="zero">0         - Reset latency to 0ms</Text>
            <Text key="h">H         - Toggle help</Text>
            <Text key="q">Q         - Quit</Text>
            <Newline />
            <Text color="cyan">Preset Styles: {styles.join(', ')}</Text>
            {isUsingCustomStyle && (
              <Text color="magenta">Custom: {customPrompt.substring(0, 50)}...</Text>
            )}
          </Box>
        </Box>
      ) : (
        <Text dimColor>
          {chalk.gray('Press H for help, G to generate, A for auto-gen, Q to quit')}
        </Text>
      )}
    </Box>
  );
};

export default ConductorComponent;
