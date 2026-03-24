import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2, Video, Camera, Mic, ArrowLeft, Play, Square, Upload, Eye, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { RecordingStageOverlay, RECORDING_STAGES } from "@/components/VideoKYC/RecordingStageOverlay";
import { useRecordingStages } from "@/hooks/useRecordingStages";
import { trackVideoKYCComplete } from "@/utils/analytics";

interface VideoKYCStepProps {
  onComplete: () => void;
  onBack: () => void;
  isCompleted: boolean;
  applicantName: string;
  applicationId?: string;
  orgId?: string;
}

export function VideoKYCStep({
  onComplete,
  onBack,
  isCompleted,
  applicantName,
  applicationId,
  orgId,
}: VideoKYCStepProps) {
  const [step, setStep] = useState<'instructions' | 'permissions' | 'recording' | 'uploading' | 'completed'>('instructions');
  const [hasPermissions, setHasPermissions] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [checkingPermissions, setCheckingPermissions] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Recording stages hook
  const {
    currentStageIndex,
    stageTimeRemaining,
    allStagesComplete,
    advanceStage,
    minRecordingTime,
  } = useRecordingStages({ isRecording });

  // DEBUG: useEffect to re-attach stream when video element becomes available
  // Using a small delay to ensure DOM is fully updated after step change
  useEffect(() => {
    console.log('[VideoKYC] useEffect triggered - step:', step, 
      'streamRef exists:', !!streamRef.current, 
      'videoRef exists:', !!videoRef.current,
      'videoRef.srcObject exists:', !!videoRef.current?.srcObject);
    
    // Re-attach stream when video element becomes available
    const attachStream = () => {
      if (videoRef.current && streamRef.current) {
        console.log('[VideoKYC] Attempting to attach stream to video element');
        console.log('[VideoKYC] Stream still active:', streamRef.current.active);
        console.log('[VideoKYC] Video tracks:', streamRef.current.getVideoTracks().map(t => ({
          enabled: t.enabled,
          readyState: t.readyState,
          muted: t.muted
        })));
        
        videoRef.current.srcObject = streamRef.current;
        console.log('[VideoKYC] srcObject assigned, calling play()...');
        
        videoRef.current.play().then(() => {
          console.log('[VideoKYC] Video playback started successfully!');
        }).catch(err => {
          console.error('[VideoKYC] Video playback failed:', err);
        });
      } else {
        console.warn('[VideoKYC] Cannot attach stream - videoRef:', !!videoRef.current, 'streamRef:', !!streamRef.current);
      }
    };

    // Use requestAnimationFrame + small timeout to ensure DOM is ready
    if ((step === 'permissions' || step === 'recording') && streamRef.current) {
      console.log('[VideoKYC] Step requires video, scheduling stream attachment...');
      requestAnimationFrame(() => {
        setTimeout(attachStream, 100);
      });
    }
  }, [step]);

  const checkPermissions = async () => {
    console.log('[VideoKYC] checkPermissions started, current step:', step);
    setCheckingPermissions(true);
    try {
      console.log('[VideoKYC] Requesting getUserMedia...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 },
        audio: true,
      });
      
      console.log('[VideoKYC] Stream obtained:', {
        id: stream.id,
        active: stream.active,
        videoTracks: stream.getVideoTracks().length,
        audioTracks: stream.getAudioTracks().length,
        videoTrackSettings: stream.getVideoTracks()[0]?.getSettings(),
        videoTrackEnabled: stream.getVideoTracks()[0]?.enabled,
        videoTrackReadyState: stream.getVideoTracks()[0]?.readyState
      });
      
      streamRef.current = stream;
      console.log('[VideoKYC] videoRef.current exists?', !!videoRef.current);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        console.log('[VideoKYC] Stream assigned to video element directly');
      } else {
        console.warn('[VideoKYC] VIDEO ELEMENT NOT MOUNTED - stream will be attached via useEffect');
      }
      
      setHasPermissions(true);
      setStep('permissions');
      console.log('[VideoKYC] Step changed to permissions, hasPermissions set to true');
      toast.success("Camera and microphone access granted");
    } catch (error) {
      console.error('[VideoKYC] Permission error:', error);
      toast.error("Please allow camera and microphone access to proceed");
    } finally {
      setCheckingPermissions(false);
    }
  };

  const startRecording = useCallback(async () => {
    console.log('[VideoKYC] startRecording called');
    console.log('[VideoKYC] streamRef exists:', !!streamRef.current);
    console.log('[VideoKYC] Stream active:', streamRef.current?.active);
    console.log('[VideoKYC] Stream tracks:', streamRef.current?.getTracks().map(t => ({
      kind: t.kind,
      enabled: t.enabled,
      readyState: t.readyState
    })));
    
    if (!streamRef.current) {
      console.error('[VideoKYC] No stream available for recording');
      toast.error("Camera not available");
      return;
    }

    try {
      // Check for supported mime types
      const mimeTypes = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm',
        'video/mp4'
      ];

      let selectedMimeType = '';
      console.log('[VideoKYC] Checking mime type support...');
      for (const type of mimeTypes) {
        const supported = MediaRecorder.isTypeSupported(type);
        console.log(`[VideoKYC] ${type}: ${supported ? 'SUPPORTED' : 'not supported'}`);
        if (supported && !selectedMimeType) {
          selectedMimeType = type;
        }
      }

      if (!selectedMimeType) {
        console.error('[VideoKYC] No supported mime type found!');
        toast.error("Your browser doesn't support video recording");
        return;
      }

      console.log('[VideoKYC] Using mime type:', selectedMimeType);
      
      chunksRef.current = [];
      const mediaRecorder = new MediaRecorder(streamRef.current, {
        mimeType: selectedMimeType,
      });

      console.log('[VideoKYC] MediaRecorder created, state:', mediaRecorder.state);

      mediaRecorder.ondataavailable = (event) => {
        console.log('[VideoKYC] Data chunk received, size:', event.data.size, 'type:', event.data.type);
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
          console.log('[VideoKYC] Total chunks:', chunksRef.current.length);
        }
      };

      mediaRecorder.onerror = (event) => {
        console.error('[VideoKYC] MediaRecorder error:', event);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000);
      console.log('[VideoKYC] MediaRecorder started, state:', mediaRecorder.state);
      
      setIsRecording(true);
      setStep('recording');
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);

    } catch (error) {
      console.error('[VideoKYC] Recording error:', error);
      toast.error("Failed to start recording");
    }
  }, []);

  const uploadVideo = async (videoBlob: Blob): Promise<boolean> => {
    if (!applicationId || !orgId) {
      console.error('Missing applicationId or orgId for upload');
      toast.error("Application data missing. Please try again.");
      return false;
    }

    setIsUploading(true);
    setStep('uploading');
    setUploadProgress(10);

    try {
      const formData = new FormData();
      formData.append('video', videoBlob, 'videokyc.webm');
      formData.append('application_id', applicationId);
      formData.append('org_id', orgId);

      setUploadProgress(30);

      const { data, error } = await supabase.functions.invoke('referral-videokyc-upload', {
        body: formData,
      });

      setUploadProgress(80);

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setUploadProgress(100);
      console.log('Video uploaded successfully:', data);
      return true;
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || "Failed to upload video. Please try again.");
      return false;
    } finally {
      setIsUploading(false);
    }
  };

  const stopRecording = useCallback(() => {
    console.log('[VideoKYC] stopRecording called');
    console.log('[VideoKYC] mediaRecorderRef exists:', !!mediaRecorderRef.current);
    console.log('[VideoKYC] isRecording:', isRecording);
    
    if (mediaRecorderRef.current && isRecording) {
      console.log('[VideoKYC] Stopping MediaRecorder, current state:', mediaRecorderRef.current.state);
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        console.log('[VideoKYC] Timer cleared');
      }

      // Handle the recording completion
      mediaRecorderRef.current.onstop = async () => {
        console.log('[VideoKYC] MediaRecorder onstop fired');
        console.log('[VideoKYC] Chunks count:', chunksRef.current.length);
        console.log('[VideoKYC] Chunks sizes:', chunksRef.current.map(c => c.size));
        
        // Stop the camera stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => {
            console.log('[VideoKYC] Stopping track:', track.kind);
            track.stop();
          });
        }

        // Create video blob from chunks
        const videoBlob = new Blob(chunksRef.current, { type: 'video/webm' });
        console.log('[VideoKYC] Recording completed, blob size:', videoBlob.size, 'type:', videoBlob.type);

        // Upload the video if we have application context
        if (applicationId && orgId) {
          console.log('[VideoKYC] Starting upload with applicationId:', applicationId, 'orgId:', orgId);
          const uploadSuccess = await uploadVideo(videoBlob);
          if (uploadSuccess) {
            // Track Video KYC completion (primary Google Ads conversion)
            trackVideoKYCComplete(applicationId);
            
            setStep('completed');
            toast.success("Video KYC uploaded successfully");
            onComplete();
          } else {
            // Reset to allow retry
            console.log('[VideoKYC] Upload failed, resetting to instructions');
            setStep('instructions');
          }
        } else {
          // Fallback: No applicationId/orgId (legacy behavior)
          console.warn('[VideoKYC] No applicationId/orgId provided, skipping upload');
          setStep('completed');
          onComplete();
          toast.success("Video KYC completed successfully");
        }
      };
    } else {
      console.warn('[VideoKYC] stopRecording called but conditions not met');
    }
  }, [isRecording, onComplete, applicationId, orgId]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isCompleted) {
    return (
      <div className="space-y-8">
        {/* Section Header */}
        <div className="flex items-center gap-4 pb-5 border-b border-border">
          <div className="w-12 h-12 rounded-xl bg-[hsl(var(--success))]/10 flex items-center justify-center">
            <Check className="h-6 w-6 text-[hsl(var(--success))]" />
          </div>
          <div>
            <h3 className="text-xl font-heading font-bold text-foreground">Application Submitted</h3>
            <p className="text-sm text-muted-foreground font-body">Your loan application is complete</p>
          </div>
        </div>

        <Card className="bg-[hsl(var(--success))]/5 border-2 border-[hsl(var(--success))]/20 rounded-xl">
          <CardContent className="pt-10 pb-10 text-center">
            <div className="w-24 h-24 bg-[hsl(var(--success))] rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
              <Check className="h-12 w-12 text-white" />
            </div>
            <h3 className="text-2xl font-heading font-bold text-[hsl(var(--success))] mb-3">Application Submitted Successfully!</h3>
            <p className="text-muted-foreground font-body mb-4">Thank you for completing your loan application.</p>
            <p className="text-sm text-muted-foreground font-body">Our team will review your application and contact you shortly.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Section Header */}
      <div className="flex items-center gap-4 pb-5 border-b border-border">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <Video className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h3 className="text-xl font-heading font-bold text-foreground">Video KYC</h3>
          <p className="text-sm text-muted-foreground font-body">Record a short video for identity verification</p>
        </div>
      </div>

      {/* Back Button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors font-body"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Aadhaar Verification
      </button>

      {step === 'instructions' && (
        <Card className="border-2 border-[hsl(var(--coral-500))]/20 rounded-xl overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-[hsl(var(--coral-500))] to-[hsl(var(--coral-400))]" />
          <CardContent className="p-6">
            <h4 className="text-lg font-heading font-bold text-foreground mb-5">You will be guided through 4 steps</h4>
            
            <div className="space-y-3 mb-6">
              {RECORDING_STAGES.map((stage, index) => {
                const StageIcon = stage.icon;
                return (
                  <div key={stage.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: stage.color }}>
                      {index + 1}
                    </div>
                    <StageIcon className="h-5 w-5 text-primary" />
                    <div className="flex-1">
                      <p className="font-medium font-heading">{stage.title}</p>
                      <p className="text-sm text-muted-foreground font-body">{stage.instruction}</p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {stage.duration}s
                    </Badge>
                  </div>
                );
              })}
            </div>

            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-center mb-6">
              <p className="text-sm text-muted-foreground font-body">
                Total recording time: <span className="font-semibold text-foreground">{minRecordingTime} seconds</span>
              </p>
            </div>

            <ul className="space-y-4 mb-6">
              <li className="flex items-start gap-4">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Camera className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-heading font-semibold text-foreground">Good Lighting</p>
                  <p className="text-sm text-muted-foreground font-body">Ensure you are in a well-lit area with your face clearly visible</p>
                </div>
              </li>
              <li className="flex items-start gap-4">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Video className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-heading font-semibold text-foreground">Keep Aadhaar Ready</p>
                  <p className="text-sm text-muted-foreground font-body">Have your Aadhaar card ready to show both sides</p>
                </div>
              </li>
            </ul>

            <Button
              onClick={checkPermissions}
              disabled={checkingPermissions}
              className="w-full h-14 text-base font-heading font-bold btn-electric rounded-xl"
            >
              {checkingPermissions ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Checking permissions...
                </>
              ) : (
                <>
                  <Play className="h-5 w-5 mr-2" />
                  Start Video KYC
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 'uploading' && (
        <Card className="border-2 border-primary/20 rounded-xl overflow-hidden">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <Upload className="h-8 w-8 text-primary animate-pulse" />
            </div>
            <h4 className="text-lg font-heading font-bold text-foreground mb-2">Uploading Video...</h4>
            <p className="text-sm text-muted-foreground font-body mb-6">
              Please wait while we securely upload your Video KYC recording
            </p>
            <div className="w-full bg-muted rounded-full h-2 mb-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">{uploadProgress}% complete</p>
          </CardContent>
        </Card>
      )}

      {(step === 'permissions' || step === 'recording') && (
        <div className="space-y-5">
          <div className="relative aspect-video bg-foreground rounded-2xl overflow-hidden shadow-xl">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              onLoadedMetadata={() => console.log('[VideoKYC] Video loadedmetadata event fired')}
              onPlay={() => console.log('[VideoKYC] Video play event fired')}
              onCanPlay={() => console.log('[VideoKYC] Video canplay event fired')}
              onError={(e) => console.error('[VideoKYC] Video error event:', e.currentTarget.error)}
              onStalled={() => console.warn('[VideoKYC] Video stalled event fired')}
              className="w-full h-full object-cover transform scale-x-[-1]"
            />
            
            {/* Recording Stage Overlay */}
            {isRecording && (
              <RecordingStageOverlay
                currentStageIndex={currentStageIndex}
                stageTimeRemaining={stageTimeRemaining}
                totalRecordingTime={recordingTime}
                onAdvanceStage={advanceStage}
                allStagesComplete={allStagesComplete}
                formatTime={formatTime}
              />
            )}

            {step === 'permissions' && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3">
                <Badge className="bg-[hsl(var(--success))] text-white border-0 font-heading">
                  <Camera className="h-3.5 w-3.5 mr-1.5" /> Camera Ready
                </Badge>
                <Badge className="bg-[hsl(var(--success))] text-white border-0 font-heading">
                  <Mic className="h-3.5 w-3.5 mr-1.5" /> Mic Ready
                </Badge>
              </div>
            )}
          </div>


          <div className="flex gap-4">
            {step === 'permissions' && (
              <Button
                onClick={startRecording}
                disabled={isRecording}
                className="flex-1 h-14 text-base font-heading font-bold btn-coral rounded-xl"
              >
                <Play className="h-5 w-5 mr-2" />
                Start Recording
              </Button>
            )}

            {step === 'recording' && (
              <Button
                onClick={stopRecording}
                disabled={!allStagesComplete || !isRecording}
                className="flex-1 h-14 text-base font-heading font-bold bg-[hsl(var(--error))] hover:bg-[hsl(var(--error))]/90 text-white rounded-xl shadow-lg transition-all disabled:opacity-50"
              >
                {!allStagesComplete ? (
                  `Complete all steps first...`
                ) : (
                  <>
                    <Square className="h-5 w-5 mr-2" />
                    Stop Recording
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
