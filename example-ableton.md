# Testing Ableton Link CLI with MIDI in Ableton Live

## Quick Start

1. **Start the CLI with MIDI enabled:**
   ```bash
   npm run midi
   # or
   npx ableton-link-cli --midi
   ```

2. **Configure Ableton Live:**

   ### Step 1: Enable Link
   - Open Ableton Live
   - Go to **Preferences** (Cmd+, on Mac)
   - Navigate to **Link/Tempo/MIDI** tab
   - Toggle **Link** to ON
   - You should see "1 Link" appear, indicating connection

   ### Step 2: Configure MIDI Input
   - Stay in Preferences
   - Look at the **MIDI** section
   - Find **"Ableton Link CLI"** in the Input list
   - Enable both **Track** and **Remote** for this input

   ### Step 3: Create a MIDI Track
   - Close Preferences
   - Create a new MIDI track (Cmd+Shift+T)
   - In the track's I/O section:
     - Set **MIDI From** to "Ableton Link CLI"
     - Set **Monitor** to "In" or "Auto"
   - Add an instrument (like Analog or Operator)
   - **Arm the track** for recording (click the record button)

3. **Test the Connection:**
   - Press Play in Ableton Live
   - You should see the beat counter in the CLI matching Ableton's tempo
   - You should hear C4 notes playing on every beat
   - The CLI shows how many notes have been sent

## Keyboard Controls (in the CLI)

While the CLI is running with `--midi` flag:

- **1-8**: Change MIDI note (C4, D4, E4, F4, G4, A4, B4, C5)
- **↑/↓**: Adjust BPM (±1)
- **Shift+↑/↓**: Adjust BPM (±10)
- **←/→**: Adjust Quantum (bar length)
- **[/]**: Adjust latency compensation (±1ms)
- **Shift+[/]**: Adjust latency compensation (±10ms)
- **0**: Reset latency to 0ms
- **Space**: Start/Stop playback
- **R**: Reset beat counter
- **M**: Toggle MIDI on/off
- **H**: Show/hide help
- **Q**: Quit

## What's Happening

When you run the CLI with MIDI enabled:

1. **Virtual MIDI Port**: A virtual MIDI port named "Ableton Link CLI" is created on your system
2. **Link Sync**: The CLI connects to Ableton Link for tempo and beat synchronization
3. **Note Generation**: On every beat (quarter note), the CLI sends:
   - A MIDI Note On message (default: C4, velocity 100)
   - A MIDI Note Off message after 100ms
4. **MIDI Clock**: The CLI also sends MIDI clock messages for additional sync

## Troubleshooting

### MIDI Port Not Showing in Ableton

1. Make sure the CLI is running BEFORE opening Ableton Live preferences
2. If already open, close and reopen the preferences window
3. On macOS, the virtual port should appear automatically

### No Sound

1. Check that the track is armed for recording
2. Verify an instrument is loaded on the track
3. Check the track's monitor is set to "In" or "Auto"
4. Ensure the track volume is up

### Notes Not in Sync

1. Make sure Link is enabled in both the CLI and Ableton
2. Check that both show the same number of "peers"
3. The BPM should automatically sync between them

### Testing Without Ableton

You can test MIDI functionality without Ableton:

```bash
# Run the MIDI test script
npm run test-midi
```

This will create a test MIDI port and send notes, which you can monitor with any MIDI monitoring tool like:
- **MIDI Monitor** (macOS)
- **MidiView** (macOS)
- **MidiOx** (Windows)

## Advanced Usage

### Sending Different Patterns

You can modify `src/components/LinkDisplayWithMidi.jsx` to send different patterns:

```javascript
// Example: Send notes only on downbeats (beat 1 of each bar)
if (quarterNote !== lastQuarterNote.current) {
  if (quarterNote % link.quantum === 0) {
    midiService.current.sendNote(60, 100, 127); // Louder on downbeat
  }
}
```

### Multiple Notes

```javascript
// Example: Send a chord
midiService.current.sendNote(60, 100, 100); // C
midiService.current.sendNote(64, 100, 100); // E
midiService.current.sendNote(67, 100, 100); // G
```

### CC Messages

The MIDI service also supports Control Change messages:

```javascript
// Send a filter sweep
midiService.current.sendCC(74, Math.floor(phase * 127), 0); // CC74 (cutoff)
```

## Performance Notes

- The CLI runs at 60 FPS for smooth animations
- MIDI timing is sample-accurate thanks to Ableton Link
- Virtual MIDI ports have very low latency on macOS
- The CLI uses minimal CPU (~1-2%)

## Recording MIDI

To record the MIDI notes in Ableton:

1. Create a MIDI clip in the armed track
2. Hit the main Record button in Ableton
3. The notes from the CLI will be recorded into the clip
4. Stop recording to see the recorded MIDI notes

Perfect for:
- Creating precise metronomic patterns
- Testing MIDI routing
- Generating click tracks
- Educational purposes
- Live performance triggers
