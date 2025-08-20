# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

This is an Ableton Link CLI tool that provides real-time beat monitoring, MIDI output, and AI-powered music generation. It's built with Node.js, React (Ink for terminal UI), and integrates with Ableton Link protocol for synchronized music applications.

## Common Development Commands

### Running the Application
```bash
# Basic Link monitor
npm start

# With MIDI output (sends notes on each beat)
npm run midi

# MIDI Scheduler with pattern sequencing
npm run scheduler
npm run scheduler-pattern  # With example pattern loaded

# AI Conductor modes
npm run conductor           # OpenAI GPT
npm run conductor-anthropic # Anthropic Claude

# Development mode
npm run dev
```

### Testing Commands
```bash
# Test Ableton Link connectivity
npm run test-link

# Test MIDI functionality
npm run test-midi

# Test latency compensation
npm run test-latency

# Test scheduler timing
npm run test-scheduler

# Test playback speed features
node test-playback-speed.js
node test-cli-speed.js
```

### Global Installation
```bash
# Install globally
npm install -g .

# Run globally
ableton-link-cli [options]
```

## Architecture & Key Components

### Core Entry Points
- **src/cli.jsx** - Main CLI entry that determines which component to render based on flags
  - Routes to LinkDisplay, LinkDisplayWithMidi, MidiScheduler, or ConductorComponent
  - Handles Ableton Link initialization and lifecycle
  - Uses React Ink for terminal UI rendering

### Component Architecture (src/components/)
- **LinkDisplay.jsx** - Basic beat monitoring display
- **LinkDisplayWithControls.jsx** - Display with keyboard controls for tempo/quantum
- **LinkDisplayWithMidi.jsx** - Display with MIDI note output on beats
- **MidiScheduler.jsx** - Advanced pattern sequencer with playback speed control
- **ConductorComponent.jsx** - AI conductor interface for LLM-generated music

### Service Layer (src/services/)
- **midiService.js** - Virtual MIDI port creation and message handling
  - Creates "Ableton Link CLI" virtual MIDI port
  - Handles note on/off, CC messages, and MIDI clock
  - Manages latency compensation

- **midiScheduler.js** - Pattern scheduling engine
  - Beat-perfect event scheduling synchronized with Link
  - Playback speed control (0.1x to 4.0x) independent of Link tempo
  - Loop management and pattern queuing
  - Note-off safety mechanisms

- **conductor.js** - LLM integration for music generation
  - Supports OpenAI and Anthropic providers
  - Generates structured JSON compositions (melody, bass, chords, drums)
  - Continuous generation mode for seamless playback

### Pattern Format
Patterns use JSON format (see patterns/example-pattern.json):
- Events specified by bar, beat, note, velocity, duration, channel
- Supports noteOn, noteOff, CC messages
- Loop configuration with start/length

## MIDI Configuration

### Virtual MIDI Setup
The app creates a virtual MIDI port named "Ableton Link CLI" that appears in DAWs. No external MIDI configuration needed on macOS/Linux. Windows may require loopMIDI or similar.

### Latency Compensation
- Use `--latency` flag with negative values (e.g., -15) to compensate for MIDI delay
- Interactive adjustment with `[` and `]` keys during runtime
- Test tool available: `npm run test-latency`

## LLM Integration

### API Keys
Set environment variables before using AI conductor:
```bash
export OPENAI_API_KEY="your-key"
export ANTHROPIC_API_KEY="your-key"
```

### Supported Models
- OpenAI: gpt-5-mini, gpt-4o-mini, gpt-4, gpt-3.5-turbo
- Anthropic: claude-3-opus, claude-3-sonnet, claude-3-haiku

## Key Implementation Details

### Ableton Link Integration
- Uses `abletonlink` npm package (Node.js bindings)
- Updates at 60 FPS for smooth animations
- Automatic peer discovery on local network
- Beat phase calculation for precise timing

### MIDI Timing Strategy
- Predictive scheduling when latency compensation is negative
- Note-off events automatically scheduled after note-on
- MIDI clock messages sent for tempo sync
- Channel 9 reserved for drums (GM standard)

### Playback Speed Implementation
- Speed multiplier applied to msPerBeat calculations
- Events remain in original positions but play faster/slower
- Effective BPM = Link BPM × playback speed
- Speed changes take effect immediately without stopping playback

## Testing Approach

Tests are standalone Node.js scripts (not using a test framework):
- Direct imports of services for unit testing
- Interactive tests for real-time features
- Visual tests for timing verification
- No mocking - tests use real Link and MIDI connections

## Dependencies Management

Key dependencies:
- `abletonlink` - Native bindings, requires Python 2.7 and build tools
- `easymidi` - MIDI functionality with virtual port support
- `ink` + `react` - Terminal UI framework
- `openai` / `@anthropic-ai/sdk` - LLM providers

Build requirements:
- Node.js 14.0.0+
- Python 2.7 (for native module compilation)
- Platform-specific build tools (Xcode CLI tools on macOS)

## Common Debugging Scenarios

### No Link Peers Found
- Verify Link is enabled in DAW preferences
- Check firewall/network settings
- Ensure same network subnet

### MIDI Not Working
- Virtual port should appear automatically
- Check DAW MIDI input settings (enable Track and Remote)
- Verify track is armed for recording

### Build Failures
- Run `npm rebuild` after Node.js version changes
- Ensure Python 2.7 is in PATH
- Install platform-specific build tools

## Performance Considerations

- CLI runs at 60 FPS update rate
- MIDI scheduler uses setTimeout for event scheduling
- Typical CPU usage: 1-2% when idle, 3-5% when actively playing
- Memory usage: ~50-80MB typical
