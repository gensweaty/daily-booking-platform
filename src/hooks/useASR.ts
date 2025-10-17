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
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 48000
        } 
      });
      
      // Try best audio format for Whisper compatibility
      // Mobile Safari prefers different codecs
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      let mime = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mime)) {
        mime = 'audio/webm';
        if (!MediaRecorder.isTypeSupported(mime)) {
          mime = 'audio/mp4';
          if (!MediaRecorder.isTypeSupported(mime)) {
            mime = ''; // Let browser choose
          }
        }
      }
      
      console.log('🎤 Using MIME type:', mime, 'Mobile:', isMobile);
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : {});
      mediaRecorderRef.current = mr;
      chunksRef.current = [];
      
      mr.ondataavailable = e => {
        if (e.data.size > 0) {
          console.log('🎤 Received audio chunk:', e.data.size, 'bytes, total chunks:', chunksRef.current.length + 1);
          chunksRef.current.push(e.data);
        }
      };

      setSeconds(0);
      setStatus('recording');
      // Mobile: smaller timeslice for better chunk collection and immediate feedback
      mr.start(isMobile ? 250 : 100);

      // 60s maximum duration - auto-stop at limit
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
      
      // Set up one-time stop handler with minimal delay for instant feedback
      const handleStop = () => {
        console.log('🎤 Recording stopped, chunks collected:', chunksRef.current.length);
        mr.stream.getTracks().forEach(t => t.stop());
        setStatus('idle');
        
        // Minimal delay just for buffer flush - mobile needs instant feedback
        setTimeout(() => {
          const totalSize = chunksRef.current.reduce((sum, chunk) => sum + chunk.size, 0);
          console.log('🎤 Final chunk count:', chunksRef.current.length, 'Total size:', totalSize, 'bytes');
          resolve();
        }, 150);
      };
      
      mr.addEventListener('stop', handleStop, { once: true });
      mr.stop();
    });
  }

  async function transcribe(): Promise<ASRResult> {
    console.log('🎤 Starting transcription, chunks available:', chunksRef.current.length);
    
    if (chunksRef.current.length === 0) {
      throw new Error('No audio recorded. Please try again.');
    }
    
    const blob = new Blob(chunksRef.current, { type: chunksRef.current[0]?.type || 'audio/webm' });
    console.log('🎤 Blob created, size:', blob.size, 'bytes, type:', blob.type);
    
    if (blob.size === 0) {
      throw new Error('No audio recorded. Please try again.');
    }
    
    // Relaxed size check - only catch truly empty recordings
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const minSize = isMobile ? 1000 : 2000;
    
    if (blob.size < minSize) {
      console.warn('⚠️ Audio blob is very small:', blob.size, 'bytes');
      throw new Error('Recording too short. Please try again.');
    }
    
    setStatus('transcribing');
    console.log('🎤 Loading Whisper model...');
    
    try {
      // Lazy-load transformers
      const { pipeline } = await import('@huggingface/transformers');

      // Convert to 16k mono Float32
      console.log('🎤 Converting audio to 16kHz mono...');
      let floatData: Float32Array;
      
      try {
        floatData = await blobToMono16kFloat32(blob);
        console.log('🎤 Audio converted successfully, samples:', floatData.length, 'duration:', (floatData.length / 16000).toFixed(2), 'seconds');
      } catch (convErr) {
        console.error('❌ Audio conversion error:', convErr);
        // Mobile-specific error messages
        if (isMobile && convErr instanceof Error && convErr.message.includes('decode')) {
          throw new Error('Audio format not supported. Try again or use a different device.');
        }
        throw new Error('Failed to process audio. Please try recording again.');
      }
      
      // Audio quality check - only log for debugging, don't block on mobile
      const sampleSize = Math.min(floatData.length, 10000);
      const samples = Array.from(floatData.slice(0, sampleSize));
      const maxAmplitude = Math.max(...samples.map(Math.abs));
      const avgAmplitude = samples.reduce((sum, val) => sum + Math.abs(val), 0) / sampleSize;
      console.log('🎤 Audio quality - Max amplitude:', maxAmplitude.toFixed(4), 'Avg amplitude:', avgAmplitude.toFixed(6));
      
      // Skip amplitude validation on mobile - too many false positives due to codec/hardware variance
      // Let Whisper handle audio quality detection instead
      if (!isMobile && maxAmplitude < 0.001) {
        console.warn('⚠️ Very quiet audio detected, but proceeding anyway');
      }

      // Build ASR pipeline with base model for better balance
      console.log('🎤 Loading Whisper model (first time may take 30-60 seconds)...');
      const asr = await pipeline('automatic-speech-recognition', 'Xenova/whisper-base');

      console.log('🎤 Running transcription...');
      const out = await asr(floatData, {
        chunk_length_s: 30,
        stride_length_s: 5,
        task: 'transcribe',
        return_timestamps: false,
        language: null, // Auto-detect
      }) as any;

      console.log('🎤 Transcription result:', JSON.stringify(out));
      
      const transcribedText = out.text?.trim() || '';
      console.log('🎤 Final text:', JSON.stringify(transcribedText), 'length:', transcribedText.length);
      
      if (transcribedText.length === 0) {
        throw new Error('No speech detected. Please speak clearly and try again.');
      }
      
      setStatus('idle');
      return { text: transcribedText, language: out.language };
      
    } catch (err) {
      console.error('❌ Transcription error:', err);
      setStatus('error');
      
      if (err instanceof Error) {
        // Pass through our custom error messages
        if (err.message.includes('audio') || 
            err.message.includes('quiet') || 
            err.message.includes('speech') || 
            err.message.includes('format') ||
            err.message.includes('short') ||
            err.message.includes('supported')) {
          throw err;
        }
      }
      
      // Generic fallback with mobile hint
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const hint = isMobile ? ' Try using headphones or a quieter location.' : '';
      throw new Error('Voice transcription failed.' + hint + ' Please try recording again.');
    } finally {
      chunksRef.current = [];
    }
  }

  return { start, stop, transcribe, status, seconds };
}

