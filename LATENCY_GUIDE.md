# Latency Compensation Guide

## Quick Start

If the CLI's MIDI notes sound delayed compared to Ableton's metronome, you need to apply negative latency compensation to make the notes trigger earlier.

### Method 1: Real-time Adjustment

Run the CLI with MIDI and adjust in real-time:

```bash
npm run midi
# or
ableton-link-cli --midi
```

Then while it's running:
- Press `[` to reduce latency (notes play earlier)
- Press `]` to increase latency (notes play later)
- Press `Shift+[` or `Shift+]` for ±10ms jumps
- Press `0` to reset to zero

### Method 2: Test Tool

Use the dedicated latency test tool:

```bash
npm run test-latency
```

This creates a separate MIDI port for testing without the full UI.

### Method 3: Command Line

Once you know your latency value:

```bash
# Example: compensate for 15ms of delay
ableton-link-cli --midi --latency -15

# Example: if notes are too early, delay them
ableton-link-cli --midi --latency 10
```

## Understanding Latency Values

- **Negative values (-1 to -100)**: Notes trigger EARLIER
  - Use when CLI sounds behind Ableton
  - Most common scenario
  - Typical range: -10 to -30ms

- **Positive values (1 to 100)**: Notes trigger LATER
  - Use when CLI sounds ahead of Ableton
  - Less common
  - Typical range: +5 to +15ms

- **Zero (0)**: No compensation
  - Default setting
  - Try this first

## Finding Your Perfect Value

1. **Set up Ableton Live:**
   - Create a MIDI track with "Ableton Link CLI" as input
   - Add a percussive instrument (like a drum sound)
   - Create another track with Ableton's metronome
   - Arm both tracks

2. **Start with coarse adjustment:**
   - Run `ableton-link-cli --midi`
   - Press play in Ableton
   - Use `Shift+[` to jump by -10ms if delayed
   - Use `Shift+]` to jump by +10ms if early

3. **Fine-tune:**
   - Use `[` or `]` for 1ms adjustments
   - Listen for when the clicks align perfectly
   - Note the latency value shown in the UI

4. **Save your setting:**
   - Once found, always use: `--latency YOUR_VALUE`
   - Example: `alias linkmidi='ableton-link-cli --midi --latency -15'`

## System-Specific Tips

### macOS
- Virtual MIDI typically needs -10 to -20ms
- IAC Driver may need different values than third-party virtual ports
- Close Audio MIDI Setup after configuration

### Windows
- loopMIDI usually needs -5 to -15ms
- ASIO drivers generally have lower latency
- Try WASAPI exclusive mode for better timing

### Linux
- JACK MIDI typically needs minimal compensation (0 to -5ms)
- ALSA MIDI may need -10 to -20ms
- Use `jack_lsp` to verify connections

## Factors Affecting Latency

1. **Audio Buffer Size**
   - Lower buffer = less latency
   - 128 or 256 samples recommended
   - 512+ may need more compensation

2. **CPU Load**
   - High CPU usage increases latency
   - Close unnecessary applications
   - Disable WiFi/Bluetooth if not needed

3. **MIDI Routing**
   - Each virtual cable adds ~1-3ms
   - Direct connections are best
   - Avoid MIDI through plugins

4. **Link Network**
   - Wired Ethernet is most stable
   - WiFi can add 5-10ms variation
   - Avoid multiple network hops

## Troubleshooting

### Notes are inconsistently timed
- Check CPU usage (should be <50%)
- Reduce Ableton's buffer size
- Disable WiFi power saving
- Use wired connection if possible

### Latency changes over time
- Temperature can affect timing
- Close and reopen virtual MIDI ports
- Restart audio interface
- Check for background updates

### Can't get perfect sync
- Some systems have inherent jitter
- Try ±2ms around your best value
- Accept "good enough" (within 5ms)
- Consider hardware MIDI interface

## Advanced Techniques

### Predictive Compensation
The CLI uses predictive timing when latency is negative:
- Calculates when the next beat will occur
- Schedules MIDI events in advance
- Compensates for processing delays

### Per-Session Calibration
Latency can vary by session:
1. Start your DAW session
2. Run `npm run test-latency`
3. Adjust until clicks align
4. Use that value for the session

### Automation
Create a startup script:
```bash
#!/bin/bash
# my-link-midi.sh
LATENCY=-15  # Your calibrated value
ableton-link-cli --midi --latency $LATENCY
```

## FAQ

**Q: Why is latency compensation needed?**
A: Processing delays, MIDI routing, and audio buffers all add latency.

**Q: Will this affect Link sync?**
A: No, only MIDI output timing is affected. Link sync remains perfect.

**Q: Can I use different latency for different notes?**
A: Not currently, but you can modify the source code for this.

**Q: Is latency the same as jitter?**
A: No. Latency is consistent delay. Jitter is timing variation.

**Q: Should I compensate in Ableton instead?**
A: You can use Ableton's track delay, but CLI compensation is more direct.

## Remember

- Start with 0ms and adjust from there
- Negative values are most common (-10 to -20ms)
- Trust your ears over numbers
- Document your settings for consistency
- Re-calibrate after system changes
