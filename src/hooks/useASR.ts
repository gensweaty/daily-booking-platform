import { useRef, useState } from 'react';

type Status = 'idle' | 'recording' | 'transcribing' | 'error';
type ASRResult = { text: string; language?: string };

export function useASR() {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [seconds, setSeconds] = useState(0);
  const timerRef = useRef<number | null>(null);

  async function start() {
    if (status !== 'idle') return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      const mr = new MediaRecorder(stream, { mimeType: mime });
      mediaRecorderRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = e => e.data.size && chunksRef.current.push(e.data);

      setSeconds(0);
      setStatus('recording');
      mr.start();

      // 60s hard cap
      timerRef.current = window.setInterval(() => {
        setSeconds(s => {
          const next = s + 1;
          if (next >= 60) {
            stop(); // auto-stop at 60s
            return 60;
          }
          return next;
        });
      }, 1000) as unknown as number;
    } catch (err) {
      console.error('Mic permission denied or unavailable:', err);
      setStatus('error');
      throw err;
    }
  }

  function stop(): Promise<void> {
    return new Promise((resolve) => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      const mr = mediaRecorderRef.current;
      if (!mr || mr.state !== 'recording') {
        setStatus('idle');
        resolve();
        return;
      }
      
      // Set up one-time stop handler
      const handleStop = () => {
        console.log('🎤 Recording stopped, chunks collected:', chunksRef.current.length);
        mr.stream.getTracks().forEach(t => t.stop());
        setStatus('idle');
        
        // Small delay to ensure all chunks are fully captured
        setTimeout(() => {
          console.log('🎤 Final chunk count:', chunksRef.current.length, 'Total size:', chunksRef.current.reduce((sum, chunk) => sum + chunk.size, 0), 'bytes');
          resolve();
        }, 100);
      };
      
      mr.addEventListener('stop', handleStop, { once: true });
      mr.stop();
    });
  }

  async function transcribe(): Promise<ASRResult> {
    console.log('🎤 Starting transcription, chunks available:', chunksRef.current.length);
    const blob = new Blob(chunksRef.current, { type: chunksRef.current[0]?.type || 'audio/webm' });
    console.log('🎤 Blob created, size:', blob.size, 'bytes');
    
    if (blob.size === 0) {
      throw new Error('No audio data recorded. Please try again.');
    }
    
    if (blob.size < 1000) {
      throw new Error('Recording too short or silent. Please speak clearly.');
    }
    
    setStatus('transcribing');
    console.log('🎤 Loading Whisper model...');
    try {
      // Lazy-load transformers to avoid initial bundle impact
      const { pipeline } = await import('@huggingface/transformers');

      // Convert to 16k mono Float32
      console.log('🎤 Converting audio to 16kHz mono...');
      const floatData = await blobToMono16kFloat32(blob);
      console.log('🎤 Audio converted, samples:', floatData.length);
      
      // Check if audio data is silent (all values near zero)
      const avgAmplitude = floatData.reduce((sum, val) => sum + Math.abs(val), 0) / floatData.length;
      console.log('🎤 Average amplitude:', avgAmplitude);
      if (avgAmplitude < 0.001) {
        throw new Error('No speech detected in recording. Check microphone permissions.');
      }

      // Build ASR pipeline with tiny model (multilingual)
      console.log('🎤 Loading Whisper model pipeline...');
      const asr = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny');

      console.log('🎤 Running transcription...');
      const out = await asr(floatData, {
        chunk_length_s: 30,
        stride_length_s: 5,
        task: 'transcribe',
        return_timestamps: false,
      }) as any;

      console.log('🎤 Transcription complete:', out);
      setStatus('idle');
      return { text: out.text?.trim() || '', language: out.language };
    } catch (err) {
      console.error('Whisper transcription failed:', err);
      setStatus('error');
      
      // Provide user-friendly error messages
      if (err instanceof Error) {
        if (err.message.includes('audio data') || err.message.includes('speech detected') || err.message.includes('too short')) {
          throw err; // Re-throw our custom errors
        }
        throw new Error('Transcription failed. Please check your internet connection and try again.');
      }
      throw new Error('Transcription failed. Please try again.');
    } finally {
      chunksRef.current = [];
    }
  }

  return { start, stop, transcribe, status, seconds };
}

// --- helpers ---

async function blobToMono16kFloat32(blob: Blob): Promise<Float32Array> {
  const arrayBuffer = await blob.arrayBuffer();
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const audio = await ctx.decodeAudioData(arrayBuffer.slice(0));
  
  // Resample to 16k mono
  const offline = new OfflineAudioContext(1, Math.ceil(audio.duration * 16000), 16000);
  const src = offline.createBufferSource();
  
  // mixdown to mono
  const mono = offline.createBuffer(1, audio.length, audio.sampleRate);
  if (audio.numberOfChannels === 1) {
    audio.copyFromChannel(mono.getChannelData(0), 0);
  } else {
    // Mix stereo to mono
    const left = audio.getChannelData(0);
    const right = audio.getChannelData(1);
    const monoData = mono.getChannelData(0);
    for (let i = 0; i < audio.length; i++) {
      monoData[i] = (left[i] + right[i]) / 2;
    }
  }
  
  src.buffer = mono;
  src.connect(offline.destination);
  src.start(0);
  const resampled = await offline.startRendering();
  return resampled.getChannelData(0);
}

