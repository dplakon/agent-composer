#!/usr/bin/env node

/**
 * Test script to verify immediate continuous generation
 * This tests that the next generation starts immediately after the previous one
 */

import { Conductor } from './src/services/conductor.js';
import chalk from 'chalk';

console.log(chalk.cyan('\n🧪 Testing Immediate Continuous Generation\n'));
console.log('This test verifies that generations start immediately after the previous one.');
console.log('─'.repeat(60));

// Mock API key for testing
const conductor = new Conductor({
  provider: 'openai',
  model: 'gpt-3.5-turbo',
  apiKey: 'test-key'
});

// Track generation timings
let lastGenerationTime = null;
let generationGaps = [];
let generationCount = 0;

// Override the generate method to track timing
const originalGenerate = conductor.generate.bind(conductor);
conductor.generate = async function(options) {
  const startTime = Date.now();
  
  if (lastGenerationTime) {
    const gap = startTime - lastGenerationTime;
    generationGaps.push(gap);
    console.log(chalk.yellow(`\n⏱ Generation #${generationCount + 1} started ${gap}ms after previous completed`));
  } else {
    console.log(chalk.yellow(`\n⏱ Generation #1 started`));
  }
  
  generationCount++;
  
  // Simulate generation time (100-300ms)
  await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
  
  // Return a mock composition
  const mockComposition = {
    metadata: { bars: 8, tempo: 120 },
    tracks: [
      {
        name: 'test',
        notes: [
          { pitch: 60, duration: 4, velocity: 100 },
          { pitch: 62, duration: 4, velocity: 100 }
        ],
        getTotalDuration: function() { return 8; }
      }
    ],
    validate: () => []
  };
  
  lastGenerationTime = Date.now();
  console.log(chalk.green(`✅ Generation #${generationCount} completed (${Date.now() - startTime}ms)`));
  
  return mockComposition;
};

// Start continuous generation
console.log(chalk.cyan('\n📊 Starting continuous generation...\n'));

conductor.startContinuousGeneration({
  style: 'Test',
  tempo: 120,
  barsAhead: 24,  // Generate when less than 24 bars ahead
  playbackSpeed: 1.0
});

// Let it run for a few generations
setTimeout(() => {
  conductor.stopContinuousGeneration();
  
  console.log(chalk.cyan('\n\n📈 Results:\n'));
  console.log('─'.repeat(60));
  console.log(chalk.white(`Total generations: ${generationCount}`));
  
  if (generationGaps.length > 0) {
    const avgGap = generationGaps.reduce((a, b) => a + b, 0) / generationGaps.length;
    const maxGap = Math.max(...generationGaps);
    const minGap = Math.min(...generationGaps);
    
    console.log(chalk.green(`\n✅ Generation gaps:`));
    console.log(`  Average: ${avgGap.toFixed(0)}ms`);
    console.log(`  Min: ${minGap}ms`);
    console.log(`  Max: ${maxGap}ms`);
    
    // Check if generations are immediate (should be < 50ms typically)
    const immediateThreshold = 50;
    const immediateGaps = generationGaps.filter(gap => gap < immediateThreshold);
    const immediatePercentage = (immediateGaps.length / generationGaps.length) * 100;
    
    console.log(chalk.cyan(`\n📊 Immediate generations (<${immediateThreshold}ms): ${immediatePercentage.toFixed(0)}%`));
    
    if (immediatePercentage >= 80) {
      console.log(chalk.green('\n✨ SUCCESS: Generations are starting immediately!'));
      console.log('The system is correctly triggering the next generation right after the previous one completes.');
    } else {
      console.log(chalk.yellow('\n⚠️ WARNING: Some generations have delays.'));
      console.log('This might indicate the old interval-based approach is still being used.');
    }
  }
  
  console.log(chalk.gray('\n📝 Note: In production, generation times will be longer (1-5 seconds)'));
  console.log(chalk.gray('but the gap between completion and next start should remain minimal.\n'));
  
  process.exit(0);
}, 2000);
