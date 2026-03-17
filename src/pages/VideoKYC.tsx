import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Video, Camera, Mic, CheckCircle, XCircle, Clock, Play, Square, AlertTriangle, Eye, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { RecordingStageOverlay, RECORDING_STAGES } from "@/components/VideoKYC/RecordingStageOverlay";
import { useRecordingStages } from "@/hooks/useRecordingStages";

type PageState = "loading" | "instructions" | "permissions" | "recording" | "uploading" | "success" | "error" | "expired" | "completed";

export default function VideoKYC() {
  const { token } = useParams<{ token: string }>();
  const [pageState, setPageState] = useState<PageState>("loading");
  const [applicantName, setApplicantName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [completedAt, setCompletedAt] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [hasPermissions, setHasPermissions] = useState(false);

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

  useEffect(() => {
    if (token) {
      verifyToken();
    }
  }, [token]);

  // DEBUG: useEffect to re-attach stream when video element becomes available
  useEffect(() => {
    console.log('[VideoKYC] useEffect triggered - pageState:', pageState, 
      'streamRef exists:', !!streamRef.current, 
      'videoRef exists:', !!videoRef.current,
      'videoRef.srcObject exists:', !!videoRef.current?.srcObject);
    
    const attachStream = () => {
      if (videoRef.current && streamRef.current) {
        console.log('[VideoKYC] Attempting to attach stream to video element');
        console.log('[VideoKYC] Stream active:', streamRef.current.active);
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
    if ((pageState === 'permissions' || pageState === 'recording') && streamRef.current) {
      console.log('[VideoKYC] Page state requires video, scheduling stream attachment...');
      requestAnimationFrame(() => {
        setTimeout(attachStream, 100);
      });
    }
  }, [pageState]);

  const verifyToken = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("videokyc-verify-token", {
        body: { token },
      });

      if (error) {
        console.error("Error verifying token:", error);
        setErrorMessage("Failed to verify link. Please try again.");
        setPageState("error");
        return;
      }

      if (!data.valid) {
        if (data.status === "expired") {
          setPageState("expired");
        } else if (data.status === "completed") {
          setCompletedAt(data.completed_at);
          setPageState("completed");
        } else {
          setErrorMessage(data.error || "Invalid link");
          setPageState("error");
        }
        return;
      }

      setApplicantName(data.applicant_name);
      setPageState("instructions");
    } catch (err) {
      console.error("Error:", err);
      setErrorMessage("Something went wrong. Please try again.");
      setPageState("error");
    }
  };

  const checkPermissions = async () => {
    console.log('[VideoKYC] checkPermissions started, current pageState:', pageState);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
        audio: true,
      });

      console.log('[VideoKYC] Stream obtained:', {
        id: stream.id,
        active: stream.active,
        videoTracks: stream.getVideoTracks().length,
        audioTracks: stream.getAudioTracks().length,
        videoTrackSettings: stream.getVideoTracks()[0]?.getSettings()
      });

      streamRef.current = stream;
      console.log('[VideoKYC] videoRef.current exists?', !!videoRef.current);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        console.log('[VideoKYC] Stream assigned to video element');
      } else {
        console.warn('[VideoKYC] VIDEO ELEMENT NOT MOUNTED - stream stored in ref for later attachment');
      }

      setHasPermissions(true);
      setPageState("permissions");
      console.log('[VideoKYC] PageState changed to permissions');
      toast.success("Camera and microphone access granted");
    } catch (error) {
      console.error("[VideoKYC] Permission error:", error);
      toast.error("Please allow camera and microphone access to proceed");
    }
  };

  const startRecording = useCallback(async () => {
    console.log('[VideoKYC] startRecording called, streamRef exists:', !!streamRef.current);

    if (!streamRef.current) {
      toast.error("Camera not available");
      return;
    }

    console.log('[VideoKYC] Stream active:', streamRef.current.active);
    console.log('[VideoKYC] Video tracks:', streamRef.current.getVideoTracks().map(t => ({
      enabled: t.enabled,
      readyState: t.readyState,
      muted: t.muted
    })));

    // Browser compatibility check for mime types
    const mimeTypes = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
      'video/mp4'
    ];

    let selectedMimeType = '';
    for (const type of mimeTypes) {
      if (MediaRecorder.isTypeSupported(type)) {
        selectedMimeType = type;
        console.log('[VideoKYC] Using mime type:', type);
        break;
      }
    }

    if (!selectedMimeType) {
      console.error('[VideoKYC] No supported mime type found!');
      toast.error("Your browser doesn't support video recording");
      return;
    }

    try {
      chunksRef.current = [];
      const mediaRecorder = new MediaRecorder(streamRef.current, {
        mimeType: selectedMimeType,
      });

      mediaRecorder.ondataavailable = (event) => {
        console.log('[VideoKYC] Data chunk received, size:', event.data.size);
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onerror = (event) => {
        console.error('[VideoKYC] MediaRecorder error:', event);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000);
      console.log('[VideoKYC] MediaRecorder started');

      setIsRecording(true);
      setPageState("recording");
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error("[VideoKYC] Recording error:", error);
      toast.error("Failed to start recording");
    }
  }, []);

  const stopRecording = useCallback(async () => {
    console.log('[VideoKYC] stopRecording called, isRecording:', isRecording);

    if (mediaRecorderRef.current && isRecording) {
      console.log('[VideoKYC] Stopping MediaRecorder...');
      mediaRecorderRef.current.stop();
      setIsRecording(false);

      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => {
          console.log('[VideoKYC] Stopping track:', track.kind);
          track.stop();
        });
      }

      // Wait for data to be available
      await new Promise((resolve) => setTimeout(resolve, 500));
      console.log('[VideoKYC] Chunks collected:', chunksRef.current.length);

      // Upload the recording
      await uploadRecording();
    }
  }, [isRecording, token]);

  const uploadRecording = async () => {
    console.log('[VideoKYC] uploadRecording started');
    setPageState("uploading");

    try {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      console.log('[VideoKYC] Video blob created, size:', blob.size);

      const formData = new FormData();
      formData.append("token", token!);
      formData.append("video", blob, "video.webm");

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://newvgnbygvtnmyomxbmu.supabase.co";
      console.log('[VideoKYC] Uploading to:', `${supabaseUrl}/functions/v1/videokyc-upload-recording`);

      const response = await fetch(
        `${supabaseUrl}/functions/v1/videokyc-upload-recording`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();
      console.log('[VideoKYC] Upload response:', data);

      if (!response.ok || data.error) {
        throw new Error(data.error || "Upload failed");
      }

      setPageState("success");
      toast.success("Video KYC completed successfully!");
    } catch (error) {
      console.error("[VideoKYC] Upload error:", error);
      setErrorMessage("Failed to upload video. Please try again.");
      setPageState("error");
      toast.error("Failed to upload video");
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/30 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Video className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Video KYC Verification</h1>
          <p className="text-muted-foreground mt-1">Complete your identity verification</p>
        </div>

        {/* Loading State */}
        {pageState === "loading" && (
          <Card className="border-2">
            <CardContent className="pt-8 pb-8 text-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
              <p className="text-muted-foreground">Verifying your link...</p>
            </CardContent>
          </Card>
        )}

        {/* Error State */}
        {pageState === "error" && (
          <Card className="border-2 border-destructive/20">
            <CardContent className="pt-8 pb-8 text-center">
              <XCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
              <h2 className="text-xl font-bold text-destructive mb-2">Something went wrong</h2>
              <p className="text-muted-foreground">{errorMessage}</p>
              <p className="text-sm text-muted-foreground mt-4">Please contact your loan officer for a new link.</p>
            </CardContent>
          </Card>
        )}

        {/* Expired State */}
        {pageState === "expired" && (
          <Card className="border-2 border-amber-500/20">
            <CardContent className="pt-8 pb-8 text-center">
              <Clock className="h-16 w-16 text-amber-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-amber-600 mb-2">Link Expired</h2>
              <p className="text-muted-foreground">This Video KYC link has expired.</p>
              <p className="text-sm text-muted-foreground mt-4">Please contact your loan officer for a new link.</p>
            </CardContent>
          </Card>
        )}

        {/* Already Completed State */}
        {pageState === "completed" && (
          <Card className="border-2 border-green-500/20">
            <CardContent className="pt-8 pb-8 text-center">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-green-600 mb-2">Already Completed</h2>
              <p className="text-muted-foreground">Your Video KYC has already been submitted.</p>
              {completedAt && (
                <p className="text-sm text-muted-foreground mt-2">
                  Completed on {new Date(completedAt).toLocaleDateString()}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Instructions State */}
        {pageState === "instructions" && (
          <Card className="border-2">
            <CardHeader className="text-center">
              <CardTitle>Welcome, {applicantName}</CardTitle>
              <CardDescription>Please follow these instructions carefully</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                  <div>
                    <p className="font-semibold text-amber-800 dark:text-amber-200">You will be guided through 4 steps:</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {RECORDING_STAGES.map((stage, index) => {
                  const StageIcon = stage.icon;
                  return (
                    <div key={stage.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: stage.color }}>
                        {index + 1}
                      </div>
                      <StageIcon className="h-5 w-5 text-primary" />
                      <div className="flex-1">
                        <p className="font-medium">{stage.title}</p>
                        <p className="text-sm text-muted-foreground">{stage.instruction}</p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {stage.duration}s
                      </Badge>
                    </div>
                  );
                })}
              </div>

              <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-center">
                <p className="text-sm text-muted-foreground">
                  Total recording time: <span className="font-semibold text-foreground">{minRecordingTime} seconds</span>
                </p>
              </div>

              <Button onClick={checkPermissions} className="w-full h-12" size="lg">
                <Play className="h-5 w-5 mr-2" />
                Start Video KYC
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Permissions / Recording State */}
        {(pageState === "permissions" || pageState === "recording") && (
          <Card className="border-2">
            <CardContent className="pt-6 space-y-4">
              <div className="relative aspect-video bg-black rounded-xl overflow-hidden">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  onLoadedMetadata={() => console.log('[VideoKYC] Video loadedmetadata event')}
                  onCanPlay={() => console.log('[VideoKYC] Video canplay event')}
                  onPlay={() => console.log('[VideoKYC] Video play event fired')}
                  onError={(e) => console.error('[VideoKYC] Video error event:', e)}
                  onStalled={() => console.warn('[VideoKYC] Video stalled event')}
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

                {pageState === "permissions" && hasPermissions && (
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2">
                    <Badge variant="secondary" className="bg-green-500 text-white border-0">
                      <Camera className="h-3 w-3 mr-1" /> Camera Ready
                    </Badge>
                    <Badge variant="secondary" className="bg-green-500 text-white border-0">
                      <Mic className="h-3 w-3 mr-1" /> Mic Ready
                    </Badge>
                  </div>
                )}
              </div>

              {pageState === "permissions" && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                  <p className="text-sm font-medium mb-2">Remember to:</p>
                  <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
                    <li>Speak your Name and Date of Birth</li>
                    <li>Show front and back of Aadhaar</li>
                    <li>Click Stop Recording when done</li>
                  </ol>
                </div>
              )}

              {pageState === "permissions" && (
                <Button onClick={startRecording} className="w-full h-12" size="lg">
                  <Play className="h-5 w-5 mr-2" />
                  Start Recording
                </Button>
              )}

              {pageState === "recording" && (
                <Button
                  onClick={stopRecording}
                  disabled={!allStagesComplete}
                  variant="destructive"
                  className="w-full h-12"
                  size="lg"
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
            </CardContent>
          </Card>
        )}

        {/* Uploading State */}
        {pageState === "uploading" && (
          <Card className="border-2">
            <CardContent className="pt-8 pb-8 text-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
              <h2 className="text-xl font-bold mb-2">Uploading your video...</h2>
              <p className="text-muted-foreground">Please wait while we process your recording.</p>
            </CardContent>
          </Card>
        )}

        {/* Success State */}
        {pageState === "success" && (
          <Card className="border-2 border-green-500/20">
            <CardContent className="pt-8 pb-8 text-center">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-green-600 mb-2">Video KYC Completed!</h2>
              <p className="text-muted-foreground">Thank you for completing your video verification.</p>
              <p className="text-sm text-muted-foreground mt-4">You can now close this page.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
