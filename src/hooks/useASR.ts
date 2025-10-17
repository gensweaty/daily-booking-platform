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
      mr.onstop = () => stream.getTracks().forEach(t => t.stop());

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

  function stop() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }

  async function transcribe(): Promise<ASRResult> {
    const blob = new Blob(chunksRef.current, { type: chunksRef.current[0]?.type || 'audio/webm' });
    if (blob.size === 0) throw new Error('No audio data recorded');
    
    setStatus('transcribing');
    try {
      // Lazy-load transformers to avoid initial bundle impact
      const { pipeline } = await import('@huggingface/transformers');

      // Convert to 16k mono Float32
      const floatData = await blobToMono16kFloat32(blob);

      // Build ASR pipeline with tiny model (multilingual)
      const asr = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny');

      const out = await asr(floatData, {
        chunk_length_s: 30,
        stride_length_s: 5,
        task: 'transcribe',
        return_timestamps: false,
      }) as any;

      setStatus('idle');
      return { text: out.text?.trim() || '', language: out.language };
    } catch (err) {
      console.error('Whisper transcription failed:', err);
      // Fallback to Web Speech API if available
      try {
        const text = await webSpeechFallback(blob);
        setStatus('idle');
        return { text };
      } catch (e) {
        console.error('Web Speech API fallback failed:', e);
        setStatus('error');
        throw new Error('Transcription failed. Please try again.');
      }
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

function webSpeechFallback(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return reject(new Error('Web Speech API not supported'));
    
    const rec = new SR();
    rec.lang = 'en-US'; // can be switched dynamically
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.continuous = false;
    
    let text = '';
    rec.onresult = (e: any) => { 
      text = e.results[0]?.[0]?.transcript || ''; 
    };
    rec.onerror = (e: any) => reject(new Error(e.error || 'Speech recognition error'));
    rec.onend = () => text ? resolve(text) : reject(new Error('No speech detected'));
    
    // Play the blob through an audio element to trigger recognition
    const audio = new Audio(URL.createObjectURL(blob));
    audio.onplay = () => rec.start();
    audio.play().catch(err => reject(err));
  });
}
