#!/bin/bash

# Test script to verify conductor CLI works

echo "Testing Conductor CLI..."
echo "========================"
echo ""

# Check if API key is set
if [ -z "$OPENAI_API_KEY" ] && [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "⚠️  No API key found. Set OPENAI_API_KEY or ANTHROPIC_API_KEY"
    echo ""
    echo "To test without an actual API key (UI only):"
    echo "  OPENAI_API_KEY=test-key ableton-link-cli --conductor --model gpt-4o-mini"
    echo ""
    echo "To use with a real API key:"
    echo "  export OPENAI_API_KEY='your-key-here'"
    echo "  ableton-link-cli --conductor --model gpt-4o-mini"
else
    echo "✅ API key found"
    echo ""
    echo "Available commands:"
    echo "  ableton-link-cli --conductor                      # Use default model"
    echo "  ableton-link-cli --conductor --model gpt-5-mini   # Use GPT-5 mini (latest)"
    echo "  ableton-link-cli --conductor --model gpt-4o-mini  # Use GPT-4o mini"
    echo "  ableton-link-cli --conductor --model gpt-4        # Use GPT-4"
    echo "  ableton-link-cli --conductor --provider anthropic --model claude-3-haiku-20240307"
fi

echo ""
echo "Press any key to start the conductor with gpt-5-mini (or Ctrl+C to cancel)..."
read -n 1

# Run the conductor
ableton-link-cli --conductor --model gpt-5-mini
