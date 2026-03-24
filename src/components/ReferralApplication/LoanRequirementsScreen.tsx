import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Wallet, Phone, User, ArrowRight, Shield, Check, Loader2, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface LoanRequirementsScreenProps {
  formData: {
    name: string;
    requestedAmount: number;
    phone: string;
  };
  onUpdate: (data: Partial<{ name: string; requestedAmount: number; phone: string }>) => void;
  consents: {
    householdIncome: boolean;
    termsAndConditions: boolean;
    aadhaarConsent: boolean;
  };
  onConsentChange: (consent: 'householdIncome' | 'termsAndConditions' | 'aadhaarConsent', value: boolean) => void;
  verificationStatus: { phoneVerified: boolean };
  onVerificationComplete: (type: 'phone') => void;
  isProcessing?: boolean;
  onContinue: () => void;
}

export function LoanRequirementsScreen({
  formData,
  onUpdate,
  consents,
  onConsentChange,
  verificationStatus,
  onVerificationComplete,
  isProcessing = false,
  onContinue,
}: LoanRequirementsScreenProps) {
  const [localAmount, setLocalAmount] = useState(formData.requestedAmount || 25000);

  // OTP states for phone
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [phoneOtp, setPhoneOtp] = useState("");
  const [phoneSessionId, setPhoneSessionId] = useState("");
  const [sendingPhoneOtp, setSendingPhoneOtp] = useState(false);
  const [verifyingPhone, setVerifyingPhone] = useState(false);
  const [phoneTimer, setPhoneTimer] = useState(0);
  const [phoneTestOtp, setPhoneTestOtp] = useState<string | null>(null);

  // Ref to track sent value
  const lastPhoneSentRef = useRef("");

  // Sync local state with form data
  useEffect(() => {
    if (formData.requestedAmount > 0) setLocalAmount(formData.requestedAmount);
  }, [formData.requestedAmount]);

  const handleAmountChange = (value: number) => {
    setLocalAmount(value);
    onUpdate({ requestedAmount: value });
  };

  const startTimer = () => {
    setPhoneTimer(120);
    const interval = setInterval(() => {
      setPhoneTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const sendOtp = async () => {
    if (formData.phone.replace(/\D/g, '').length < 10) {
      return;
    }

    setSendingPhoneOtp(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-public-otp', {
        body: {
          identifier: `+91${formData.phone.replace(/\D/g, '')}`,
          identifierType: 'phone',
        },
      });

      if (error) throw error;
      
      setPhoneSessionId(data.sessionId);
      setPhoneOtpSent(true);
      startTimer();
      lastPhoneSentRef.current = formData.phone;
      
      if (data.isTestMode && data.testOtp) {
        setPhoneTestOtp(data.testOtp);
        toast.success(`Test Mode: Use OTP: ${data.testOtp}`);
      } else {
        toast.success('OTP sent via WhatsApp');
      }
    } catch (error: any) {
      console.error('Error sending OTP:', error);
      toast.error(error.message || 'Failed to send OTP');
    } finally {
      setSendingPhoneOtp(false);
    }
  };

  // Auto-send OTP for phone
  useEffect(() => {
    const cleanPhone = formData.phone.replace(/\D/g, '');
    if (
      cleanPhone.length === 10 && 
      !phoneOtpSent && 
      !verificationStatus.phoneVerified && 
      !sendingPhoneOtp &&
      lastPhoneSentRef.current !== formData.phone
    ) {
      const timer = setTimeout(() => sendOtp(), 500);
      return () => clearTimeout(timer);
    }
  }, [formData.phone, phoneOtpSent, verificationStatus.phoneVerified, sendingPhoneOtp]);

  const verifyOtp = async () => {
    if (!phoneSessionId) {
      toast.error("Session expired. Please request a new OTP.");
      return;
    }

    if (phoneOtp.length !== 6) {
      toast.error("Please enter a valid 6-digit OTP");
      return;
    }

    setVerifyingPhone(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-public-otp', {
        body: { sessionId: phoneSessionId, otp: phoneOtp },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      if (data?.verified) {
        onVerificationComplete('phone');
        toast.success('Phone verified successfully');
      } else {
        toast.error("Verification failed. Please try again.");
      }
    } catch (error: any) {
      toast.error(error.message || 'Invalid OTP. Please try again.');
    } finally {
      setVerifyingPhone(false);
    }
  };

  const isValidAmount = localAmount >= 5000 && localAmount <= 100000;
  const isValidPhone = formData.phone.replace(/\D/g, '').length === 10;
  const isValidName = formData.name.trim().length >= 2;
  const allConsentsChecked = consents.householdIncome && consents.termsAndConditions && consents.aadhaarConsent;
  
  const canContinue = isValidAmount && isValidPhone && verificationStatus.phoneVerified && isValidName && allConsentsChecked;

  return (
    <div className="flex flex-col min-h-[calc(100vh-130px)]">
      {/* Title Section */}
      <div className="px-5 py-4">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-[hsl(var(--gold-500))]/10 flex items-center justify-center">
            <Wallet className="h-5 w-5 text-[hsl(var(--gold-500))]" />
          </div>
          <div>
            <h2 className="text-xl font-heading font-bold text-foreground">
              What do you need?
            </h2>
            <p className="text-sm text-muted-foreground">
              Tell us about your loan requirement
            </p>
          </div>
        </div>
      </div>

      {/* Form Card */}
      <div className="flex-1 px-4 pb-4 overflow-y-auto">
        <div className="bg-card rounded-2xl border border-border shadow-sm p-5 space-y-4">
          {/* Loan Amount Field */}
          <div className="space-y-3">
            <Label className="text-xs font-heading font-semibold text-foreground uppercase tracking-wide flex items-center gap-2">
              <span className="text-[hsl(var(--gold-500))]">₹</span>
              Loan Amount <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">
                ₹
              </div>
              <Input
                type="number"
                placeholder="Enter amount (₹5,000-₹1,00,000)"
                value={localAmount || ""}
                onChange={(e) => handleAmountChange(parseInt(e.target.value) || 0)}
                min={5000}
                max={100000}
                className="h-[52px] pl-9 text-base font-body rounded-[14px] border-[1.5px] border-border bg-background focus:border-primary focus:ring-4 focus:ring-primary/10"
              />
            </div>
            {/* Slider */}
            <div className="pt-1 pb-2">
              <Slider
                value={[localAmount]}
                onValueChange={([val]) => handleAmountChange(val)}
                min={5000}
                max={100000}
                step={1000}
                className="w-full"
              />
              <div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground font-medium">
                <span>₹5,000</span>
                <span>₹1,00,000</span>
              </div>
            </div>
            {localAmount > 0 && !isValidAmount && (
              <p className="text-xs text-destructive">
                Please enter an amount between ₹5,000 and ₹1,00,000
              </p>
            )}
          </div>

          {/* Mobile Number Field */}
          <div className="space-y-2">
            <Label className="text-xs font-heading font-semibold text-foreground uppercase tracking-wide flex items-center gap-2">
              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
              Mobile Number <span className="text-destructive">*</span>
            </Label>
            <div className="flex gap-2">
              <div className="h-[52px] w-14 flex items-center justify-center bg-muted rounded-[14px] border border-border text-sm font-medium text-muted-foreground">
                +91
              </div>
              <div className="relative flex-1">
                <Input
                  type="tel"
                  placeholder="Enter 10-digit mobile"
                  value={formData.phone}
                  onChange={(e) => onUpdate({ phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                  disabled={verificationStatus.phoneVerified}
                  maxLength={10}
                  className="h-[52px] text-base font-body rounded-[14px] border-[1.5px] border-border bg-background focus:border-primary focus:ring-4 focus:ring-primary/10 pr-24"
                />
                {verificationStatus.phoneVerified ? (
                  <Badge className="absolute right-3 top-1/2 -translate-y-1/2 bg-[hsl(var(--success))] text-white border-0 text-[10px]">
                    <Check className="h-3 w-3 mr-1" /> Verified
                  </Badge>
                ) : sendingPhoneOtp ? (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  </div>
                ) : null}
              </div>
            </div>
            {phoneOtpSent && !verificationStatus.phoneVerified && (
              <div className="space-y-2 mt-2">
                {phoneTestOtp && (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg">
                    Test Mode: Use OTP: <code className="bg-amber-100 px-1 py-0.5 rounded font-mono font-bold">{phoneTestOtp}</code>
                  </div>
                )}
                <div className="flex gap-2 p-3 bg-primary/5 rounded-xl">
                  <Input
                    placeholder="Enter 6-digit OTP"
                    value={phoneOtp}
                    onChange={(e) => setPhoneOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="h-10 bg-white rounded-lg font-mono tracking-widest text-center"
                    maxLength={6}
                  />
                  <Button
                    onClick={verifyOtp}
                    disabled={verifyingPhone || phoneOtp.length !== 6}
                    className="h-10 px-4 bg-primary hover:bg-primary/90 rounded-lg text-sm"
                  >
                    {verifyingPhone ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify'}
                  </Button>
                  {phoneTimer > 0 && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground min-w-[45px]">
                      <Clock className="h-3 w-3" />
                      {formatTimer(phoneTimer)}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Full Name Field */}
          <div className="space-y-2">
            <Label className="text-xs font-heading font-semibold text-foreground uppercase tracking-wide flex items-center gap-2">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              Full Name (as per PAN) <span className="text-destructive">*</span>
            </Label>
            <Input
              placeholder="Enter your full name"
              value={formData.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
              className="h-[52px] text-base font-body rounded-[14px] border-[1.5px] border-border bg-background focus:border-primary focus:ring-4 focus:ring-primary/10"
            />
            <p className="text-[11px] text-muted-foreground">
              Name must match your PAN card exactly
            </p>
          </div>

          {/* Declarations */}
          <div className="border-t border-border pt-4">
            <h4 className="text-xs font-heading font-bold text-foreground uppercase tracking-wider mb-3">
              Declarations
            </h4>
            
            <div className="space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox
                  checked={consents.householdIncome}
                  onCheckedChange={(checked) => onConsentChange('householdIncome', checked as boolean)}
                  className="mt-0.5 h-[22px] w-[22px] rounded-md border-2"
                />
                <span className="text-[13px] text-muted-foreground leading-relaxed">
                  Household income {">"} ₹3 Lakh/year
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox
                  checked={consents.termsAndConditions}
                  onCheckedChange={(checked) => onConsentChange('termsAndConditions', checked as boolean)}
                  className="mt-0.5 h-[22px] w-[22px] rounded-md border-2"
                />
      <span className="text-[13px] text-muted-foreground leading-relaxed">
        I agree to{' '}
        <a href="https://paisaasaarthi.com/terms" className="text-primary underline" target="_blank" rel="noopener noreferrer">Terms</a>,{' '}
        <a href="https://paisaasaarthi.com/privacy" className="text-primary underline" target="_blank" rel="noopener noreferrer">Privacy Policy</a>{' '}
        & Gradation of Risk
      </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox
                  checked={consents.aadhaarConsent}
                  onCheckedChange={(checked) => onConsentChange('aadhaarConsent', checked as boolean)}
                  className="mt-0.5 h-[22px] w-[22px] rounded-md border-2"
                />
                <span className="text-[13px] text-muted-foreground leading-relaxed">
                  I consent to CKYC verification & communications from Skyrise Credit
                </span>
              </label>
            </div>
          </div>

          {/* Continue Button */}
          <Button
            onClick={onContinue}
            disabled={!canContinue || isProcessing}
            className="w-full h-[54px] text-base font-heading font-semibold rounded-[14px] bg-gradient-to-r from-primary to-[hsl(var(--teal-600))] shadow-[var(--shadow-teal)] hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:shadow-none disabled:transform-none"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                Continue
                <ArrowRight className="h-5 w-5 ml-2" />
              </>
            )}
          </Button>

          {/* Trust badge */}
          <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground pt-1">
            <Shield className="h-3.5 w-3.5" />
            <span>Your data is 256-bit secure</span>
          </div>
        </div>
      </div>
    </div>
  );
}