// --- helpers ---

async function blobToMono16kFloat32(blob: Blob): Promise<Float32Array> {
  const arrayBuffer = await blob.arrayBuffer();
  console.log('🎤 ArrayBuffer size:', arrayBuffer.byteLength);
  
  if (arrayBuffer.byteLength === 0) {
    throw new Error('Empty audio buffer');
  }
  
  // Create AudioContext with default sample rate
  // Mobile Safari requires proper context handling
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  const ctx = new AudioContextClass();
  console.log('🎤 AudioContext sample rate:', ctx.sampleRate);
  
  let audio: AudioBuffer;
  try {
    // Mobile devices may need a copy of the buffer to prevent memory issues
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const bufferToUse = isMobile ? arrayBuffer.slice(0) : arrayBuffer;
    audio = await ctx.decodeAudioData(bufferToUse);
  } catch (decodeErr) {
    await ctx.close();
    console.error('🎤 Audio decode error:', decodeErr);
    throw new Error('Audio decode failed - unsupported format');
  }
  
  console.log('🎤 Decoded audio:', {
    duration: audio.duration.toFixed(2) + 's',
    channels: audio.numberOfChannels,
    sampleRate: audio.sampleRate,
    length: audio.length
  });
  
  // Relaxed duration check - only catch truly invalid recordings
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const minDuration = isMobile ? 0.1 : 0.2;
  
  if (audio.duration < minDuration) {
    await ctx.close();
    throw new Error('Recording too short. Please try again.');
  }
  
  // Mix down to mono with proper handling for silent channels
  const monoData = new Float32Array(audio.length);
  if (audio.numberOfChannels === 1) {
    const channel = audio.getChannelData(0);
    monoData.set(channel);
  } else {
    const left = audio.getChannelData(0);
    const right = audio.getChannelData(1);
    for (let i = 0; i < audio.length; i++) {
      monoData[i] = (left[i] + right[i]) / 2;
    }
  }
  
  // Resample to 16kHz with mobile-optimized processing
  const targetSampleRate = 16000;
  const targetLength = Math.ceil(audio.duration * targetSampleRate);
  
  console.log('🎤 Resampling from', audio.sampleRate, 'Hz to 16kHz, target length:', targetLength);
  
  try {
    const offlineCtx = new OfflineAudioContext(1, targetLength, targetSampleRate);
    const buffer = offlineCtx.createBuffer(1, monoData.length, audio.sampleRate);
    buffer.copyToChannel(monoData, 0);
    
    const source = offlineCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(offlineCtx.destination);
    source.start(0);
    
    const resampled = await offlineCtx.startRendering();
    const resampledData = resampled.getChannelData(0);
    
    console.log('🎤 Resampled to', resampledData.length, 'samples');
    
    await ctx.close();
    
    return resampledData;
  } catch (resampleErr) {
    await ctx.close();
    console.error('🎤 Resampling error:', resampleErr);
    throw new Error('Audio processing failed');
  }
}

