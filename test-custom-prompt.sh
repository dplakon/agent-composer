#!/bin/bash

echo "Testing Custom Style Prompt Feature"
echo "===================================="
echo ""
echo "This test will demonstrate the new custom style prompt feature."
echo ""
echo "Instructions:"
echo "1. Press 'S' to open the custom style prompt input"
echo "2. Type your custom music style description"
echo "3. Press Enter to submit"
echo "4. Press 'G' to generate music with your custom style"
echo ""
echo "Quick preset styles:"
echo "  Press 1 - Electronic"
echo "  Press 2 - Classical"
echo "  Press 3 - Jazz"
echo "  Press 4 - Ambient"
echo "  Press 5 - Funk"
echo "  Press 6 - Minimal"
echo ""
echo "Example custom prompts:"
echo "  - 'Dark techno with industrial percussion and atmospheric pads'"
echo "  - 'Uplifting trance with euphoric melodies and driving bassline'"
echo "  - 'Experimental jazz fusion with complex harmonies'"
echo "  - 'Lo-fi hip hop beats with vinyl crackle and mellow chords'"
echo ""
echo "Press any key to start the conductor..."
read -n 1

# Run the conductor
ableton-link-cli --conductor --model gpt-5-mini
