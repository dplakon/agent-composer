import easymidi from 'easymidi';

class MidiService {
  constructor(portName = 'Ableton Link CLI') {
    this.portName = portName;
    this.output = null;
    this.isConnected = false;
    this.lastNoteOn = null;
    this.noteVelocity = 100;
    this.noteChannel = 0; // MIDI channel 1 (0-indexed)
    this.latencyCompensation = 0; // in milliseconds (negative = earlier, positive = later)
    
    // MIDI note numbers
    this.notes = {
      C4: 60,
      D4: 62,
      E4: 64,
      F4: 65,
      G4: 67,
      A4: 69,
      B4: 71,
      C5: 72
    };
    
    this.currentNote = this.notes.C4;
  }

  /**
   * Initialize the virtual MIDI output port
   */
  init() {
    try {
      // Create a virtual MIDI output port
      // On macOS, this will create a virtual port that appears in other applications
      this.output = new easymidi.Output(this.portName, true);
      this.isConnected = true;
      console.log(`✅ Virtual MIDI port "${this.portName}" created`);
      return true;
    } catch (error) {
      console.error('❌ Failed to create virtual MIDI port:', error.message);
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Send a MIDI note on message
   * @param {number} note - MIDI note number (0-127)
   * @param {number} velocity - Note velocity (0-127)
   * @param {number} channel - MIDI channel (0-15)
   */
  sendNoteOn(note = this.currentNote, velocity = this.noteVelocity, channel = this.noteChannel) {
    if (!this.isConnected || !this.output) {
      return false;
    }

    try {
      this.output.send('noteon', {
        note: note,
        velocity: velocity,
        channel: channel
      });
      
      this.lastNoteOn = { note, velocity, channel, timestamp: Date.now() };
      return true;
    } catch (error) {
      console.error('Failed to send note on:', error);
      return false;
    }
  }

  /**
   * Send a MIDI note off message
   * @param {number} note - MIDI note number (0-127)
   * @param {number} channel - MIDI channel (0-15)
   */
  sendNoteOff(note = this.currentNote, channel = this.noteChannel) {
    if (!this.isConnected || !this.output) {
      return false;
    }

    try {
      this.output.send('noteoff', {
        note: note,
        velocity: 0,
        channel: channel
      });
      return true;
    } catch (error) {
      console.error('Failed to send note off:', error);
      return false;
    }
  }

  /**
   * Send a short note (note on followed by note off after duration)
   * @param {number} note - MIDI note number
   * @param {number} duration - Note duration in milliseconds
   * @param {number} velocity - Note velocity
   */
  sendNote(note = this.currentNote, duration = 100, velocity = this.noteVelocity) {
    if (!this.isConnected) return false;

    // Apply latency compensation
    // Negative values send the note earlier (compensate for delays)
    // Positive values send the note later
    const compensatedDelay = Math.max(0, this.latencyCompensation);
    
    if (compensatedDelay > 0) {
      // Delay the note if compensation is positive
      setTimeout(() => {
        this.sendNoteOn(note, velocity);
        setTimeout(() => {
          this.sendNoteOff(note);
        }, duration);
      }, compensatedDelay);
    } else {
      // Send immediately (or handle negative compensation in the component)
      this.sendNoteOn(note, velocity);
      setTimeout(() => {
        this.sendNoteOff(note);
      }, duration);
    }

    return true;
  }

  /**
   * Send a scheduled note with precise timing
   * @param {number} note - MIDI note number
   * @param {number} duration - Note duration in milliseconds
   * @param {number} velocity - Note velocity
   * @param {number} delay - Delay before sending (for latency compensation)
   */
  sendScheduledNote(note = this.currentNote, duration = 100, velocity = this.noteVelocity, delay = 0) {
    if (!this.isConnected) return false;

    const actualDelay = Math.max(0, delay + this.latencyCompensation);
    
    if (actualDelay > 0) {
      setTimeout(() => {
        this.sendNoteOn(note, velocity);
        setTimeout(() => {
          this.sendNoteOff(note);
        }, duration);
      }, actualDelay);
    } else {
      // Send immediately if no delay
      this.sendNoteOn(note, velocity);
      setTimeout(() => {
        this.sendNoteOff(note);
      }, duration);
    }

    return true;
  }

  /**
   * Send a MIDI CC (Control Change) message
   * @param {number} controller - CC number (0-127)
   * @param {number} value - CC value (0-127)
   * @param {number} channel - MIDI channel (0-15)
   */
  sendCC(controller, value, channel = this.noteChannel) {
    if (!this.isConnected || !this.output) {
      return false;
    }

    try {
      this.output.send('cc', {
        controller: controller,
        value: value,
        channel: channel
      });
      return true;
    } catch (error) {
      console.error('Failed to send CC:', error);
      return false;
    }
  }

  /**
   * Send a MIDI clock message
   */
  sendClock() {
    if (!this.isConnected || !this.output) {
      return false;
    }

    try {
      this.output.send('clock');
      return true;
    } catch (error) {
      console.error('Failed to send clock:', error);
      return false;
    }
  }

  /**
   * Send MIDI start message
   */
  sendStart() {
    if (!this.isConnected || !this.output) {
      return false;
    }

    try {
      this.output.send('start');
      return true;
    } catch (error) {
      console.error('Failed to send start:', error);
      return false;
    }
  }

  /**
   * Send MIDI stop message
   */
  sendStop() {
    if (!this.isConnected || !this.output) {
      return false;
    }

    try {
      this.output.send('stop');
      return true;
    } catch (error) {
      console.error('Failed to send stop:', error);
      return false;
    }
  }

  /**
   * Set the current note to be played
   * @param {number} note - MIDI note number or note name string
   */
  setNote(note) {
    if (typeof note === 'string' && this.notes[note]) {
      this.currentNote = this.notes[note];
    } else if (typeof note === 'number' && note >= 0 && note <= 127) {
      this.currentNote = note;
    }
  }

  /**
   * Set the velocity for notes
   * @param {number} velocity - Note velocity (0-127)
   */
  setVelocity(velocity) {
    this.noteVelocity = Math.max(0, Math.min(127, velocity));
  }

  /**
   * Set the MIDI channel
   * @param {number} channel - MIDI channel (1-16, will be converted to 0-15)
   */
  setChannel(channel) {
    this.noteChannel = Math.max(0, Math.min(15, channel - 1));
  }

  /**
   * Set the latency compensation in milliseconds
   * @param {number} ms - Latency compensation (-100 to 100ms)
   */
  setLatencyCompensation(ms) {
    // Clamp between -100 and 100ms
    this.latencyCompensation = Math.max(-100, Math.min(100, ms));
  }

  /**
   * Get the current latency compensation
   * @returns {number} Current latency compensation in ms
   */
  getLatencyCompensation() {
    return this.latencyCompensation;
  }

  /**
   * Get list of available MIDI outputs
   */
  static getOutputs() {
    try {
      return easymidi.getOutputs();
    } catch (error) {
      console.error('Failed to get MIDI outputs:', error);
      return [];
    }
  }

  /**
   * Clean up and close the MIDI port
   */
  close() {
    if (this.output) {
      try {
        // Send all notes off before closing
        for (let i = 0; i < 128; i++) {
          this.sendNoteOff(i);
        }
        
        this.output.close();
        this.output = null;
        this.isConnected = false;
        console.log(`Virtual MIDI port "${this.portName}" closed`);
      } catch (error) {
        console.error('Error closing MIDI port:', error);
      }
    }
  }
}

export default MidiService;
