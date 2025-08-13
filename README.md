# Ableton Link CLI

A beautiful command-line interface for monitoring Ableton Link beat information in your terminal. This tool connects to any Link-enabled application on your network and displays real-time beat, phase, BPM, and synchronization data.

## Features

- 🎵 Real-time beat monitoring
- 📊 Visual beat grid and phase indicator
- 🔗 Automatic peer discovery
- 🎨 Beautiful terminal UI with colors and animations
- ⏱️ BPM and quantum configuration
- ▶️ Play state synchronization
- 🎹 **Virtual MIDI output** - Send MIDI notes synchronized to Link beats
- 🎛️ MIDI clock output for tempo sync

## Prerequisites

- Node.js 14.0.0 or higher
- Python 2.7 (for building native dependencies)
- Build tools:
  - **macOS**: Xcode Command Line Tools
  - **Windows**: windows-build-tools (`npm install --global --production windows-build-tools`)
  - **Linux**: make and gcc

## Installation

### From source

```bash
# Clone this repository
git clone <repository-url>
cd ableton-link-cli

# Install dependencies
npm install

# Run the CLI
npm start
```

### Global installation (after cloning)

```bash
# Install globally
npm install -g .

# Run from anywhere
ableton-link-cli
```

## Usage

```bash
# Start with default settings (120 BPM, quantum 4)
ableton-link-cli

# Enable MIDI output (sends C4 notes on every beat)
ableton-link-cli --midi

# Set custom BPM
ableton-link-cli --bpm 128

# Set custom quantum (bar length)
ableton-link-cli --quantum 8

# Combine options
ableton-link-cli -b 140 -q 4 --midi

# Show help
ableton-link-cli --help
```

## CLI Options

- `--bpm, -b` - Initial BPM (default: 120)
- `--quantum, -q` - Quantum/Bar length (default: 4)
- `--midi, -m` - Enable MIDI output (default: false)
- `--latency, -l` - MIDI latency compensation in ms (-100 to 100, default: 0)
- `--controls, -c` - Enable keyboard controls (default: true)
- `--help, -h` - Show help message
- `--version, -v` - Show version

## How it Works

The CLI uses the [node-abletonlink](https://github.com/2bbb/node-abletonlink) library to connect to the Ableton Link protocol. When you run the tool:

1. It creates a Link session on your local network
2. Automatically discovers and syncs with other Link-enabled applications
3. Displays real-time beat information in a beautiful terminal UI
4. Updates 60 times per second for smooth animations

## Display Information

The CLI shows:
- **Status**: Connection status and number of connected peers
- **BPM**: Current tempo in beats per minute
- **Beat**: Current beat count with pulse indicator
- **Phase**: Position within the current beat (0-100%)
- **Quantum**: Bar length setting
- **Playing**: Play/stop state (when synchronized)
- **Beat Grid**: Visual representation of the current position in the bar

## Connecting to Ableton Live

### For Link Sync Only:
1. Open Ableton Live
2. Enable Link in the Link/Tempo/MIDI preferences
3. Run `ableton-link-cli` in your terminal
4. The CLI will automatically connect and start displaying beat information

### For MIDI Output:
1. Run the CLI with MIDI enabled: `ableton-link-cli --midi`
2. Open Ableton Live
3. Go to Preferences → Link/Tempo/MIDI
4. Enable Link for tempo sync
5. In the MIDI tab, look for **"Ableton Link CLI"** in the Input section
6. Enable **"Track"** and **"Remote"** for this input
7. Create a new MIDI track
8. Set the track's MIDI input to **"Ableton Link CLI"**
9. Arm the track for recording (record enable button)
10. The track will now receive C4 notes on every beat!

### MIDI Controls (when using --midi flag):
- Press **1-8** to change the MIDI note (C4 through C5)
- Press **M** to toggle MIDI on/off
- Press **Space** to start/stop playback
- Press **R** to reset the beat counter
- Press **[/]** to adjust latency (±1ms)
- Press **Shift+[/]** to adjust latency (±10ms)
- Press **0** to reset latency
- The CLI sends MIDI clock for tempo synchronization

## Latency Compensation

If you notice the MIDI notes are slightly out of sync with Ableton's metronome:

### Finding the Right Latency Value

1. **Use the latency test tool:**
   ```bash
   npm run test-latency
   ```
   This creates a test MIDI port and lets you adjust latency in real-time.

2. **Adjust while running:**
   - Press `[` to make notes play earlier (negative latency)
   - Press `]` to make notes play later (positive latency)
   - Press `Shift+[` or `Shift+]` for ±10ms adjustments
   - Press `0` to reset to zero

3. **Use the found value:**
   ```bash
   ableton-link-cli --midi --latency -15  # Example: 15ms earlier
   ```

### Common Latency Values

- **USB MIDI interfaces**: Usually 0 to -5ms
- **Virtual MIDI on macOS**: Often -10 to -20ms
- **Complex DAW setups**: May need -20 to -40ms
- **If notes are early**: Use positive values (+5 to +20ms)

### Tips for Best Sync

1. Close other audio applications to reduce system load
2. Use a wired connection if syncing multiple devices
3. Set Ableton's audio buffer to 128 or 256 samples
4. Disable any audio effects on the metronome track

## Troubleshooting

### Build Errors

If you encounter build errors during installation:

1. Make sure you have Python 2.7 installed
2. Install the necessary build tools for your platform (see Prerequisites)
3. Try rebuilding: `npm rebuild`

### No Peers Found

If the CLI shows "Waiting for peers...":

1. Make sure Link is enabled in your DAW or other Link-enabled application
2. Check that both applications are on the same network
3. Disable firewall temporarily to test connectivity
4. Make sure no VPN is interfering with local network discovery

## Development

```bash
# Run in development mode with auto-reload
npm run dev

# Run tests (when implemented)
npm test
```

## Project Structure

```
ableton-link-cli/
├── src/
│   ├── cli.jsx                       # Main CLI entry point
│   ├── components/
│   │   ├── LinkDisplay.jsx           # Basic display component
│   │   ├── LinkDisplayWithControls.jsx # Component with keyboard controls
│   │   └── LinkDisplayWithMidi.jsx   # Component with MIDI output
│   └── services/
│       └── midiService.js            # MIDI port and message handling
├── test-midi.js                      # MIDI functionality test
├── demo.js                           # Demo Link peer
├── package.json
└── README.md
```

## Dependencies

- **abletonlink** - Node.js bindings for Ableton Link
- **easymidi** - MIDI library with virtual port support
- **ink** - React for CLI apps
- **react** - React library
- **chalk** - Terminal string styling
- **ink-gradient** - Gradient text for Ink
- **ink-big-text** - ASCII art text for Ink
- **meow** - CLI argument parser

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Acknowledgments

- [Ableton](https://www.ableton.com/) for the Link protocol
- [2bbb](https://github.com/2bbb) for the node-abletonlink library
- The Ink team for the amazing CLI framework
