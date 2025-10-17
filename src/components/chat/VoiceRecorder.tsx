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
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCancelRecording}
          title={t('voice.cancelRecording')}
          className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleStopRecording}
          className={cn(
            "relative h-6 w-6 p-0",
            remainingSeconds <= 10 && "animate-pulse"
          )}
          title={t('voice.stopRecording')}
        >
          <div className="absolute inset-0 rounded-full bg-destructive/20 animate-ping" />
          <Square className="h-4 w-4 text-destructive fill-destructive relative z-10" />
        </Button>
        <span className="text-xs font-medium text-muted-foreground min-w-[2rem] text-right">
          {remainingSeconds}s
        </span>
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
