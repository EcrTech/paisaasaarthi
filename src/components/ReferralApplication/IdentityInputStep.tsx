import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ArrowLeft, ArrowRight, CreditCard, FileCheck, AlertCircle } from "lucide-react";

interface IdentityInputStepProps {
  panNumber: string;
  onPanChange: (pan: string) => void;
  aadhaarNumber: string;
  onAadhaarChange: (aadhaar: string) => void;
  onNext: () => void;
  onBack: () => void;
}

export function IdentityInputStep({
  panNumber,
  onPanChange,
  aadhaarNumber,
  onAadhaarChange,
  onNext,
  onBack,
}: IdentityInputStepProps) {
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  const isValidPan = panRegex.test(panNumber);
  const isValidAadhaar = /^\d{12}$/.test(aadhaarNumber);

  const canContinue = isValidPan && isValidAadhaar;

  const handlePanChange = (value: string) => {
    onPanChange(value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10));
  };

  const handleAadhaarChange = (value: string) => {
    onAadhaarChange(value.replace(/\D/g, "").slice(0, 12));
  };

  // Format aadhaar for display: XXXX XXXX XXXX
  const formatAadhaarDisplay = (value: string) => {
    const digits = value.replace(/\D/g, "");
    const parts = [];
    for (let i = 0; i < digits.length; i += 4) {
      parts.push(digits.slice(i, i + 4));
    }
    return parts.join(" ");
  };

  return (
    <div className="space-y-8">
      {/* Section Header */}
      <div className="flex items-center gap-4 pb-5 border-b border-border">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <FileCheck className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h3 className="text-xl font-heading font-bold text-foreground">Identity Details</h3>
          <p className="text-sm text-muted-foreground font-body">Enter your PAN and Aadhaar numbers</p>
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
            className="h-14 pl-11 bg-background border-2 border-border rounded-xl uppercase tracking-[0.2em] font-mono text-lg focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
            maxLength={10}
          />
        </div>
        {panNumber && !isValidPan && (
          <p className="text-sm text-destructive flex items-center gap-1.5 font-body mt-1">
            <AlertCircle className="h-4 w-4" />
            Invalid PAN format (e.g., ABCDE1234F)
          </p>
        )}
        <p className="text-xs text-muted-foreground font-body">
          Format: 5 letters + 4 digits + 1 letter
        </p>
      </div>

      {/* Aadhaar Input */}
      <div className="space-y-2">
        <Label htmlFor="aadhaar" className="text-sm font-heading font-semibold text-foreground">
          Aadhaar Number <span className="text-destructive">*</span>
        </Label>
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2">
            <FileCheck className="h-5 w-5 text-muted-foreground" />
          </div>
          <Input
            id="aadhaar"
            placeholder="1234 5678 9012"
            value={formatAadhaarDisplay(aadhaarNumber)}
            onChange={(e) => handleAadhaarChange(e.target.value)}
            className="h-14 pl-11 bg-background border-2 border-border rounded-xl tracking-[0.15em] font-mono text-lg focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
            maxLength={14} // 12 digits + 2 spaces
          />
        </div>
        {aadhaarNumber && !isValidAadhaar && (
          <p className="text-sm text-destructive flex items-center gap-1.5 font-body mt-1">
            <AlertCircle className="h-4 w-4" />
            Aadhaar must be 12 digits
          </p>
        )}
        <p className="text-xs text-muted-foreground font-body">
          Enter your 12-digit Aadhaar number
        </p>
      </div>

      {/* Info Note */}
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
        <p className="text-sm text-muted-foreground font-body">
          Your PAN and Aadhaar will be verified during the document verification stage after your application is submitted.
        </p>
      </div>

      {/* Next Button */}
      <Button
        onClick={onNext}
        disabled={!canContinue}
        className="w-full h-14 text-lg font-heading font-bold btn-electric rounded-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
      >
        {!panNumber && !aadhaarNumber ? (
          "Enter PAN & Aadhaar to Continue"
        ) : !isValidPan ? (
          "Enter Valid PAN to Continue"
        ) : !isValidAadhaar ? (
          "Enter Valid Aadhaar to Continue"
        ) : (
          <>
            Continue to Video KYC
            <ArrowRight className="h-5 w-5 ml-2" />
          </>
        )}
      </Button>
    </div>
  );
}
