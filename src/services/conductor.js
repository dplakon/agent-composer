import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import EventEmitter from 'events';
import crypto from 'crypto';

/**
 * Music generation prompt templates
 */
const SYSTEM_PROMPT = `You are a professional SATB composer. Generate complete 8-bar compositions with EXACTLY 32.0 beats per voice.

CRITICAL REQUIREMENT: Generate exactly 8 bars of music (32 beats in 4/4 time).

OUTPUT FORMAT (JSON):
{
  "metadata": { 
    "tempo": 120, 
    "timeSignature": "4/4", 
    "bars": 8, 
    "key": "C major" 
  },
  "tracks": [
    {
      "name": "Soprano",
      "channel": 0,
      "notes": [
        { "pitch": 60, "duration": 1.0, "velocity": 100 },
        { "pitch": 64, "duration": 0.5, "velocity": 90 }
      ]
    },
    {
      "name": "Alto",
      "channel": 1,
      "notes": [
        { "pitch": 60, "duration": 1.0, "velocity": 100 },
        { "pitch": 64, "duration": 0.5, "velocity": 90 }
      ]
    },
    {
      "name": "Tenor",
      "channel": 2,
      "notes": [
        { "pitch": 60, "duration": 1.0, "velocity": 100 },
        { "pitch": 64, "duration": 0.5, "velocity": 90 }
      ]
    },
    {
      "name": "Bass", 
      "channel": 3,
      "notes": [
        { "pitch": 36, "duration": 2.0, "velocity": 110 }
      ]
    }
  ]
}

RULES:
- Each track's notes must total exactly 32 beats (8 bars × 4 beats)
- Pitch: MIDI note numbers (0-127) - Middle C = 60
- Duration: In beats (0.25, 0.5, 1.0, 2.0, etc.)
- Velocity: MIDI velocity (1-127)
- Notes are sequential (no overlaps within a track)
- Multiple tracks can play simultaneously
- Voice ranges: Soprano C4-G5, Alto G3-D5, Tenor C3-G4, Bass E2-C4
- It's ok to let some voices rest sometimes for dramatic effect.

IMPORTANT:
- Output ONLY valid JSON, no explanations or markdown
- Verify each track totals exactly 32 beats
- Keep it musical and coherent`;

/**
 * Note event structure
 */
class NoteEvent {
  constructor(pitch, duration, velocity = 100) {
    this.pitch = pitch;
    this.duration = duration;
    this.velocity = velocity;
  }
}

/**
 * Track structure
 */
class Track {
  constructor(name, channel = 0, notes = []) {
    this.name = name;
    this.channel = channel;
    this.notes = notes;
  }

  getTotalDuration() {
    return this.notes.reduce((sum, note) => sum + note.duration, 0);
  }
}

/**
 * Composition structure
 */
class Composition {
  constructor(metadata = {}, tracks = []) {
    this.metadata = {
      tempo: metadata.tempo || 120,
      timeSignature: metadata.timeSignature || '4/4',
      bars: metadata.bars || 8,
      key: metadata.key || 'C major',
      ...metadata
    };
    this.tracks = tracks;
  }

  validate() {
    const expectedBeats = this.metadata.bars * 4; // Assuming 4/4 time
    const errors = [];

    this.tracks.forEach(track => {
      const duration = track.getTotalDuration();
      if (Math.abs(duration - expectedBeats) > 0.01) {
        errors.push(`Track "${track.name}" has ${duration} beats, expected ${expectedBeats}`);
      }
    });

    return errors;
  }

  isValid() {
    return this.validate().length === 0;
  }
}

/**
 * LLM Agent Conductor
 * Manages continuous music generation using LLMs
 */
