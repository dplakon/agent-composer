import EventEmitter from 'events';

/**
 * MIDI Event Types
 */
export const EventType = {
  NOTE_ON: 'noteOn',
  NOTE_OFF: 'noteOff',
  CC: 'cc',
  PROGRAM_CHANGE: 'programChange',
  PITCH_BEND: 'pitchBend',
  CLOCK: 'clock',
  START: 'start',
  STOP: 'stop',
  CONTINUE: 'continue'
};

/**
 * Represents a scheduled MIDI event
 */
export class MidiEvent {
  constructor({
    type = EventType.NOTE_ON,
    beat = 0,           // Beat position (can be fractional)
    bar = 0,            // Bar number (optional, will be converted to beats)
    note = 60,          // MIDI note number
    velocity = 100,     // Note velocity
    duration = 0.25,    // Duration in beats (for NOTE_ON events)
    channel = 0,        // MIDI channel (0-15)
    controller = 0,     // CC number (for CC events)
    value = 0,          // CC or pitch bend value
    data = {}           // Additional data
  }) {
    this.type = type;
    this.beat = beat;
    this.bar = bar;
    this.note = note;
    this.velocity = velocity;
    this.duration = duration;
    this.channel = channel;
    this.controller = controller;
    this.value = value;
    this.data = data;
    this.executed = false;
    this.scheduledTime = null;
  }

  /**
   * Get the absolute beat position for this event
   * @param {number} quantum - Beat per bar (usually 4)
   */
  getAbsoluteBeat(quantum = 4) {
    return this.bar * quantum + this.beat;
  }
}

/**
 * MIDI Event Scheduler
 * Schedules and executes MIDI events synchronized with Ableton Link
 */
export class MidiScheduler extends EventEmitter {
  constructor(midiService, link) {
    super();
    
    this.midiService = midiService;
    this.link = link;
    
    // Event queues
    this.events = [];           // All scheduled events
    this.activeNotes = new Map(); // Track active notes for auto note-off
    
    // Timing
    this.lookaheadTime = 200;  // ms to look ahead (increased for high latency compensation)
    this.scheduleInterval = 25; // ms between schedule checks
    this.latencyCompensation = 0; // ms (range: -500 to 500)
    this.playbackSpeed = 1.0; // Playback speed multiplier (1.0 = normal speed)
    
    // State
    this.isRunning = false;
    this.currentBeat = 0;
    this.lastScheduledBeat = -1;
    this.loopLength = 0; // 0 = no loop, > 0 = loop length in beats
    this.loopStart = 0;   // Loop start beat
    this.debugNoteOffs = false; // Enable debug logging for NoteOff events
    
    // Scheduling
    this.scheduleTimer = null;
    this.updateTimer = null;
    
    // Stats
    this.stats = {
      eventsScheduled: 0,
      eventsExecuted: 0,
      notesPlayed: 0,
      lastEventTime: null
    };
  }

  /**
   * Start the scheduler
   */
  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.lastScheduledBeat = -1;
    
    // Start the scheduling loop
    this.scheduleTimer = setInterval(() => {
      this.scheduleEvents();
    }, this.scheduleInterval);
    
    // Start Link update if not already running
    if (!this.updateTimer) {
      this.startLinkUpdate();
    }
    
    this.emit('start');
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    
    // Clear timers
    if (this.scheduleTimer) {
      clearInterval(this.scheduleTimer);
      this.scheduleTimer = null;
    }
    
    // Stop all active notes
    this.stopAllNotes();
    
