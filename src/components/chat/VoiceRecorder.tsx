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
      <Button variant="ghost" size="sm" disabled className="h-9 w-9 p-0">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </Button>
    );
  }

  if (isRecording) {
    return (
      <div className="absolute bottom-full left-0 right-0 mx-2 mb-2 z-50 flex items-center justify-between gap-2 bg-gradient-to-r from-primary to-primary/90 backdrop-blur-sm px-3 py-2 rounded-lg shadow-lg border border-primary/30 animate-in slide-in-from-bottom-2 duration-200">
        <div className="flex items-center gap-2">
          <div className="relative">
            <div className="absolute inset-0 bg-white/30 rounded-full animate-ping" />
            <Mic className="h-4 w-4 text-white relative z-10" />
          </div>
          <span className="text-xs sm:text-sm font-medium text-white">
            {t('voice.recording')}
          </span>
        </div>
        
        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-white/20 rounded-md">
          <div className={cn(
            "h-1.5 w-1.5 rounded-full bg-white",
            remainingSeconds <= 10 && "animate-pulse"
          )} />
          <span className="text-xs sm:text-sm font-semibold text-white tabular-nums min-w-[1.5rem]">
            {remainingSeconds}s
          </span>
        </div>
        
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCancelRecording}
            title={t('voice.cancelRecording')}
            className="h-7 w-7 p-0 text-white/80 hover:text-white hover:bg-white/20 rounded-md transition-colors"
          >
            <X className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleStopRecording}
            title={t('voice.stopRecording')}
            className="h-7 w-7 p-0 bg-white/20 hover:bg-white/30 text-white rounded-md transition-colors"
          >
            <Square className="h-3.5 w-3.5 fill-white" />
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
      className="h-9 w-9 p-0 text-muted-foreground hover:text-foreground transition-colors"
    >
      <Mic className="h-5 w-5" />
    </Button>
  );
};
