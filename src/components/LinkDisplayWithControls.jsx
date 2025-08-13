import React, { useState, useEffect } from 'react';
import { Box, Text, Newline, useApp, useInput } from 'ink';
import Gradient from 'ink-gradient';
import BigText from 'ink-big-text';
import chalk from 'chalk';

const LinkDisplayWithControls = ({ link }) => {
  const [beatInfo, setBeatInfo] = useState({
    beat: 0,
    phase: 0,
    bpm: 120,
    quantum: 4,
    peers: 0,
    isPlaying: false
  });
  
  const [pulseAnimation, setPulseAnimation] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const { exit } = useApp();

  // Handle keyboard input
  useInput((input, key) => {
    if (input === 'q' || (key.ctrl && input === 'c')) {
      link.stopUpdate();
      link.disable();
      exit();
    }
    
    if (input === 'h') {
      setShowHelp(!showHelp);
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
    }
    
    // Reset beat
    if (input === 'r') {
      link.setBeatForce(0);
    }
  });

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
  }, [link]);

  const beatIndicator = pulseAnimation ? '●' : '○';
  // Normalize phase to 0-1 range (phase can be > 1 or < 0 from Ableton Link)
  const normalizedPhase = ((beatInfo.phase % 1) + 1) % 1;
  const phaseLength = Math.floor(normalizedPhase * 10);
  const phaseBar = '█'.repeat(phaseLength) + '░'.repeat(10 - phaseLength);
  
  return (
    <Box flexDirection="column" padding={1}>
      <Gradient name="rainbow">
        <BigText text="LINK" font="chrome" />
      </Gradient>
      
      <Box borderStyle="round" borderColor="cyan" padding={1} flexDirection="column">
        <Text color="cyan" bold>
          Ableton Link Beat Monitor
        </Text>
        <Newline />
        
        <Box>
          <Text color="green">Status: </Text>
          <Text color={beatInfo.peers > 0 ? 'greenBright' : 'yellow'}>
            {beatInfo.peers > 0 ? `Connected (${beatInfo.peers} peers)` : 'Waiting for peers...'}
          </Text>
        </Box>
        
        <Newline />
        
        <Box flexDirection="column">
          <Box>
            <Text color="magenta" bold>BPM: </Text>
            <Text color="magentaBright" bold>
              {beatInfo.bpm.toFixed(2)}
            </Text>
            <Text dimColor> {chalk.gray('(↑/↓ to adjust, Shift for ±10)')}</Text>
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
      
      {showHelp ? (
        <Box borderStyle="single" borderColor="gray" padding={1}>
          <Box flexDirection="column">
            <Text color="yellow" bold>Keyboard Controls:</Text>
            <Text>↑/↓       - Adjust BPM (±1)</Text>
            <Text>Shift+↑/↓ - Adjust BPM (±10)</Text>
            <Text>←/→       - Adjust Quantum</Text>
            <Text>Space     - Play/Stop</Text>
            <Text>R         - Reset Beat</Text>
            <Text>H         - Toggle Help</Text>
            <Text>Q         - Quit</Text>
          </Box>
        </Box>
      ) : (
        <Text dimColor>
          {chalk.gray('Press H for help, Q to quit')}
        </Text>
      )}
    </Box>
  );
};

export default LinkDisplayWithControls;
