# Playback Speed Feature

## Overview
The playback speed feature allows you to control the tempo at which MIDI events are played independently from the Ableton Link tempo. This is useful for:
- Practicing at slower speeds
- Creating tempo variations
- Testing patterns at different speeds
- Time-stretching musical phrases

## How to Use

### Starting the CLI with Scheduler Mode
To use the playback speed feature, run the CLI in scheduler mode:

```bash
# Using npm script
npm run scheduler

# Or directly
npm run start -- --scheduler

# Or with the CLI command
node --loader @esbuild-kit/esm-loader src/cli.jsx --scheduler
```

### Keyboard Controls

| Key | Action | Description |
|-----|--------|-------------|
| `+` or `=` | Increase speed | Increases playback speed by 0.1x (max 4.0x) |
| `-` or `_` | Decrease speed | Decreases playback speed by 0.1x (min 0.1x) |
| `\` | Reset speed | Resets playback speed to 1.0x (normal) |
| `/` | Toggle half speed | Toggles between current speed and 0.5x |
| `*` | Toggle double speed | Toggles between current speed and 2.0x |

### Display Information

The UI shows:
- **Speed**: Current playback speed multiplier (e.g., 1.5x)
- **Effective BPM**: The actual tempo at which notes play (Link BPM × playback speed)
  - For example: If Link BPM is 120 and speed is 1.5x, effective BPM is 180

## Technical Details

### How It Works

1. **Independent Timing**: The scheduler maintains its own timing calculations separate from Link's tempo
2. **Scaled Events**: All MIDI event timings are scaled by the playback speed factor
3. **Real-time Updates**: Changes to playback speed take effect immediately
4. **Event Preservation**: Changing speed doesn't affect the pattern itself, only playback timing

### Speed Range
- Minimum: 0.1x (10% of normal speed)
- Maximum: 4.0x (400% of normal speed)
- Default: 1.0x (normal speed)

### Implementation Components

1. **MidiScheduler Service** (`src/services/midiScheduler.js`)
   - `playbackSpeed` property stores the current speed
   - `setPlaybackSpeed()` method validates and applies speed changes
   - Timing calculations use `msPerBeat / playbackSpeed`

2. **MidiScheduler Component** (`src/components/MidiScheduler.jsx`)
   - Keyboard input handling for speed controls
   - UI display of current speed and effective BPM
   - Real-time status updates

3. **Main CLI** (`src/cli.jsx`)
   - Integrated when using `--scheduler` flag
   - Full support for all speed controls

## Example Usage Scenarios

### Practice Mode
Slow down complex patterns for practice:
1. Load a pattern with `1-5` keys
2. Press `-` repeatedly to slow down to 0.5x
3. Practice along at half speed
4. Gradually increase speed with `+` as you improve

### Creative Effects
Create tempo variations:
1. Start playback with Space
2. Use `/` to drop to half-time feel
3. Use `*` to create double-time sections
4. Press `\` to return to normal tempo

### Testing Patterns
Test MIDI patterns at various speeds:
1. Load your pattern
2. Use `+` and `-` to explore different tempos
3. Find the optimal tempo for your pattern
4. The Link tempo remains unchanged for other devices

## Testing

Run the automated tests:

```bash
# Test the core scheduler functionality
node test-playback-speed.js

# Interactive test with keyboard controls
node test-speed-interactive.js

# Test integration with main CLI
node test-cli-speed.js
```

## Troubleshooting

### Speed changes not taking effect
- Ensure the scheduler is running (press Space to start)
- Check that events are loaded (use 1-5 to load preset patterns)

### Audio glitches at extreme speeds
- Very high speeds (>3.0x) may cause timing issues with some MIDI devices
- Very low speeds (<0.3x) may have longer delays between notes

### Display not updating
- The UI updates on each beat
- Speed changes are reflected immediately in the display

## Future Enhancements

Potential improvements for the playback speed feature:
- Speed automation/curves
- Gradual speed ramps
- Per-track speed control
- Speed presets/bookmarks
- MIDI control of playback speed
