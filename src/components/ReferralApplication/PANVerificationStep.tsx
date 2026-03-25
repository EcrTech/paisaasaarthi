import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Check, Loader2, AlertCircle, ArrowLeft, ArrowRight, CreditCard, ShieldCheck, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAnalytics } from "@/hooks/useAnalytics";

interface PANVerificationStepProps {
  panNumber: string;
  onPanChange: (pan: string) => void;
  onVerified: (data: { name: string; status: string; dob?: string }) => void;
  onNext: () => void;
  onBack: () => void;
  isVerified: boolean;
  verifiedData?: { name: string; status: string; dob?: string };
}

export function PANVerificationStep({
  panNumber,
  onPanChange,
  onVerified,
  onNext,
  onBack,
  isVerified,
  verifiedData,
}: PANVerificationStepProps) {
  const [verifying, setVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const verificationAttemptedRef = useRef<string | null>(null);
  const { trackPAN, trackStep } = useAnalytics();

  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  const isValidPan = panRegex.test(panNumber);

  // Auto-verify when valid PAN is entered
  useEffect(() => {
    // Only trigger if:
    // 1. PAN is valid
    // 2. Not already verified
    // 3. Not currently verifying
    // 4. Haven't already attempted verification for this PAN
    if (isValidPan && !isVerified && !verifying && verificationAttemptedRef.current !== panNumber) {
      verificationAttemptedRef.current = panNumber;
      autoVerifyPan();
    }
  }, [panNumber, isValidPan, isVerified, verifying]);

  const autoVerifyPan = async () => {
    setVerifying(true);
    setVerificationError(null);

    try {
      console.log('[PAN Verification] Verifying PAN via Surepass:', panNumber.substring(0, 4) + '****');
      
      const { data: verifyData, error: verifyError } = await supabase.functions.invoke('surepass-public-pan-verify', {
        body: {
          panNumber,
        },
      });

      console.log('[PAN Verification] Verify response:', { verifyData, verifyError });

      if (verifyError) {
        console.error('[PAN Verification] Verify error:', verifyError);
        throw new Error('PAN verification request failed');
      }

      if (verifyData?.success) {
        onVerified({
          name: verifyData.data?.name || 'Name retrieved',
          status: 'Verified',
          dob: verifyData.data?.dob,
        });

        // Track PAN verification success
        trackPAN();
        trackStep(2, 'pan_verified', 'referral');

        toast.success("PAN verified successfully!");
      } else {
        // PAN verification failed but we got a response
        setVerificationError(verifyData?.error || 'PAN verification failed. Please check and try again.');
        toast.error(verifyData?.error || "PAN verification failed");
      }
    } catch (error: any) {
      console.error('[PAN Verification] Error:', error);
      setVerificationError(error.message || 'Verification service unavailable. Please try again.');
      toast.error(error.message || "Verification failed");
    } finally {
      setVerifying(false);
    }
  };

  // Reset verification attempt if PAN changes
  const handlePanChange = (value: string) => {
    const upperValue = value.toUpperCase().slice(0, 10);
    onPanChange(upperValue);
    
    // Reset error when PAN changes
    if (verificationError) {
      setVerificationError(null);
    }
    
    // Reset verification attempt ref if PAN changes significantly
    if (verificationAttemptedRef.current && !upperValue.startsWith(verificationAttemptedRef.current.slice(0, 5))) {
      verificationAttemptedRef.current = null;
    }
  };

  // Allow retry
  const handleRetry = () => {
    verificationAttemptedRef.current = null;
    setVerificationError(null);
    // Trigger re-verification
    if (isValidPan) {
      verificationAttemptedRef.current = panNumber;
      autoVerifyPan();
    }
  };

  return (
    <div className="space-y-8">
      {/* Section Header */}
      <div className="flex items-center gap-4 pb-5 border-b border-border">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <CreditCard className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h3 className="text-xl font-heading font-bold text-foreground">PAN Verification</h3>
          <p className="text-sm text-muted-foreground font-body">Enter your PAN number for instant verification</p>
        </div>
      </div>

      {/* Back Button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors font-body"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Personal Details
      </button>

      {/* PAN Input */}
      <div className="space-y-2">
        <Label htmlFor="pan" className="text-sm font-heading font-semibold text-foreground">
          PAN Number <span className="text-destructive">*</span>
        </Label>
        <div className="relative">
          <Input
            id="pan"
            placeholder="ABCDE1234F"
            value={panNumber}
            onChange={(e) => handlePanChange(e.target.value)}
            disabled={isVerified || verifying}
            className="h-14 bg-background border-2 border-border rounded-xl uppercase tracking-[0.2em] font-mono text-lg text-center focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
            maxLength={10}
          />
          {verifying && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          )}
          {isVerified && verifiedData?.status === 'Verified' && (
            <Badge className="absolute right-3 top-1/2 -translate-y-1/2 bg-[hsl(var(--success))] text-white border-0 font-heading">
              <Check className="h-3 w-3 mr-1" /> Verified
            </Badge>
          )}
        </div>
        
        {/* Validation Message */}
        {panNumber && !isValidPan && !verifying && (
          <p className="text-sm text-destructive flex items-center gap-1.5 font-body mt-2">
            <AlertCircle className="h-4 w-4" />
            Invalid PAN format (e.g., ABCDE1234F)
          </p>
        )}
        
        {/* Verifying Message */}
        {verifying && (
          <p className="text-sm text-primary flex items-center gap-1.5 font-body mt-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Verifying your PAN automatically...
          </p>
        )}
        
        <p className="text-xs text-muted-foreground font-body">
          Format: 5 letters + 4 digits + 1 letter
        </p>
      </div>

      {/* Verification Error */}
      {verificationError && !isVerified && (
        <Card className="rounded-xl overflow-hidden bg-destructive/5 border-2 border-destructive/20">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-destructive flex items-center justify-center flex-shrink-0">
                <XCircle className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="font-heading font-bold text-destructive mb-1">Verification Failed</p>
                <p className="text-sm text-muted-foreground font-body mb-3">{verificationError}</p>
                <Button
                  onClick={handleRetry}
                  variant="outline"
                  size="sm"
                  className="border-destructive text-destructive hover:bg-destructive/10"
                >
                  <Loader2 className="h-4 w-4 mr-2" />
                  Retry Verification
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Verified Details */}
      {isVerified && verifiedData && verifiedData.status === 'Verified' && (
        <Card className="rounded-xl overflow-hidden bg-[hsl(var(--success))]/5 border-2 border-[hsl(var(--success))]/20">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[hsl(var(--success))] flex items-center justify-center">
                <ShieldCheck className="h-5 w-5 text-white" />
              </div>
              <span className="font-heading font-bold text-[hsl(var(--success))]">
                PAN Verified Successfully
              </span>
            </div>
            <div className="space-y-3 pl-13">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground font-body text-sm">PAN Number</span>
                <span className="font-heading font-semibold text-foreground">{panNumber}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground font-body text-sm">Name on PAN</span>
                <span className="font-heading font-semibold text-foreground">{verifiedData.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground font-body text-sm">Status</span>
                <Badge variant="outline" className="bg-[hsl(var(--success))]/10 text-[hsl(var(--success))] border-[hsl(var(--success))]/30 font-heading">
                  {verifiedData.status}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Next Button - Only enabled when verified */}
      <Button
        onClick={onNext}
        disabled={!isVerified || verifiedData?.status !== 'Verified'}
        className="w-full h-14 text-lg font-heading font-bold btn-electric rounded-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
      >
        {verifying ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Verifying...
          </>
        ) : !isValidPan ? (
          'Enter Valid PAN to Continue'
        ) : !isVerified ? (
          'Waiting for Verification...'
        ) : (
          <>
            Continue to Aadhaar Verification
            <ArrowRight className="h-5 w-5 ml-2" />
          </>
        )}
      </Button>
    </div>
  );
}
