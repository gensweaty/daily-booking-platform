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
      let mime = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mime)) {
        mime = 'audio/webm';
        if (!MediaRecorder.isTypeSupported(mime)) {
          mime = 'audio/mp4';
        }
      }
      
      console.log('🎤 Using MIME type:', mime);
      const mr = new MediaRecorder(stream, { mimeType: mime });
      mediaRecorderRef.current = mr;
      chunksRef.current = [];
      
      mr.ondataavailable = e => {
        if (e.data.size > 0) {
          console.log('🎤 Received audio chunk:', e.data.size, 'bytes');
          chunksRef.current.push(e.data);
        }
      };

      setSeconds(0);
      setStatus('recording');
      mr.start(100); // Collect data every 100ms for better reliability

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
    console.log('🎤 Blob created, size:', blob.size, 'bytes, type:', blob.type);
    
    // Only reject if completely empty
    if (blob.size === 0) {
      throw new Error('No audio data recorded. Please try again.');
    }
    
    // Warn if audio is suspiciously small
    if (blob.size < 1000) {
      console.warn('⚠️ Audio blob is very small, may not contain valid audio:', blob.size, 'bytes');
    }
    
    setStatus('transcribing');
    console.log('🎤 Loading Whisper model...');
    try {
      // Lazy-load transformers to avoid initial bundle impact
      const { pipeline } = await import('@huggingface/transformers');

      // Convert to 16k mono Float32
      console.log('🎤 Converting audio to 16kHz mono...');
      const floatData = await blobToMono16kFloat32(blob);
      console.log('🎤 Audio converted, samples:', floatData.length, 'duration:', (floatData.length / 16000).toFixed(2), 'seconds');
      
      // Check audio quality
      const maxAmplitude = Math.max(...Array.from(floatData).map(Math.abs));
      const avgAmplitude = Array.from(floatData).reduce((sum, val) => sum + Math.abs(val), 0) / floatData.length;
      console.log('🎤 Audio quality - Max amplitude:', maxAmplitude.toFixed(4), 'Avg amplitude:', avgAmplitude.toFixed(6));
      
      if (maxAmplitude < 0.001) {
        throw new Error('Audio is too quiet. Please speak louder or check your microphone.');
      }

      // Build ASR pipeline with small model for better accuracy (multilingual)
      console.log('🎤 Loading Whisper model pipeline (this may take a moment on first use)...');
      const asr = await pipeline('automatic-speech-recognition', 'Xenova/whisper-small');

      console.log('🎤 Running transcription with optimized settings...');
      const out = await asr(floatData, {
        chunk_length_s: 30,
        stride_length_s: 5,
        task: 'transcribe',
        return_timestamps: false,
        language: null, // Auto-detect language
        // Force better decoding
        num_beams: 1,
        temperature: 0.0,
      }) as any;

      console.log('🎤 Transcription complete:', JSON.stringify(out));
      
      // Check if we got actual text back
      const transcribedText = out.text?.trim() || '';
      console.log('🎤 Final transcribed text:', JSON.stringify(transcribedText), 'length:', transcribedText.length);
      
      if (transcribedText.length === 0 || transcribedText.length < 2) {
        setStatus('idle');
        throw new Error('Could not transcribe audio. Please speak clearly and try again.');
      }
      
      setStatus('idle');
      return { text: transcribedText, language: out.language };
    } catch (err) {
      console.error('❌ Whisper transcription failed:', err);
      setStatus('error');
      
      // Provide user-friendly error messages
      if (err instanceof Error) {
        if (err.message.includes('audio') || err.message.includes('quiet') || err.message.includes('transcribe')) {
          throw err; // Re-throw our custom errors
        }
        throw new Error('Transcription failed. Please try speaking more clearly or check your microphone.');
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
  try {
    const arrayBuffer = await blob.arrayBuffer();
    console.log('🎤 ArrayBuffer size:', arrayBuffer.byteLength);
    
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 48000 });
    console.log('🎤 AudioContext sample rate:', ctx.sampleRate);
    
    const audio = await ctx.decodeAudioData(arrayBuffer);
    console.log('🎤 Decoded audio:', {
      duration: audio.duration.toFixed(2) + 's',
      channels: audio.numberOfChannels,
      sampleRate: audio.sampleRate,
      length: audio.length
    });
    
    if (audio.duration < 0.1) {
      throw new Error('Audio too short (less than 0.1s)');
    }
    
    // First, mixdown to mono if stereo
    const monoData = new Float32Array(audio.length);
    if (audio.numberOfChannels === 1) {
      const channel = audio.getChannelData(0);
      for (let i = 0; i < audio.length; i++) {
        monoData[i] = channel[i];
      }
    } else {
      // Mix all channels to mono
      const left = audio.getChannelData(0);
      const right = audio.numberOfChannels > 1 ? audio.getChannelData(1) : left;
      for (let i = 0; i < audio.length; i++) {
        monoData[i] = (left[i] + right[i]) / 2;
      }
    }
    
    // Resample to 16kHz using OfflineAudioContext
    const targetSampleRate = 16000;
    const targetLength = Math.ceil(audio.duration * targetSampleRate);
    
    console.log('🎤 Resampling to 16kHz, target length:', targetLength);
    
    const offlineCtx = new OfflineAudioContext(1, targetLength, targetSampleRate);
    const buffer = offlineCtx.createBuffer(1, monoData.length, audio.sampleRate);
    buffer.copyToChannel(monoData, 0);
    
    const source = offlineCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(offlineCtx.destination);
    source.start(0);
    
    const resampled = await offlineCtx.startRendering();
    const resampledData = resampled.getChannelData(0);
    
    console.log('🎤 Resampled audio:', resampledData.length, 'samples at 16kHz');
    
    // Validate resampled data
    const hasNonZero = Array.from(resampledData).some(v => Math.abs(v) > 0.0001);
    if (!hasNonZero) {
      throw new Error('Audio contains only silence');
    }
    
    await ctx.close();
    
    return resampledData;
  } catch (err) {
    console.error('❌ Audio conversion failed:', err);
    throw new Error('Failed to process audio. Please try again.');
  }
}