    this.emit('stop');
  }

  /**
   * Clear all scheduled events
   */
  clear() {
    // Stop all pending setTimeout calls by marking events as cancelled
    this.events.forEach(e => {
      e.cancelled = true;
    });
    this.events = [];
    this.stopAllNotes();
    this.lastScheduledBeat = -1;
    this.stats.eventsScheduled = 0;
    this.stats.eventsExecuted = 0;
    this.emit('clear');
  }

  /**
   * Add a single event to the schedule
   * @param {MidiEvent|Object} event - Event to schedule
   */
  addEvent(event) {
    if (!(event instanceof MidiEvent)) {
      event = new MidiEvent(event);
    }
    
    this.events.push(event);
    this.stats.eventsScheduled++;
    
    // Sort events by beat position
    this.events.sort((a, b) => {
      const quantum = this.link?.quantum || 4;
      const beatA = a.getAbsoluteBeat(quantum);
      const beatB = b.getAbsoluteBeat(quantum);
      return beatA - beatB;
    });
    
    this.emit('eventAdded', event);
    return event;
  }

  /**
   * Add multiple events
   * @param {Array} events - Array of events to schedule
   */
  addEvents(events) {
    events.forEach(event => this.addEvent(event));
  }

  /**
   * Add a note with automatic note-off
   * @param {Object} params - Note parameters
   */
  addNote({
    beat = 0,
    bar = 0,
    note = 60,
    velocity = 100,
    duration = 0.25,
    channel = 0
  }) {
    // Schedule note on
    const noteOn = this.addEvent({
      type: EventType.NOTE_ON,
      beat,
      bar,
      note,
      velocity,
      channel,
      duration
    });
    
    // Calculate note off position
    const quantum = this.link?.quantum || 4;
    const absoluteBeat = bar * quantum + beat;
    const offBeat = absoluteBeat + duration;
    const offBar = Math.floor(offBeat / quantum);
    const offBeatInBar = offBeat % quantum;
    
    // Schedule note off
    const noteOffEvent = this.addEvent({
      type: EventType.NOTE_OFF,
      beat: offBeatInBar,
      bar: offBar,
      note,
      channel
    });
    
    // Debug logging for NoteOff tracking
    if (this.debugNoteOffs) {
      console.log(`🎹 Scheduled NoteOff: note=${note}, channel=${channel}, at bar=${offBar}:${offBeatInBar.toFixed(2)}`);
    }
    
    return noteOn;
  }

  /**
   * Add a chord (multiple notes at once)
   * @param {Object} params - Chord parameters
   */
  addChord({
    beat = 0,
    bar = 0,
    notes = [60, 64, 67], // C major triad
    velocity = 100,
    duration = 1,
    channel = 0
  }) {
    return notes.map(note => 
      this.addNote({ beat, bar, note, velocity, duration, channel })
    );
  }

  /**
   * Add a pattern (sequence of notes)
   * @param {Array} pattern - Array of note objects
   * @param {number} startBar - Starting bar
   */
  addPattern(pattern, startBar = 0) {
    let currentBeat = 0;
    let currentBar = startBar;
    
    pattern.forEach(noteData => {
      // Handle different pattern formats
      if (typeof noteData === 'number') {
        // Simple note number
        this.addNote({
          beat: currentBeat,
          bar: currentBar,
          note: noteData,
          duration: 0.25
        });
        currentBeat += 0.25;
      } else {
        // Object with properties
        const { note, duration = 0.25, velocity, rest = false } = noteData;
        
        if (!rest && note !== undefined) {
          this.addNote({
            beat: currentBeat,
            bar: currentBar,
            note,
            velocity,
            duration
          });
        }
        
        currentBeat += duration;
      }
      
      // Move to next bar if needed
      while (currentBeat >= this.link.quantum) {
        currentBeat -= this.link.quantum;
        currentBar++;
      }
    });
  }

  /**
   * Set loop points
   * @param {number} length - Loop length in beats (0 to disable)
   * @param {number} start - Loop start beat
   */
  setLoop(length = 0, start = 0) {
    this.loopLength = length;
    this.loopStart = start;
    this.emit('loopChanged', { length, start });
  }

  /**
   * Start Link update loop
   */
  startLinkUpdate() {
    // Start link update if not already running
    if (!this.link._updateTimer) {
      this.link.startUpdate(60, () => {
        // This keeps link updating
      });
    }
  }

  /**
   * Main scheduling logic
   */
  scheduleEvents() {
    if (!this.isRunning || !this.midiService || !this.link) {
      return;
    }
    
    const now = Date.now();
    const lookAheadEnd = now + this.lookaheadTime;
    const currentBeat = this.link.beat || 0;
    const bpm = this.link.bpm || 120;
    // Apply playback speed to timing calculations
    // When playbackSpeed < 1.0, notes play slower (longer msPerBeat)
    // When playbackSpeed > 1.0, notes play faster (shorter msPerBeat)
    const effectiveBpm = bpm * this.playbackSpeed;
    const msPerBeat = 60000 / effectiveBpm;
    const quantum = this.link.quantum || 4;
    
    // Track the "virtual beat" position when playing at different speeds
    // This is used for non-looping events to determine their execution time
    if (!this.virtualBeatOffset) {
      this.virtualBeatOffset = 0;
      this.lastUpdateBeat = currentBeat;
    }
    
    // Update virtual beat offset based on playback speed
    const beatDelta = currentBeat - this.lastUpdateBeat;
    this.virtualBeatOffset += beatDelta * (this.playbackSpeed - 1);
    this.lastUpdateBeat = currentBeat;
    
    // Debug log once per 10 seconds if there are events
    if (this.events.length > 0 && (!this._lastDebugTime || now - this._lastDebugTime > 10000)) {
      this._lastDebugTime = now;
      const pendingEvents = this.events.filter(e => !e.executed).length;
      if (pendingEvents > 0) {
        console.log(`⏱ Scheduler: ${pendingEvents}/${this.events.length} events pending, beat=${currentBeat.toFixed(2)}`);
      }
    }
    
    // Process events that should be scheduled
    this.events.forEach(event => {
      // Skip already executed events unless we're looping
      if (event.executed && this.loopLength === 0) return;
      
      // Get the absolute beat position of the event
      const eventBeat = event.getAbsoluteBeat(quantum);
      
      // Calculate the target beat for this event
      let targetBeat = eventBeat;
      
      // Handle looping
      if (this.loopLength > 0) {
        // Adjust loop position for playback speed
        // When playing at different speeds, we need to scale the effective loop position
        const scaledCurrentBeat = currentBeat * this.playbackSpeed;
        const scaledLastBeat = this.lastScheduledBeat * this.playbackSpeed;
        
        // Check if we need to reset the executed flag
        const loopPosition = scaledCurrentBeat % this.loopLength;
        const lastLoopPosition = scaledLastBeat % this.loopLength;
        
        // Reset all events when we loop back
        // Only reset if they've actually been executed (not just scheduled)
        if (loopPosition < lastLoopPosition) {
          this.events.forEach(e => {
            // Only reset if actually executed, not just scheduled
            if (e.executed) {
              e.executed = false;
              e.scheduledTime = null;
            }
          });
        }
        
        // Calculate when this event should next occur
        const eventPositionInLoop = eventBeat % this.loopLength;
        const currentPositionInLoop = scaledCurrentBeat % this.loopLength;
        
        // Find the next occurrence of this event  
        if (eventPositionInLoop >= currentPositionInLoop) {
          targetBeat = currentBeat + (eventPositionInLoop - currentPositionInLoop) / this.playbackSpeed;
        } else {
          targetBeat = currentBeat + (this.loopLength - currentPositionInLoop + eventPositionInLoop) / this.playbackSpeed;
        }
      } else {
        // Non-looping: events are scheduled at absolute beat positions
        // Apply virtual beat offset for playback speed adjustment
        targetBeat = eventBeat + this.virtualBeatOffset;
      }
      
      // Calculate timing
      const beatsUntilEvent = targetBeat - currentBeat;
      
      // Only schedule if the event is coming up soon and hasn't been scheduled
      // Check scheduledTime instead of executed to prevent double-scheduling
      const isScheduledForFuture = event.scheduledTime && event.scheduledTime > now;
      
      // Extend lookahead window when using negative latency compensation
      // This ensures we can schedule events early enough
      const effectiveLookahead = this.lookaheadTime + Math.abs(Math.min(0, this.latencyCompensation));
      
      if (beatsUntilEvent >= 0 && beatsUntilEvent * msPerBeat <= effectiveLookahead && !isScheduledForFuture) {
        const msUntilEvent = beatsUntilEvent * msPerBeat;
        // Allow negative delays for predictive scheduling (when latencyCompensation is negative)
        const compensatedDelay = msUntilEvent + this.latencyCompensation;
        
        // For negative delays (early scheduling), execute immediately
        // For positive delays, use setTimeout as normal
        const delay = Math.max(0, compensatedDelay);
        
        // Mark with scheduled time BEFORE setTimeout to prevent race conditions
        // Use the actual compensated time, not the clamped delay
        event.scheduledTime = now + compensatedDelay;
        
        // If delay is 0 (due to negative compensation), execute immediately
        // Otherwise use setTimeout
        if (delay === 0 && compensatedDelay < 0) {
          // Execute immediately for predictive scheduling
          if (this.isRunning) {
            this.executeEvent(event);
            event.executed = true;
          }
          
          // In loop mode, clear scheduling info after execution
          if (this.loopLength > 0) {
            setTimeout(() => {
              event.executed = false;
              event.scheduledTime = null;
            }, 100);
          }
        } else {
          // Normal delayed execution
          setTimeout(() => {
            // Double-check the event should still be executed
            if (this.isRunning) {
              this.executeEvent(event);
              event.executed = true;  // Mark as executed AFTER actual execution
            }
            
            // In loop mode, clear scheduling info after execution
            if (this.loopLength > 0) {
              setTimeout(() => {
                event.executed = false;
                event.scheduledTime = null;
              }, 100);
            }
          }, delay);
        }
      }
    });
    
    this.lastScheduledBeat = currentBeat;
  }

  /**
   * Execute a MIDI event
   * @param {MidiEvent} event - Event to execute
   */
  executeEvent(event) {
    // Skip if event was cancelled (e.g., by clear())
    if (event.cancelled) {
      return;
    }
    
    if (!this.midiService) {
      console.warn('No MIDI service available');
      return;
    }
    
    if (!this.midiService.isConnected) {
      console.warn('MIDI service not connected');
      return;
    }
    
    switch (event.type) {
      case EventType.NOTE_ON:
        this.midiService.sendNoteOn(event.note, event.velocity, event.channel);
        this.activeNotes.set(`${event.channel}-${event.note}`, event);
        this.stats.notesPlayed++;
        break;
        
      case EventType.NOTE_OFF:
        this.midiService.sendNoteOff(event.note, event.channel);
        this.activeNotes.delete(`${event.channel}-${event.note}`);
        
        // Debug logging for NoteOff execution
        if (this.debugNoteOffs) {
          console.log(`🔕 Executed NoteOff: note=${event.note}, channel=${event.channel}`);
        }
        break;
        
      case EventType.CC:
        this.midiService.sendCC(event.controller, event.value, event.channel);
        break;
        
      case EventType.PROGRAM_CHANGE:
        this.midiService.output.send('program', {
          number: event.value,
          channel: event.channel
        });
        break;
        
      case EventType.PITCH_BEND:
        this.midiService.output.send('pitch', {
          value: event.value,
          channel: event.channel
        });
        break;
        
      case EventType.START:
        this.midiService.sendStart();
        break;
        
      case EventType.STOP:
        this.midiService.sendStop();
        break;
        
      case EventType.CLOCK:
        this.midiService.sendClock();
        break;
        
      case 'SAFETY_NOTEOFF':
        // Execute safety note-offs for segment boundaries
        this.sendSafetyNoteOffs(event.data.channels, false);
        break;
    }
    
    this.stats.eventsExecuted++;
    this.stats.lastEventTime = Date.now();
    this.emit('eventExecuted', event);
  }

  /**
   * Stop all currently playing notes
   */
  stopAllNotes() {
    this.activeNotes.forEach((event, key) => {
      const [channel, note] = key.split('-').map(Number);
      this.midiService.sendNoteOff(note, channel);
    });
    this.activeNotes.clear();
  }

  /**
   * Safety mechanism: Send note-off to all possible notes on specified channels
   * This ensures no hanging notes at segment boundaries
   * @param {Array<number>} channels - Array of MIDI channels to clear (0-15)
   * @param {boolean} onlyActiveChannels - If true, only clear channels that have active notes
   */
  sendSafetyNoteOffs(channels = null, onlyActiveChannels = false) {
    if (!this.midiService || !this.midiService.isConnected) {
      return;
    }

    // Determine which channels to clear
    let targetChannels = [];
    
    if (onlyActiveChannels) {
      // Get unique channels from active notes
      const activeChannels = new Set();
      this.activeNotes.forEach((event, key) => {
        const [channel] = key.split('-').map(Number);
        activeChannels.add(channel);
      });
      targetChannels = Array.from(activeChannels);
    } else if (channels) {
      targetChannels = channels;
    } else {
      // Default: clear first 16 channels (all standard MIDI channels)
      targetChannels = Array.from({ length: 16 }, (_, i) => i);
    }

    // Send note-off for all possible notes on target channels
    console.log(`🔒 Sending safety note-offs for channels: ${targetChannels.join(', ')}`);
    
    targetChannels.forEach(channel => {
      // Send note-off for all 128 possible MIDI notes
      for (let note = 0; note < 128; note++) {
        this.midiService.sendNoteOff(note, channel);
      }
    });

    // Clear active notes tracking for affected channels
    const keysToRemove = [];
    this.activeNotes.forEach((event, key) => {
      const [channel] = key.split('-').map(Number);
      if (targetChannels.includes(channel)) {
        keysToRemove.push(key);
      }
    });
    keysToRemove.forEach(key => this.activeNotes.delete(key));
    
    this.emit('safetyNoteOffs', { channels: targetChannels, count: targetChannels.length * 128 });
  }

  /**
   * Schedule safety note-offs at a specific beat position
   * @param {number} beat - Beat position to send safety note-offs
   * @param {Array<number>} channels - Channels to clear
   */
  scheduleSafetyNoteOffs(beat, channels = null) {
    const safetyEvent = new MidiEvent({
      type: 'SAFETY_NOTEOFF',
      beat: beat,
      bar: 0,
      data: { channels }
    });
    
    this.addEvent(safetyEvent);
    return safetyEvent;
  }

  /**
   * Set latency compensation
   * @param {number} ms - Latency in milliseconds (-500 to 500)
   */
  setLatencyCompensation(ms) {
    // Increased range from ±100ms to ±500ms for systems with higher latency
    this.latencyCompensation = Math.max(-500, Math.min(500, ms));
    
    // Debug logging when latency is set
    if (Math.abs(ms) > 100) {
      console.log(`⚡ High latency compensation set: ${ms}ms`);
    }
  }

  /**
   * Get current latency compensation
   * @returns {number} Current latency compensation in ms
   */
  getLatencyCompensation() {
    return this.latencyCompensation;
  }

  /**
   * Set playback speed
   * @param {number} speed - Playback speed multiplier (0.1 to 4.0, where 1.0 is normal)
   */
  setPlaybackSpeed(speed) {
    const oldSpeed = this.playbackSpeed;
    
    // Clamp speed to reasonable bounds
    this.playbackSpeed = Math.max(0.1, Math.min(4.0, speed));
    this.emit('playbackSpeedChanged', this.playbackSpeed);
    
    // Reset event execution flags when speed changes
    // This helps prevent timing issues when changing speed during playback
    if (Math.abs(oldSpeed - this.playbackSpeed) > 0.05) {
      this.events.forEach(e => e.executed = false);
      // Reset virtual beat tracking when speed changes
      this.virtualBeatOffset = 0;
      this.lastUpdateBeat = this.link?.beat || 0;
    }
  }

  /**
   * Get current playback speed
   * @returns {number} Current playback speed multiplier
   */
  getPlaybackSpeed() {
    return this.playbackSpeed;
  }

  /**
   * Get scheduler statistics
   */
  getStats() {
    return {
      ...this.stats,
      activeNotes: this.activeNotes.size,
      totalEvents: this.events.length,
      pendingEvents: this.events.filter(e => !e.executed).length,
      isRunning: this.isRunning,
      loopEnabled: this.loopLength > 0,
      currentBeat: this.currentBeat,
      playbackSpeed: this.playbackSpeed
    };
  }

  /**
   * Load pattern from JSON
   * @param {Object} json - Pattern data
   */
  loadPattern(json) {
    this.clear();
    
    const { tempo, events, patterns, loop } = json;
    
    // Set tempo if provided
    if (tempo && this.link) {
      this.link.bpm = tempo;
    }
    
    // Set loop if provided
    if (loop) {
      this.setLoop(loop.length, loop.start || 0);
    }
    
    // Add individual events
    if (events && Array.isArray(events)) {
      this.addEvents(events);
    }
    
    // Add patterns
    if (patterns && Array.isArray(patterns)) {
      patterns.forEach(({ pattern, startBar = 0 }) => {
        this.addPattern(pattern, startBar);
      });
    }
    
    this.emit('patternLoaded', json);
  }

  /**
   * Export current events as JSON
   */
  exportPattern() {
    return {
      tempo: this.link ? this.link.bpm : 120,
      quantum: this.link ? this.link.quantum : 4,
      loop: this.loopLength > 0 ? {
        length: this.loopLength,
        start: this.loopStart
      } : null,
      events: this.events.map(e => ({
        type: e.type,
        beat: e.beat,
        bar: e.bar,
        note: e.note,
        velocity: e.velocity,
        duration: e.duration,
        channel: e.channel,
        controller: e.controller,
        value: e.value
      }))
    };
  }

  /**
   * Clean up
   */
  destroy() {
    this.stop();
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
    this.clear();
    this.removeAllListeners();
  }
}

export default MidiScheduler;
