#!/usr/bin/env node

/**
 * Visual demonstration of generation timing improvements
 * Shows the difference between old interval-based and new event-driven generation
 */

import chalk from 'chalk';

console.log(chalk.cyan('\n📊 Generation Timing Comparison\n'));
console.log('Comparing old interval-based vs new event-driven generation');
console.log('─'.repeat(70));

// Simulate generation times (in seconds)
const generationTimes = [2.5, 3.1, 1.8, 2.9, 2.2, 3.5, 1.9, 2.7];
const checkInterval = 5; // Old system checked every 5 seconds

function printTimeline(title, events, totalTime) {
  console.log(chalk.yellow(`\n${title}:`));
  console.log('─'.repeat(70));
  
  // Create timeline visualization
  const scale = 60 / totalTime; // Fit in 60 chars
  let timeline = '';
  let lastPos = 0;
  
  events.forEach((event, i) => {
    const pos = Math.floor(event.start * scale);
    const endPos = Math.floor(event.end * scale);
    
    // Add waiting time
    if (pos > lastPos) {
      timeline += chalk.gray('·'.repeat(pos - lastPos));
    }
    
    // Add generation time
    timeline += chalk.green('█'.repeat(Math.max(1, endPos - pos)));
    lastPos = endPos;
  });
  
  // Fill remaining space
  if (lastPos < 60) {
    timeline += chalk.gray('·'.repeat(60 - lastPos));
  }
  
  console.log('0s' + ' '.repeat(26) + '30s' + ' '.repeat(26) + '60s');
  console.log('|' + timeline + '|');
  
  // Print event details
  console.log(chalk.dim('\nGeneration details:'));
  let totalWaitTime = 0;
  events.forEach((event, i) => {
    const waitTime = i > 0 ? event.start - events[i-1].end : 0;
    totalWaitTime += waitTime;
    
    if (waitTime > 0.1) {
      console.log(chalk.red(`  ⏸  Wait ${waitTime.toFixed(1)}s`));
    }
    console.log(chalk.green(`  [${i+1}] Generate ${event.duration.toFixed(1)}s (${event.start.toFixed(1)}s - ${event.end.toFixed(1)}s)`));
  });
  
  // Summary
  const totalGenTime = events.reduce((sum, e) => sum + e.duration, 0);
  const efficiency = (totalGenTime / totalTime * 100).toFixed(1);
  
  console.log(chalk.cyan(`\nSummary:`));
  console.log(`  Total time: ${totalTime.toFixed(1)}s`);
  console.log(`  Generation time: ${totalGenTime.toFixed(1)}s`);
  console.log(`  Wait time: ${chalk.red(totalWaitTime.toFixed(1) + 's')}`);
  console.log(`  Efficiency: ${efficiency}% ${efficiency > 80 ? chalk.green('✅') : chalk.yellow('⚠️')}`);
  
  return { totalTime, totalGenTime, totalWaitTime, efficiency: parseFloat(efficiency) };
}

// Simulate OLD interval-based system
console.log(chalk.red('\n🔴 OLD SYSTEM (Interval-based, checks every 5s):'));

let oldEvents = [];
let currentTime = 0;

generationTimes.forEach((genTime, i) => {
  // Wait for next interval check
  if (i > 0) {
    const timeSinceLastCheck = currentTime % checkInterval;
    const waitTime = timeSinceLastCheck > 0 ? checkInterval - timeSinceLastCheck : 0;
    currentTime += waitTime;
  }
  
  const start = currentTime;
  const end = start + genTime;
  oldEvents.push({ start, end, duration: genTime });
  currentTime = end;
});

const oldStats = printTimeline('Old System Timeline', oldEvents, currentTime);

// Simulate NEW event-driven system
console.log(chalk.green('\n\n🟢 NEW SYSTEM (Event-driven, immediate generation):'));

let newEvents = [];
currentTime = 0;

generationTimes.forEach((genTime, i) => {
  // No waiting - start immediately after previous
  const start = currentTime;
  const end = start + genTime;
  newEvents.push({ start, end, duration: genTime });
  currentTime = end;
});

const newStats = printTimeline('New System Timeline', newEvents, currentTime);

// Comparison
console.log(chalk.cyan('\n\n📈 IMPROVEMENT SUMMARY:'));
console.log('═'.repeat(70));

const timeReduction = ((oldStats.totalTime - newStats.totalTime) / oldStats.totalTime * 100).toFixed(1);
const waitReduction = oldStats.totalWaitTime - newStats.totalWaitTime;

console.log(chalk.white(`
  Time saved:        ${chalk.green((oldStats.totalTime - newStats.totalTime).toFixed(1) + 's')} (${timeReduction}% faster)
  Wait eliminated:   ${chalk.green(waitReduction.toFixed(1) + 's')}
  Efficiency gain:   ${chalk.green('+' + (newStats.efficiency - oldStats.efficiency).toFixed(1) + '%')}
  
  ${chalk.yellow('Old system:')} ${oldStats.totalTime.toFixed(1)}s total (${oldStats.totalWaitTime.toFixed(1)}s waiting)
  ${chalk.green('New system:')} ${newStats.totalTime.toFixed(1)}s total (${newStats.totalWaitTime.toFixed(1)}s waiting)
`));

console.log(chalk.green('✨ The new event-driven system eliminates unnecessary waiting'));
console.log(chalk.green('   and starts the next generation immediately after completion!\n'));
