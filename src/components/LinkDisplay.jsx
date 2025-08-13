import React, { useState, useEffect } from 'react';
import { Box, Text, Newline, useApp } from 'ink';
import Gradient from 'ink-gradient';
import BigText from 'ink-big-text';
import chalk from 'chalk';

const LinkDisplay = ({ link }) => {
  const [beatInfo, setBeatInfo] = useState({
    beat: 0,
    phase: 0,
    bpm: 120,
    quantum: 4,
    peers: 0,
    isPlaying: false
  });
  
  const [pulseAnimation, setPulseAnimation] = useState(false);
  const { exit } = useApp();

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
        isPlaying: playState
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

  // Handle keyboard input for exit
  useEffect(() => {
    const handleExit = () => {
      link.stopUpdate();
      link.disable();
      exit();
    };

    process.on('SIGINT', handleExit);
    process.on('SIGTERM', handleExit);

    return () => {
      process.removeListener('SIGINT', handleExit);
      process.removeListener('SIGTERM', handleExit);
    };
  }, [link, exit]);

  const beatIndicator = pulseAnimation ? '●' : '○';
  // Normalize phase to 0-1 range (phase can be > 1 or < 0 from Ableton Link)
  const normalizedPhase = ((beatInfo.phase % 1) + 1) % 1;
  const phaseBar = '█'.repeat(Math.floor(normalizedPhase * 10)) + '░'.repeat(10 - Math.floor(normalizedPhase * 10));
  
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
          </Box>
          
          <Box>
            <Text color="cyan" bold>Beat: </Text>
            <Text color="cyanBright" bold>
              {beatInfo.beat} {beatIndicator}
            </Text>
          </Box>
          
          <Box>
            <Text color="yellow" bold>Phase: </Text>
            <Text>{phaseBar} {(normalizedPhase * 100).toFixed(1)}%</Text>
          </Box>
          
          <Box>
            <Text color="blue" bold>Quantum: </Text>
            <Text color="blueBright">{beatInfo.quantum}</Text>
          </Box>
          
          <Box>
            <Text color="green" bold>Playing: </Text>
            <Text color={beatInfo.isPlaying ? 'greenBright' : 'red'}>
              {beatInfo.isPlaying ? '▶ Playing' : '■ Stopped'}
            </Text>
          </Box>
        </Box>
        
        <Newline />
        
        <Box>
          <Text dimColor>
            {chalk.gray('Press Ctrl+C to exit')}
          </Text>
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
    </Box>
  );
};

export default LinkDisplay;
