import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ArrowLeft, ArrowRight, CreditCard, AlertCircle, CheckCircle, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface IdentityInputStepProps {
  panNumber: string;
  onPanChange: (pan: string) => void;
  applicantName: string;
  applicantPhone: string;
  applicationId?: string | null;
  orgId?: string;
  onPanVerified: (data: { name: string; dob: string; isValid: boolean }) => void;
  onCreditCheckPassed: (score: number) => void;
  onCreditCheckFailed: (score: number) => void;
  onNext: () => void;
  onBack: () => void;
}

type StepPhase = "pan_input" | "pan_verifying" | "pan_verified" | "pan_failed" | "credit_checking" | "credit_passed" | "credit_failed";

export function IdentityInputStep({
  panNumber,
  onPanChange,
  applicantName,
  applicantPhone,
  applicationId,
  orgId,
  onPanVerified,
  onCreditCheckPassed,
  onCreditCheckFailed,
  onNext,
  onBack,
}: IdentityInputStepProps) {
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  const isValidPanFormat = panRegex.test(panNumber);

  const [phase, setPhase] = useState<StepPhase>("pan_input");
  const [isNavigating, setIsNavigating] = useState(false);
  const [panData, setPanData] = useState<{ name: string; dob: string } | null>(null);
  const [creditScore, setCreditScore] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const handlePanChange = (value: string) => {
    onPanChange(value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10));
    // Reset phase if editing PAN after a failure
    if (phase === "pan_failed") {
      setPhase("pan_input");
      setErrorMessage("");
    }
  };

  // Step 1: Verify PAN via Surepass
  const verifyPan = async () => {
    if (!isValidPanFormat) return;

    setPhase("pan_verifying");
    setErrorMessage("");

    try {
      const { data, error } = await supabase.functions.invoke("surepass-public-pan-verify", {
        body: {
          panNumber,
          applicationId,
        },
      });

      if (error) throw error;
      if (!data?.success) {
        if (data?.error) throw new Error(data.error);
        setPhase("pan_input");
        return;
      }

      if (!data.data.is_valid) {
        setPhase("pan_failed");
        setErrorMessage("PAN number is invalid. Please check and try again.");
        return;
      }

      const verifiedData = { name: data.data.name, dob: data.data.dob, isValid: true };
      setPanData({ name: data.data.name, dob: data.data.dob });
      setPhase("pan_verified");
      onPanVerified(verifiedData);

      // Auto-trigger Experian credit check
      setTimeout(() => runCreditCheck(data.data.name), 500);
    } catch (err: any) {
      console.error("[IdentityInputStep] PAN verify error:", err);
      setPhase("pan_failed");
      setErrorMessage(err.message || "Failed to verify PAN. Please try again.");
    }
  };

  // Step 2: Auto-trigger Experian credit check
  const runCreditCheck = async (verifiedName: string) => {
    setPhase("credit_checking");

    try {
      const { data, error } = await supabase.functions.invoke("experian-credit-report", {
        body: {
          name: verifiedName || applicantName,
          pan: panNumber,
          mobile: applicantPhone,
          applicationId,
          orgId,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Credit check failed");

      const score = data.data?.credit_score ? parseInt(data.data.credit_score, 10) : 0;
      setCreditScore(score);

      if (score >= 550) {
        setPhase("credit_passed");
        onCreditCheckPassed(score);
      } else {
        setPhase("credit_failed");
        onCreditCheckFailed(score);
      }
    } catch (err: any) {
      console.error("[IdentityInputStep] Credit check error:", err);
      // On error, treat as failed
      setPhase("credit_failed");
      setCreditScore(0);
      setErrorMessage(err.message || "Credit check failed");
      onCreditCheckFailed(0);
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
          <p className="text-sm text-muted-foreground font-body">Verify your PAN to check eligibility</p>
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
          <div className="absolute left-3 top-1/2 -translate-y-1/2">
            <CreditCard className="h-5 w-5 text-muted-foreground" />
          </div>
          <Input
            id="pan"
            placeholder="ABCDE1234F"
            value={panNumber}
            onChange={(e) => handlePanChange(e.target.value)}
            disabled={phase === "pan_verifying" || phase === "credit_checking" || phase === "credit_passed"}
            className="h-14 pl-11 bg-background border-2 border-border rounded-xl uppercase tracking-[0.2em] font-mono text-lg focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
            maxLength={10}
          />
        </div>
        {panNumber && !isValidPanFormat && (
          <p className="text-sm text-destructive flex items-center gap-1.5 font-body mt-1">
            <AlertCircle className="h-4 w-4" />
            Invalid PAN format (e.g., ABCDE1234F)
          </p>
        )}
      </div>

      {/* PAN Verify Button */}
      {(phase === "pan_input" || phase === "pan_failed") && (
        <Button
          onClick={verifyPan}
          disabled={!isValidPanFormat || phase === "pan_verifying"}
          className="w-full h-14 text-lg font-heading font-bold btn-electric rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ShieldCheck className="h-5 w-5 mr-2" />
          Verify PAN
        </Button>
      )}

      {/* PAN Verifying */}
      {phase === "pan_verifying" && (
        <div className="flex flex-col items-center py-6">
          <Loader2 className="h-10 w-10 animate-spin text-primary mb-3" />
          <p className="text-sm font-medium text-foreground">Verifying your PAN...</p>
        </div>
      )}

      {/* PAN Failed */}
      {phase === "pan_failed" && errorMessage && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl">
          <div className="flex items-center gap-2 mb-1">
            <XCircle className="h-5 w-5 text-destructive" />
            <span className="font-heading font-bold text-destructive">Verification Failed</span>
          </div>
          <p className="text-sm text-destructive/80 font-body">{errorMessage}</p>
        </div>
      )}

      {/* PAN Verified */}
      {(phase === "pan_verified" || phase === "credit_checking" || phase === "credit_passed") && panData && (
        <div className="p-4 bg-[hsl(var(--success))]/10 border-2 border-[hsl(var(--success))]/20 rounded-xl">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="h-5 w-5 text-[hsl(var(--success))]" />
            <span className="font-heading font-bold text-[hsl(var(--success))]">PAN Verified</span>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Name:</span>
              <span className="font-medium text-foreground">{panData.name}</span>
            </div>
            {panData.dob && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">DOB:</span>
                <span className="font-medium text-foreground">{panData.dob}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Credit Check In Progress */}
      {phase === "credit_checking" && (
        <div className="flex flex-col items-center py-6">
          <Loader2 className="h-10 w-10 animate-spin text-primary mb-3" />
          <p className="text-sm font-medium text-foreground">Checking credit eligibility...</p>
          <p className="text-xs text-muted-foreground mt-1">This may take a moment</p>
        </div>
      )}

      {/* Credit Check Passed */}
      {phase === "credit_passed" && (
        <>
          <div className="p-4 bg-[hsl(var(--success))]/10 border-2 border-[hsl(var(--success))]/20 rounded-xl">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="h-5 w-5 text-[hsl(var(--success))]" />
              <span className="font-heading font-bold text-[hsl(var(--success))]">Eligibility Confirmed</span>
            </div>
            <p className="text-sm text-muted-foreground font-body">
              Your credit profile meets the eligibility criteria. Please continue to verify your Aadhaar.
            </p>
          </div>

          <Button
            onClick={() => { setIsNavigating(true); onNext(); }}
            disabled={isNavigating}
            className="w-full h-14 text-lg font-heading font-bold btn-electric rounded-xl"
          >
            Continue to Aadhaar Verification
            <ArrowRight className="h-5 w-5 ml-2" />
          </Button>
        </>
      )}

      {/* Credit Check Failed — Rejection */}
      {phase === "credit_failed" && (
        <div className="p-6 bg-destructive/5 border-2 border-destructive/20 rounded-xl text-center">
          <XCircle className="h-12 w-12 text-destructive mx-auto mb-3" />
          <h4 className="text-lg font-heading font-bold text-destructive mb-2">
            Application Not Eligible
          </h4>
          <p className="text-sm text-muted-foreground font-body">
            Unfortunately, based on the credit assessment, we are unable to process your application at this time.
            Please try again after improving your credit profile.
          </p>
        </div>
      )}
    </div>
  );
}
