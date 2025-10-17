import { useState, useEffect, useRef } from 'react';
import { Mic, Square, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AudioRecorder, audioBlobToBase64 } from '@/utils/audioRecorder';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

interface VoiceRecorderProps {
  onRecordingComplete: (audioBase64: string) => void;
  onError: (error: string) => void;
  disabled?: boolean;
}

export const VoiceRecorder = ({ onRecordingComplete, onError, disabled }: VoiceRecorderProps) => {
  const { t } = useLanguage();
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(60);
  const recorderRef = useRef<AudioRecorder | null>(null);

  useEffect(() => {
    return () => {
      if (recorderRef.current) {
        recorderRef.current.cancel();
      }
    };
  }, []);

  const handleStartRecording = async () => {
    try {
      const recorder = new AudioRecorder(
        async (audioBlob) => {
          setIsRecording(false);
          setIsProcessing(true);
          
          try {
            const base64Audio = await audioBlobToBase64(audioBlob);
            onRecordingComplete(base64Audio);
          } catch (error) {
            console.error('Error converting audio:', error);
            onError(t('voice.transcriptionFailed'));
          } finally {
            setIsProcessing(false);
          }
        },
        (error) => {
          console.error('Recording error:', error);
          setIsRecording(false);
          
          if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
            onError(t('voice.permissionDenied'));
          } else {
            onError(t('voice.recordingError'));
          }
        }
      );

      recorder.setOnDurationUpdate((seconds) => {
        setRemainingSeconds(seconds);
      });

      recorder.setOnMaxDurationReached(() => {
        console.log('Max duration reached');
      });

      recorderRef.current = recorder;
      await recorder.start();
      setIsRecording(true);
      setRemainingSeconds(60);
    } catch (error) {
      console.error('Error starting recording:', error);
      onError(t('voice.recordingError'));
    }
  };

  const handleStopRecording = () => {
    if (recorderRef.current) {
      recorderRef.current.stop();
    }
  };

  const handleCancelRecording = () => {
    if (recorderRef.current) {
      recorderRef.current.cancel();
      recorderRef.current = null;
    }
    setIsRecording(false);
    setRemainingSeconds(60);
  };

  if (isProcessing) {
    return (
      <Button variant="ghost" size="sm" disabled className="h-6 w-6 p-0">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
      </Button>
    );
  }

  if (isRecording) {
    return (
      <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-50 flex items-center gap-3 bg-gradient-to-r from-primary/90 to-primary/80 backdrop-blur-sm px-6 py-3 rounded-full shadow-2xl border border-primary/20 animate-in slide-in-from-bottom-5 duration-300">
        <div className="flex items-center gap-2">
          <div className="relative">
            <div className="absolute inset-0 bg-white/30 rounded-full animate-ping" />
            <Mic className="h-5 w-5 text-white relative z-10" />
          </div>
          <span className="text-sm font-medium text-white">
            {t('voice.recording')}
          </span>
        </div>
        
        <div className="flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full">
          <div className={cn(
            "h-2 w-2 rounded-full bg-white",
            remainingSeconds <= 10 && "animate-pulse"
          )} />
          <span className="text-sm font-bold text-white min-w-[2.5rem] text-center">
            {remainingSeconds}s
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCancelRecording}
            title={t('voice.cancelRecording')}
            className="h-8 w-8 p-0 text-white/80 hover:text-white hover:bg-white/20 rounded-full"
          >
            <X className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleStopRecording}
            title={t('voice.stopRecording')}
            className="h-8 w-8 p-0 bg-white/20 hover:bg-white/30 text-white rounded-full"
          >
            <Square className="h-5 w-5 fill-white" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleStartRecording}
      disabled={disabled}
      title={t('voice.startRecording')}
      className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
    >
      <Mic className="h-4 w-4" />
    </Button>
  );
};
