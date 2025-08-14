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
    this.lookaheadTime = 100;  // ms to look ahead
    this.scheduleInterval = 25; // ms between schedule checks
    this.latencyCompensation = 0; // ms
    this.playbackSpeed = 1.0; // Playback speed multiplier (1.0 = normal speed)
    
    // State
    this.isRunning = false;
    this.currentBeat = 0;
    this.lastScheduledBeat = -1;
    this.loopLength = 0; // 0 = no loop, > 0 = loop length in beats
    this.loopStart = 0;   // Loop start beat
    
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
    this.addEvent({
      type: EventType.NOTE_OFF,
      beat: offBeatInBar,
      bar: offBar,
      note,
      channel
    });
    
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
        if (loopPosition < lastLoopPosition) {
          this.events.forEach(e => e.executed = false);
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
        // For conductor mode, we want events to maintain their relative timing
        // but play back at the adjusted speed
        targetBeat = eventBeat;
      }
      
      // Calculate timing
      const beatsUntilEvent = targetBeat - currentBeat;
      
      // Only schedule if the event is coming up soon and hasn't been executed
      if (beatsUntilEvent >= 0 && beatsUntilEvent * msPerBeat <= this.lookaheadTime && !event.executed) {
        const msUntilEvent = beatsUntilEvent * msPerBeat;
        const delay = Math.max(0, msUntilEvent + this.latencyCompensation);
        
        setTimeout(() => {
          this.executeEvent(event);
          
          // In loop mode, reset executed flag after execution
          if (this.loopLength > 0) {
            setTimeout(() => {
              event.executed = false;
            }, 100);
          }
        }, delay);
        
        event.executed = true;
        event.scheduledTime = now + delay;
      }
    });
    
    this.lastScheduledBeat = currentBeat;
  }

  /**
   * Execute a MIDI event
   * @param {MidiEvent} event - Event to execute
   */
  executeEvent(event) {
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
   * Set latency compensation
   * @param {number} ms - Latency in milliseconds
   */
  setLatencyCompensation(ms) {
    this.latencyCompensation = Math.max(-100, Math.min(100, ms));
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
