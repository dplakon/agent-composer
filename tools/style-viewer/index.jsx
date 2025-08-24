#!/usr/bin/env node
import React, { useEffect, useState } from 'react';
import { render } from 'ink';
import BigText from 'ink-big-text';
import meow from 'meow';
import fs from 'fs';
import path from 'path';
import os from 'os';

const cli = meow(`\n  Usage\n    $ nb-style-viewer [--state-file PATH]\n\n  Options\n    --state-file  Path to shared style JSON file\n`, {
  importMeta: import.meta,
  flags: {
    stateFile: { type: 'string' }
  }
});

const DEFAULT_FILE =
  process.env.NB_STYLE_FILE ||
  path.join(os.homedir(), '.neural-baliset', 'style.json');

const FILE = cli.flags.stateFile || DEFAULT_FILE;

function safeRead() {
  try {
    const raw = fs.readFileSync(FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

const App = () => {
  const [state, setState] = useState(() => safeRead());

  useEffect(() => {
    // Initial poll if file doesn't exist yet
    let polling = !fs.existsSync(FILE);
    let pollInterval;
    if (polling) {
      pollInterval = setInterval(() => {
        if (fs.existsSync(FILE)) {
          const data = safeRead();
          if (data) setState(data);
          clearInterval(pollInterval);
          polling = false;
          startWatch();
        }
      }, 200);
    } else {
      startWatch();
    }

    let watcher;
    function startWatch() {
      try {
        watcher = fs.watch(path.dirname(FILE), { persistent: true }, (event, filename) => {
          if (filename === path.basename(FILE)) {
            const data = safeRead();
            if (data) setState(data);
          }
        });
      } catch {
        // Fallback to polling
        pollInterval = setInterval(() => {
          const data = safeRead();
          if (data) setState(data);
        }, 200);
      }
    }

    return () => {
      if (pollInterval) clearInterval(pollInterval);
      if (watcher) watcher.close();
    };
  }, []);

  const styleText = (state?.style ?? '').toString();
  const display = styleText.length > 0 ? styleText : ' ';

  return (
    <BigText text={display} font="block" />
  );
};

render(<App />);

