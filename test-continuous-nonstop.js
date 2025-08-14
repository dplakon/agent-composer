#!/usr/bin/env node

/**
 * Test continuous generation doesn't stop prematurely
 * Simulates real playback with speed = 0.5x
 */

import { Conductor } from './src/services/conductor.js';
import chalk from 'chalk';

console.log(chalk.cyan('\n🎼 Testing Continuous Generation (Non-stop)\n'));
console.log('Testing that generation continues indefinitely at 0.5x speed');
console.log('─'.repeat(60));

// Create conductor
const conductor = new Conductor({
  provider: 'openai',
  model: 'gpt-3.5-turbo',
  apiKey: 'test-key'
});

let generationCount = 0;
const targetGenerations = 6;  // We want at least 6 continuous generations

// Mock the generate method
conductor.generate = async function(options) {
  generationCount++;
  
  console.log(chalk.yellow(`\n[Gen ${generationCount}] Starting generation...`));
  console.log(chalk.gray(`  Current buffer: ${(this.barsScheduled || 0).toFixed(1)} timeline bars`));
  
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 300));
  
  // Return mock composition
  const composition = {
    metadata: { bars: 8, tempo: 120 },
    tracks: [
      {
        name: 'test',
        notes: Array(8).fill({ pitch: 60, duration: 1, velocity: 100 }),
        getTotalDuration: function() { return 8; }
      }
    ],
    validate: () => []
  };
  
  this.currentComposition = composition;
  this.compositionHistory.push(composition);
  this.generationCount = generationCount;
  
  this.emit('compositionGenerated', {
    composition,
    generationTime: 0.3,
    segmentNumber: generationCount
  });
  
  console.log(chalk.green(`[Gen ${generationCount}] ✅ Complete`));
  
  return composition;
}.bind(conductor);

// Start continuous generation at 0.5x speed
console.log(chalk.cyan('\n📊 Starting continuous generation at 0.5x speed\n'));

conductor.startContinuousGeneration({
  style: 'Test',
  tempo: 120,
  playbackSpeed: 0.5  // This is the critical test - at 0.5x speed
});

// Simulate playback consumption
let totalBarsPlayed = 0;
let iterations = 0;
const maxIterations = 20;

const consumptionInterval = setInterval(() => {
  iterations++;
  
  // At 0.5x speed, we consume bars at half rate
  // Simulate 1 timeline bar consumed every interval
  const barsToConsume = 1;
  totalBarsPlayed += barsToConsume;
  
  conductor.consumeBars(barsToConsume);
  
  const stats = conductor.getStats();
  console.log(chalk.blue(`\n[Tick ${iterations}] Played: ${totalBarsPlayed} bars | Buffer: ${stats.barsScheduled.toFixed(1)} bars | Generations: ${generationCount}`));
  
  // Check if we've hit our target or max iterations
  if (generationCount >= targetGenerations || iterations >= maxIterations) {
    clearInterval(consumptionInterval);
    conductor.stopContinuousGeneration();
    
    // Print results
    console.log(chalk.cyan('\n\n📈 Test Results:\n'));
    console.log('─'.repeat(60));
    
    console.log(chalk.white(`Total generations: ${generationCount}`));
    console.log(chalk.white(`Timeline bars played: ${totalBarsPlayed}`));
    console.log(chalk.white(`Final buffer: ${stats.barsScheduled.toFixed(1)} bars`));
    console.log(chalk.white(`Playback speed: 0.5x\n`));
    
    if (generationCount >= targetGenerations) {
      console.log(chalk.green(`✅ SUCCESS: Generated ${generationCount} compositions continuously!`));
      console.log(chalk.green('   The system correctly maintains continuous generation at 0.5x speed.'));
    } else {
      console.log(chalk.red(`❌ FAILURE: Only generated ${generationCount} compositions`));
      console.log(chalk.red(`   Expected at least ${targetGenerations} generations`));
      console.log(chalk.yellow('\n⚠️  The system stopped generating prematurely'));
    }
    
    // Analysis
    const barsPerGeneration = 16;  // At 0.5x speed, 8 music bars = 16 timeline bars
    const expectedBuffer = (generationCount * barsPerGeneration) - totalBarsPlayed;
    
    console.log(chalk.cyan('\n📊 Analysis:'));
    console.log(`  Each generation at 0.5x speed: 16 timeline bars`);
    console.log(`  Total bars generated: ${generationCount * 16}`);
    console.log(`  Total bars consumed: ${totalBarsPlayed}`);
    console.log(`  Expected buffer: ${expectedBuffer} bars`);
    console.log(`  Actual buffer: ${stats.barsScheduled.toFixed(1)} bars`);
    
    if (Math.abs(expectedBuffer - stats.barsScheduled) < 2) {
      console.log(chalk.green('\n✅ Bar tracking is accurate!'));
    } else {
      console.log(chalk.yellow(`\n⚠️ Bar tracking mismatch: ${Math.abs(expectedBuffer - stats.barsScheduled).toFixed(1)} bars difference`));
    }
    
    process.exit(generationCount >= targetGenerations ? 0 : 1);
  }
}, 500);  // Check every 500ms
