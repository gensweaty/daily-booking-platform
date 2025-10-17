export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private startTime: number = 0;
  private maxDuration: number = 60000; // 60 seconds
  private durationInterval: NodeJS.Timeout | null = null;
  private onDurationUpdate?: (seconds: number) => void;
  private onMaxDurationReached?: () => void;

  constructor(
    private onComplete: (audioBlob: Blob) => void,
    private onError: (error: Error) => void
  ) {}

  setOnDurationUpdate(callback: (seconds: number) => void) {
    this.onDurationUpdate = callback;
  }

  setOnMaxDurationReached(callback: () => void) {
    this.onMaxDurationReached = callback;
  }

  async start(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      this.audioChunks = [];
      this.startTime = Date.now();

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        this.onComplete(audioBlob);
        this.cleanup();
      };

      this.mediaRecorder.start();

      // Start duration tracking
      this.durationInterval = setInterval(() => {
        const elapsed = Date.now() - this.startTime;
        const remainingSeconds = Math.max(0, Math.ceil((this.maxDuration - elapsed) / 1000));
        
        if (this.onDurationUpdate) {
          this.onDurationUpdate(remainingSeconds);
        }

        if (elapsed >= this.maxDuration) {
          if (this.onMaxDurationReached) {
            this.onMaxDurationReached();
          }
          this.stop();
        }
      }, 100);

    } catch (error) {
      this.onError(error as Error);
      this.cleanup();
    }
  }

  stop(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
  }

  cancel(): void {
    this.cleanup();
  }

  private cleanup(): void {
    if (this.durationInterval) {
      clearInterval(this.durationInterval);
      this.durationInterval = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    this.mediaRecorder = null;
    this.audioChunks = [];
  }

  getCurrentDuration(): number {
    if (this.startTime === 0) return 0;
    return Math.floor((Date.now() - this.startTime) / 1000);
  }
}

export const audioBlobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};
