#!/usr/bin/env node

// This wrapper allows running the CLI directly without specifying the loader
require('child_process').spawn('node', [
  '--loader', '@esbuild-kit/esm-loader',
  require('path').join(__dirname, 'src', 'cli.jsx'),
  ...process.argv.slice(2)
], {
  stdio: 'inherit'
}).on('exit', code => process.exit(code));