export class Conductor extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.provider = options.provider || 'openai'; // 'openai' or 'anthropic'
    this.model = options.model || 'gpt-3.5-turbo'; // Default to gpt-3.5-turbo
    this.apiKey = options.apiKey || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
    
    // Initialize LLM client
    if (this.provider === 'openai') {
      this.client = new OpenAI({ apiKey: this.apiKey });
    } else if (this.provider === 'anthropic') {
      this.client = new Anthropic({ apiKey: this.apiKey });
    } else {
      throw new Error(`Unsupported provider: ${this.provider}`);
    }
    
    // State management
    this.currentComposition = null;
    this.compositionHistory = [];
    this.isGenerating = false;
    this.generationCount = 0;
    
    // Configuration
    this.temperature = options.temperature || 0.8;
    // Use much higher token limit for GPT-5 models to avoid truncation
    const defaultMaxTokens = this.model && this.model.includes('gpt-5') ? 20000 : 2000;
    this.maxTokens = options.maxTokens || defaultMaxTokens;
    this.systemInjection = ''; // For live style adjustments
    
    // Note about GPT-5 temperature limitation
    if (this.model && this.model.includes('gpt-5')) {
      console.log(`📝 Note: ${this.model} only supports temperature=1, will override custom temperature settings`);
      console.log(`📊 Using ${this.maxTokens} max tokens for complete JSON generation`);
    }
    
    // Generation queue
    this.generationQueue = [];
    this.currentBar = 0;
    
    console.log(`🎼 Conductor initialized with ${this.provider} (${this.model})`);
  }

  /**
   * Set live style injection for real-time adjustments
   */
  setSystemInjection(injection) {
    this.systemInjection = injection;
    console.log(`💉 System injection updated: ${injection}`);
  }

  /**
   * Create the system prompt with any live injections
   */
  getSystemPrompt() {
    let prompt = SYSTEM_PROMPT;
    if (this.systemInjection) {
      prompt += `\n\nAdditional instructions: ${this.systemInjection}`;
    }
    return prompt;
  }

  /**
   * Create user prompt with context
   */
  createUserPrompt(options = {}) {
    let prompt = 'Generate an 8-bar musical composition.';
    
    if (options.style) {
      prompt += `\n\nStyle: ${options.style}`;
    }
    
    if (options.key) {
      prompt += `\nKey: ${options.key}`;
    }
    
    if (options.tempo) {
      prompt += `\nTempo: ${options.tempo} BPM`;
    }
    
    if (this.currentComposition) {
      // Include previous composition for continuity
      prompt += '\n\nContinue from this previous 8-bar segment:';
      prompt += '\n' + JSON.stringify({
        metadata: this.currentComposition.metadata,
        lastBar: this.getLastBarSummary()
      }, null, 2);
      prompt += '\n\nMaintain musical continuity and development.';
    }
    
    prompt += '\n\nGenerate JSON output.';
    return prompt;
  }

  /**
   * Get summary of the last bar for context
   */
  getLastBarSummary() {
    if (!this.currentComposition || !this.currentComposition.tracks) {
      return null;
    }
    
    const summary = {};
    this.currentComposition.tracks.forEach(track => {
      // Get last few notes from each track
      const lastNotes = track.notes.slice(-4);
      summary[track.name] = lastNotes.map(n => ({
        pitch: n.pitch,
        duration: n.duration
      }));
    });
    
    return summary;
  }

  /**
   * Call the LLM to generate music
   */
  async callLLM(systemPrompt, userPrompt) {
    const startTime = Date.now();
    
    try {
      let response;
      let content;
      
      if (this.provider === 'openai') {
        // Newer models like gpt-4o-mini and gpt-5 use max_completion_tokens instead of max_tokens
        const isNewerModel = this.model && (
          this.model.includes('gpt-4o') || 
          this.model.includes('gpt-5') ||  // Support for GPT-5 models
          this.model.includes('o1-') ||
          this.model.includes('gpt-4-turbo')
        );
        
        // GPT-5 models only support default temperature (1)
        const isGpt5Model = this.model && this.model.includes('gpt-5');
        const temperature = isGpt5Model ? 1 : this.temperature;
        
        const completionParams = {
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: temperature
        };
        
        // Use appropriate token parameter based on model
        if (isNewerModel) {
          completionParams.max_completion_tokens = this.maxTokens;
        } else {
          completionParams.max_tokens = this.maxTokens;
        }
        
        response = await this.client.chat.completions.create(completionParams);
        content = response.choices[0].message.content;
        
      } else if (this.provider === 'anthropic') {
        response = await this.client.messages.create({
          model: this.model,
          max_tokens: this.maxTokens,
          temperature: this.temperature,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }]
        });
        content = response.content[0].text;
      }
      
      const generationTime = (Date.now() - startTime) / 1000;
      console.log(`⚡ Generated in ${generationTime.toFixed(2)}s`);
      
      return { content, generationTime };
      
    } catch (error) {
      console.error('❌ LLM call failed:', error);
      throw error;
    }
  }

  /**
   * Parse and validate LLM output
   */
  parseComposition(jsonContent) {
    // Log raw content length for debugging
    console.log(`📊 Raw response length: ${jsonContent.length} characters`);
    
    // Clean up common LLM formatting issues
    let cleaned = jsonContent.trim();
    
    // Remove markdown code blocks
    if (cleaned.includes('```json')) {
      // Extract JSON from markdown code block
      const match = cleaned.match(/```json\s*([\s\S]*?)```/);
      if (match) {
        cleaned = match[1].trim();
      }
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.split('\n').slice(1).join('\n');
      if (cleaned.endsWith('```')) {
        cleaned = cleaned.split('\n').slice(0, -1).join('\n');
      }
    }
    
    // Remove comments
    cleaned = cleaned.replace(/\/\/.*$/gm, '');
    cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');
    
    // Check if JSON appears truncated
    if (!cleaned.endsWith('}')) {
      console.warn('⚠️ JSON appears truncated - may have hit token limit');
      console.log('Last 100 chars:', cleaned.slice(-100));
      
      // Try to auto-complete simple truncations
      const openBraces = (cleaned.match(/{/g) || []).length;
      const closeBraces = (cleaned.match(/}/g) || []).length;
      const openBrackets = (cleaned.match(/\[/g) || []).length;
      const closeBrackets = (cleaned.match(/]/g) || []).length;
      
      // Add missing brackets/braces
      cleaned += ']'.repeat(Math.max(0, openBrackets - closeBrackets));
      cleaned += '}'.repeat(Math.max(0, openBraces - closeBraces));
      
      console.log('🔧 Attempted auto-repair by adding closing brackets/braces');
    }
    
    // Parse JSON
    try {
      const data = JSON.parse(cleaned);
      
      // Validate required fields
      if (!data.tracks || !Array.isArray(data.tracks)) {
        throw new Error('Missing or invalid tracks array');
      }
      
      // Convert to Composition object
      const tracks = data.tracks.map(t => {
        const track = new Track(t.name, t.channel || 0);
        track.notes = t.notes.map(n => new NoteEvent(n.pitch, n.duration, n.velocity));
        return track;
      });
      
      return new Composition(data.metadata, tracks);
      
    } catch (error) {
      console.error('❌ Failed to parse composition:', error.message);
      console.log('📝 First 500 chars of cleaned JSON:', cleaned.slice(0, 500));
      console.log('📝 Last 500 chars of cleaned JSON:', cleaned.slice(-500));
      throw error;
    }
  }

  /**
   * Generate a new 8-bar composition segment
   */
  async generate(options = {}) {
    if (this.isGenerating) {
      console.log('⏳ Generation already in progress');
      return null;
    }
    
    this.isGenerating = true;
    this.generationCount++;
    
    try {
      console.log(`\n🎵 Generating segment #${this.generationCount}...`);
      
      // Create prompts
      const systemPrompt = this.getSystemPrompt();
      const userPrompt = this.createUserPrompt(options);
      
      // Call LLM
      const { content, generationTime } = await this.callLLM(systemPrompt, userPrompt);
      
      // Parse and validate
      const composition = this.parseComposition(content);
      const errors = composition.validate();
      
      if (errors.length > 0) {
        console.warn('⚠️ Validation errors:', errors);
        // Attempt to fix or retry here if needed
      }
      
      // Store composition
      this.currentComposition = composition;
      this.compositionHistory.push(composition);
      
      // Emit event
      this.emit('compositionGenerated', {
        composition,
        generationTime,
        segmentNumber: this.generationCount
      });
      
      console.log(`✅ Generated ${composition.tracks.length} tracks, ${composition.metadata.bars} bars`);
      
      return composition;
      
    } catch (error) {
      console.error('❌ Generation failed:', error);
      this.emit('generationError', error);
      return null;
      
    } finally {
      this.isGenerating = false;
    }
  }

  /**
   * Convert composition to scheduler events
   */
  toSchedulerEvents(composition, startBar = 0) {
    const events = [];
    
    composition.tracks.forEach(track => {
      let currentBeat = 0;
      
      track.notes.forEach(note => {
        // Add note event
        events.push({
          type: 'note',
          bar: startBar + Math.floor(currentBeat / 4),
          beat: currentBeat % 4,
          note: note.pitch,
          velocity: note.velocity || 100,
          duration: note.duration,
          channel: track.channel || 0
        });
        
        currentBeat += note.duration;
      });
    });
    
    return events;
  }

  /**
   * Start continuous generation
   */
  async startContinuousGeneration(options = {}) {
    console.log('🎼 Starting continuous generation...');
    
    this.generationLoop = setInterval(async () => {
      // Check if we need to generate more
      const barsAhead = options.barsAhead || 16; // Generate when we have less than 16 bars queued
      const currentQueueSize = this.generationQueue.length * 8; // Each segment is 8 bars
      
      if (currentQueueSize < barsAhead && !this.isGenerating) {
        const composition = await this.generate(options);
        
        if (composition) {
          // Add to queue
          this.generationQueue.push(composition);
          
          // Convert to events for scheduler
          const events = this.toSchedulerEvents(composition, this.currentBar);
          this.currentBar += 8;
          
          // Emit events for scheduler
          this.emit('scheduleEvents', events);
        }
      }
    }, options.checkInterval || 5000); // Check every 5 seconds
  }

  /**
   * Stop continuous generation
   */
  stopContinuousGeneration() {
    if (this.generationLoop) {
      clearInterval(this.generationLoop);
      this.generationLoop = null;
      console.log('🛑 Stopped continuous generation');
    }
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      generationCount: this.generationCount,
      historySize: this.compositionHistory.length,
      queueSize: this.generationQueue.length,
      isGenerating: this.isGenerating,
      currentBar: this.currentBar
    };
  }

  /**
   * Clear history and reset
   */
  reset() {
    this.currentComposition = null;
    this.compositionHistory = [];
    this.generationQueue = [];
    this.generationCount = 0;
    this.currentBar = 0;
    console.log('🔄 Conductor reset');
  }
}

export default Conductor;
