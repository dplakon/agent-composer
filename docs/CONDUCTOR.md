# AI Conductor Mode

The AI Conductor mode integrates LLM-powered music generation with the MIDI scheduler to create continuous, AI-generated music synchronized with Ableton Link.

## Prerequisites

1. Make sure you have Ableton Live running with Link enabled
2. Set up your API key for either OpenAI or Anthropic:
   ```bash
   export OPENAI_API_KEY="your-api-key-here"
   # OR
   export ANTHROPIC_API_KEY="your-api-key-here"
   ```

## Running the Conductor

### Basic usage with OpenAI (default):
```bash
npm run conductor
```

### Using Anthropic Claude:
```bash
npm run conductor-anthropic
```

### Using CLI directly:
```bash
# OpenAI with specific model
./src/cli.jsx --conductor --provider openai --model gpt-4

# Anthropic with specific model
./src/cli.jsx --conductor --provider anthropic --model claude-3-opus-20240229

# Provide API key directly
./src/cli.jsx --conductor --api-key "your-api-key"
```

## Keyboard Controls

- **Space** - Start/Stop the scheduler
- **G** - Generate a single 8-bar composition
- **A** - Toggle auto-generation (continuous generation)
- **S** - Change music style preset
- **L** - Toggle loop mode
- **C** - Clear all events
- **R** - Reset everything
- **H** - Show help
- **Q** - Quit

## How It Works

1. The conductor prompts an LLM to generate 8-bar musical compositions in JSON format
2. Generated compositions include:
   - Melody patterns with notes, durations, and velocities
   - Bass patterns
   - Chord progressions
   - Drum patterns
3. The MIDI scheduler queues and plays these events synchronized with Ableton Link
4. In auto-generation mode, new segments are generated continuously for seamless playback

## Music Styles

The conductor supports multiple music style presets:
- Electronic
- Jazz
- Classical
- Ambient
- Hip Hop
- Rock
- Funk
- Latin

Press 'S' while running to cycle through styles.

## Configuration

### Environment Variables

- `OPENAI_API_KEY` - Your OpenAI API key
- `ANTHROPIC_API_KEY` - Your Anthropic API key
- `CONDUCTOR_MODEL` - Default model to use
- `CONDUCTOR_PROVIDER` - Default provider (openai or anthropic)

### Recommended Models

**OpenAI:**
- `gpt-5-mini` - Latest mini model with improved capabilities
- `gpt-4o-mini` - Fast and efficient mini model
- `gpt-4` - Best quality, higher cost
- `gpt-3.5-turbo` - Good balance of quality and cost

**Anthropic:**
- `claude-3-opus-20240229` - Best quality
- `claude-3-sonnet-20240229` - Good balance
- `claude-3-haiku-20240307` - Fastest, lower cost

## Troubleshooting

### No sound output
- Ensure Ableton Live is running with Link enabled
- Check that the virtual MIDI port "AI Conductor" is selected as input in your DAW
- Verify MIDI channel routing in your DAW

### Generation errors
- Check your API key is valid
- Ensure you have credits/quota available
- Try a different model if rate limited

### Timing issues
- Adjust latency compensation with the scheduler controls
- Ensure stable network connection for Link sync
- Close other CPU-intensive applications

## Example Session

1. Start Ableton Live with a MIDI track armed for recording
2. Enable Link in Ableton's preferences
3. Set your API key:
   ```bash
   export OPENAI_API_KEY="sk-..."
   ```
4. Run the conductor:
   ```bash
   npm run conductor
   ```
5. Press Space to start the scheduler
6. Press G to generate your first composition
7. Press A to enable auto-generation for continuous music

## Architecture

The conductor consists of:
- **Conductor Service** - Manages LLM interactions and composition generation
- **MIDI Scheduler** - Queues and plays MIDI events synchronized with Link
- **React/Ink UI** - Interactive terminal interface for control and monitoring
- **Virtual MIDI Port** - Sends MIDI events to your DAW

## Development

To modify the conductor behavior, edit:
- `src/services/Conductor.js` - Core conductor logic
- `src/components/ConductorComponent.jsx` - UI and controls
- `src/services/MidiScheduler.js` - MIDI scheduling logic
