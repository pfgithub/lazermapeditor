export class AudioController {
  private audioContext: AudioContext;
  private audioBuffer: AudioBuffer | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;

  private isPlaying = false;
  private startTime = 0; // of the context
  private startOffset = 0; // in the buffer

  // Callbacks for React state updates
  public onPlay: () => void = () => {};
  public onPause: () => void = () => {};
  public onEnded: () => void = () => {};
  public onBufferLoad: (buffer: AudioBuffer) => void = () => {};

  constructor() {
    // Safari requires the context to be created or resumed after a user gesture.
    // We'll handle this in the play() method.
    this.audioContext = new AudioContext();
  }

  public async load(url: string) {
    if (this.isPlaying) this.pause();
    this.startOffset = 0;

    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
    this.onBufferLoad(this.audioBuffer);
  }

  public play() {
    if (this.isPlaying || !this.audioBuffer) return;
    if (this.audioContext.state === "suspended") {
      this.audioContext.resume();
    }

    if (this.sourceNode) {
      this.sourceNode.stop();
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    this.sourceNode = this.audioContext.createBufferSource();
    this.sourceNode.buffer = this.audioBuffer;
    this.sourceNode.connect(this.audioContext.destination);

    this.sourceNode.onended = () => {
      // This logic runs only when the audio finishes playing naturally.
      // Manual pauses/seeks will set isPlaying to false or replace the node.
      if (this.isPlaying) {
        this.isPlaying = false;
        this.onPause();
        // Reset to beginning
        this.startOffset = 0;
        this.onEnded();
      }
    };

    this.sourceNode.start(0, this.startOffset % this.audioBuffer.duration);
    this.startTime = this.audioContext.currentTime;
    this.isPlaying = true;
    this.onPlay();
  }

  public pause() {
    if (!this.isPlaying || !this.sourceNode) return;

    const elapsedTime = this.audioContext.currentTime - this.startTime;
    this.startOffset += elapsedTime;

    // Set isPlaying to false *before* stop() to prevent onended logic
    const wasPlaying = this.isPlaying;
    this.isPlaying = false;

    this.sourceNode.stop();
    this.sourceNode.disconnect();
    this.sourceNode = null;

    if (wasPlaying) this.onPause();
  }

  public seek(time: number) {
    if (!this.audioBuffer) return;
    const newTime = Math.max(0, Math.min(time, this.audioBuffer.duration));

    const wasPlaying = this.isPlaying;
    if (wasPlaying) {
      this.pause();
    }
    this.startOffset = newTime;
    if (wasPlaying) {
      this.play();
    }
  }

  public getCurrentTime(): number {
    if (this.isPlaying) {
      const elapsedTime = this.audioContext.currentTime - this.startTime;
      return this.startOffset + elapsedTime;
    }
    return this.startOffset;
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public getDuration(): number {
    return this.audioBuffer?.duration ?? 0;
  }

  public cleanup() {
    this.pause();
    this.audioContext.close().catch((e) => console.error("Error closing AudioContext", e));
  }
}
