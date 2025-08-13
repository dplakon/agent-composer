#!/usr/bin/env node

// Simple test script to verify abletonlink is working correctly
import AbletonLink from 'abletonlink';

console.log('Testing Ableton Link connection...\n');

const link = new AbletonLink();

// Enable Link
link.enable();
link.enablePlayStateSync();

// Set initial BPM
link.bpm = 120;
link.quantum = 4;

console.log('Link enabled!');
console.log(`Initial BPM: ${link.bpm}`);
console.log(`Quantum: ${link.quantum}`);

let count = 0;
const maxCount = 10;

// Start update loop
link.startUpdate(60, (beat, phase, bpm, playState) => {
    count++;
    
    if (count <= maxCount) {
        console.log(`Beat: ${Math.floor(beat)}, Phase: ${phase.toFixed(2)}, BPM: ${bpm.toFixed(2)}, Peers: ${link.numPeers}`);
    } else {
        // Stop after 10 updates
        link.stopUpdate();
        link.disable();
        console.log('\nTest complete!');
        process.exit(0);
    }
});

console.log('\nMonitoring for 10 updates...\n');
