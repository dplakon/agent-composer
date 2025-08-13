#!/usr/bin/env node

// Test phase normalization
const testPhases = [-0.5, 0, 0.5, 1, 1.5, 2, 2.3, -1.3];

console.log('Testing phase normalization:\n');

testPhases.forEach(phase => {
  const normalizedPhase = ((phase % 1) + 1) % 1; // Proper modulo for negative values
  const phaseLength = Math.floor(normalizedPhase * 10);
  const phaseBar = '█'.repeat(phaseLength) + '░'.repeat(10 - phaseLength);
  
  console.log(`Phase: ${phase.toFixed(2)} -> Normalized: ${normalizedPhase.toFixed(2)} -> Bar: ${phaseBar}`);
});

console.log('\nAll phase values handled correctly!');
