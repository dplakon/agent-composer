#!/usr/bin/env node

import Conductor from './src/services/Conductor.js';
import chalk from 'chalk';

console.log(chalk.cyan('🎵 Testing AI Conductor Service...\n'));

// Test configuration
const testConfig = {
  provider: process.env.CONDUCTOR_PROVIDER || 'openai',
  apiKey: process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY,
  model: process.env.CONDUCTOR_MODEL
};

if (!testConfig.apiKey) {
  console.error(chalk.red('❌ No API key found!'));
  console.log(chalk.yellow('Please set either OPENAI_API_KEY or ANTHROPIC_API_KEY environment variable.'));
  process.exit(1);
}

console.log(chalk.green('✓ Configuration:'));
console.log(`  Provider: ${testConfig.provider}`);
console.log(`  Model: ${testConfig.model || 'default'}`);
console.log(`  API Key: ${testConfig.apiKey.substring(0, 10)}...`);

// Initialize conductor
const conductor = new Conductor({
  provider: testConfig.provider,
  apiKey: testConfig.apiKey,
  model: testConfig.model
});

console.log(chalk.green('\n✓ Conductor initialized'));

// Test event handling
conductor.on('compositionGenerated', (composition) => {
  console.log(chalk.green('\n✓ Composition generated!'));
  console.log(chalk.cyan('Composition structure:'));
  console.log(`  Bars: ${composition.bars}`);
  console.log(`  BPM: ${composition.bpm}`);
  console.log(`  Style: ${composition.style}`);
  console.log(`  Tracks: ${Object.keys(composition.tracks).join(', ')}`);
  
  // Display track details
  Object.entries(composition.tracks).forEach(([name, track]) => {
    console.log(chalk.yellow(`\n  ${name}:`));
    console.log(`    Events: ${track.events.length}`);
    if (track.events.length > 0) {
      console.log(`    First event: ${JSON.stringify(track.events[0])}`);
    }
  });
});

conductor.on('error', (error) => {
  console.error(chalk.red(`\n❌ Error: ${error.message}`));
});

// Test generation
console.log(chalk.cyan('\n🎼 Generating test composition...'));

conductor.generateComposition('Electronic')
  .then((composition) => {
    console.log(chalk.green('\n✓ Test completed successfully!'));
    console.log(chalk.cyan('\nYou can now run the conductor with:'));
    console.log(chalk.white('  npm run conductor'));
    process.exit(0);
  })
  .catch((error) => {
    console.error(chalk.red(`\n❌ Generation failed: ${error.message}`));
    if (error.message.includes('API key')) {
      console.log(chalk.yellow('\nMake sure your API key is valid and has credits available.'));
    }
    process.exit(1);
  });
