import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Mail, Building2, Calendar, ArrowRight, Shield, Check, Loader2, Clock, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ContactConsentScreenProps {
  formData: {
    email: string;
    officeEmail: string;
    tenureDays: number;
  };
  onUpdate: (data: Partial<{ email: string; officeEmail: string; tenureDays: number }>) => void;
  verificationStatus: {
    emailVerified: boolean;
    officeEmailVerified: boolean;
  };
  onVerificationComplete: (type: 'email' | 'officeEmail') => void;
  onContinue: () => void;
}

export function ContactConsentScreen({
  formData,
  onUpdate,
  verificationStatus,
  onVerificationComplete,
  onContinue,
}: ContactConsentScreenProps) {
  const [localTenure, setLocalTenure] = useState(formData.tenureDays || 30);

  // OTP states
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [officeEmailOtpSent, setOfficeEmailOtpSent] = useState(false);
  const [emailOtp, setEmailOtp] = useState("");
  const [officeEmailOtp, setOfficeEmailOtp] = useState("");
  const [emailSessionId, setEmailSessionId] = useState("");
  const [officeEmailSessionId, setOfficeEmailSessionId] = useState("");
  const [sendingEmailOtp, setSendingEmailOtp] = useState(false);
  const [sendingOfficeEmailOtp, setSendingOfficeEmailOtp] = useState(false);
  const [verifyingEmail, setVerifyingEmail] = useState(false);
  const [verifyingOfficeEmail, setVerifyingOfficeEmail] = useState(false);
  const [emailTimer, setEmailTimer] = useState(0);
  const [officeEmailTimer, setOfficeEmailTimer] = useState(0);

  // Refs to track sent values
  const lastEmailSentRef = useRef("");
  const lastOfficeEmailSentRef = useRef("");

  // Sync local tenure with form data
  useEffect(() => {
    if (formData.tenureDays > 0) setLocalTenure(formData.tenureDays);
  }, [formData.tenureDays]);

  const handleTenureChange = (value: number) => {
    setLocalTenure(value);
    onUpdate({ tenureDays: value });
  };

  const startTimer = (type: 'email' | 'officeEmail') => {
    const setTimer = type === 'email' ? setEmailTimer : setOfficeEmailTimer;
    setTimer(120);
    const interval = setInterval(() => {
      setTimer((prev) => {
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

  const sendOtp = async (type: 'email' | 'officeEmail') => {
    const identifier = type === 'email' ? formData.email : formData.officeEmail;
    
    if (!identifier.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return;
    }

    const setSending = type === 'email' ? setSendingEmailOtp : setSendingOfficeEmailOtp;
    const setOtpSent = type === 'email' ? setEmailOtpSent : setOfficeEmailOtpSent;
    const setSessionId = type === 'email' ? setEmailSessionId : setOfficeEmailSessionId;

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-public-otp', {
        body: {
          identifier: identifier,
          identifierType: 'email',
        },
      });

      if (error) throw error;
      
      setSessionId(data.sessionId);
      setOtpSent(true);
      startTimer(type);
      
      if (type === 'email') lastEmailSentRef.current = formData.email;
      else lastOfficeEmailSentRef.current = formData.officeEmail;
      
      toast.success(`OTP sent to your ${type === 'officeEmail' ? 'office email' : 'email'}`);
    } catch (error: any) {
      console.error('Error sending OTP:', error);
      toast.error(error.message || 'Failed to send OTP');
    } finally {
      setSending(false);
    }
  };

  // Auto-send OTP for email
  useEffect(() => {
    const isValidEmail = formData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    if (
      isValidEmail && 
      !emailOtpSent && 
      !verificationStatus.emailVerified && 
      !sendingEmailOtp &&
      lastEmailSentRef.current !== formData.email
    ) {
      const timer = setTimeout(() => sendOtp('email'), 800);
      return () => clearTimeout(timer);
    }
  }, [formData.email, emailOtpSent, verificationStatus.emailVerified, sendingEmailOtp]);

  // Reset office email OTP state when email changes after OTP was sent
  useEffect(() => {
    if (officeEmailOtpSent && formData.officeEmail !== lastOfficeEmailSentRef.current) {
      setOfficeEmailOtpSent(false);
      setOfficeEmailOtp("");
      setOfficeEmailSessionId("");
      setOfficeEmailTimer(0);
    }
  }, [formData.officeEmail, officeEmailOtpSent]);

  // Auto-send OTP for office email
  useEffect(() => {
    const isValidOfficeEmail = formData.officeEmail?.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    if (
      isValidOfficeEmail &&
      !officeEmailOtpSent &&
      !verificationStatus.officeEmailVerified &&
      !sendingOfficeEmailOtp &&
      lastOfficeEmailSentRef.current !== formData.officeEmail
    ) {
      const timer = setTimeout(() => sendOtp('officeEmail'), 800);
      return () => clearTimeout(timer);
    }
  }, [formData.officeEmail, officeEmailOtpSent, verificationStatus.officeEmailVerified, sendingOfficeEmailOtp]);

  const verifyOtp = async (type: 'email' | 'officeEmail') => {
    const sessionId = type === 'email' ? emailSessionId : officeEmailSessionId;
    const otp = type === 'email' ? emailOtp : officeEmailOtp;
    const setVerifying = type === 'email' ? setVerifyingEmail : setVerifyingOfficeEmail;

    if (!sessionId) {
      toast.error("Session expired. Please request a new OTP.");
      return;
    }

    if (otp.length !== 6) {
      toast.error("Please enter a valid 6-digit OTP");
      return;
    }

    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-public-otp', {
        body: { sessionId, otp },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      if (data?.verified) {
        onVerificationComplete(type);
        const label = type === 'officeEmail' ? 'Office email' : 'Email';
        toast.success(`${label} verified successfully`);
      } else {
        toast.error("Verification failed. Please try again.");
      }
    } catch (error: any) {
      toast.error(error.message || 'Invalid OTP. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  const isValidTenure = localTenure >= 1 && localTenure <= 90;
  const isValidEmail = formData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  const officeEmailValid = !formData.officeEmail || verificationStatus.officeEmailVerified;
  
  const canContinue = 
    isValidTenure &&
    isValidEmail &&
    verificationStatus.emailVerified &&
    officeEmailValid;

  return (
    <div className="flex flex-col min-h-[calc(100vh-130px)]">
      {/* Title Section */}
      <div className="px-5 py-4">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Mail className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-heading font-bold text-foreground">
              How do we reach you?
            </h2>
            <p className="text-sm text-muted-foreground">
              We'll send updates on these
            </p>
          </div>
        </div>
      </div>

      {/* Form Card */}
      <div className="flex-1 px-4 pb-4 overflow-y-auto">
        <div className="bg-card rounded-2xl border border-border shadow-sm p-5 space-y-4">
          {/* Tenure Field */}
          <div className="space-y-3">
            <Label className="text-xs font-heading font-semibold text-foreground uppercase tracking-wide flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              Tenure (Days) <span className="text-destructive">*</span>
            </Label>
            <Input
              type="number"
              placeholder="Select tenure (1-90 days)"
              value={localTenure || ""}
              onChange={(e) => handleTenureChange(parseInt(e.target.value) || 0)}
              min={1}
              max={90}
              className="h-[52px] text-base font-body rounded-[14px] border-[1.5px] border-border bg-background focus:border-primary focus:ring-4 focus:ring-primary/10"
            />
            {/* Slider */}
            <div className="pt-1 pb-2">
              <Slider
                value={[localTenure]}
                onValueChange={([val]) => handleTenureChange(val)}
                min={1}
                max={90}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground font-medium">
                <span>1 day</span>
                <span>90 days</span>
              </div>
            </div>
            {localTenure > 0 && !isValidTenure && (
              <p className="text-xs text-destructive">
                Please enter a tenure between 1 and 90 days
              </p>
            )}
          </div>

          {/* Email Field */}
          <div className="space-y-2">
            <Label className="text-xs font-heading font-semibold text-foreground uppercase tracking-wide flex items-center gap-2">
              <Mail className="h-3.5 w-3.5 text-muted-foreground" />
              Email Address <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Input
                type="email"
                placeholder="Enter your email"
                value={formData.email}
                onChange={(e) => onUpdate({ email: e.target.value })}
                disabled={verificationStatus.emailVerified}
                className="h-[52px] text-base font-body rounded-[14px] border-[1.5px] border-border bg-background focus:border-primary focus:ring-4 focus:ring-primary/10 pr-24"
              />
              {verificationStatus.emailVerified ? (
                <Badge className="absolute right-3 top-1/2 -translate-y-1/2 bg-[hsl(var(--success))] text-white border-0 text-[10px]">
                  <Check className="h-3 w-3 mr-1" /> Verified
                </Badge>
              ) : sendingEmailOtp ? (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                </div>
              ) : null}
            </div>
            {emailOtpSent && !verificationStatus.emailVerified && (
              <div className="flex gap-2 p-3 bg-primary/5 rounded-xl mt-2">
                <Input
                  placeholder="Enter 6-digit OTP"
                  value={emailOtp}
                  onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="h-10 bg-white rounded-lg font-mono tracking-widest text-center"
                  maxLength={6}
                />
                <Button
                  onClick={() => verifyOtp('email')}
                  disabled={verifyingEmail || emailOtp.length !== 6}
                  className="h-10 px-4 bg-primary hover:bg-primary/90 rounded-lg text-sm"
                >
                  {verifyingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify'}
                </Button>
                {emailTimer > 0 && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground min-w-[45px]">
                    <Clock className="h-3 w-3" />
                    {formatTimer(emailTimer)}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Office Email Field - Optional */}
          <div className="space-y-2">
            <Label className="text-xs font-heading font-semibold text-foreground uppercase tracking-wide flex items-center gap-2">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
              Office Email <span className="text-xs font-normal text-muted-foreground">(Optional)</span>
            </Label>
            <div className="relative">
              <Input
                type="email"
                placeholder="Enter work email"
                value={formData.officeEmail}
                onChange={(e) => onUpdate({ officeEmail: e.target.value })}
                disabled={verificationStatus.officeEmailVerified}
                className="h-[52px] text-base font-body rounded-[14px] border-[1.5px] border-border bg-background focus:border-primary focus:ring-4 focus:ring-primary/10 pr-24"
              />
              {verificationStatus.officeEmailVerified ? (
                <Badge className="absolute right-3 top-1/2 -translate-y-1/2 bg-[hsl(var(--success))] text-white border-0 text-[10px]">
                  <Check className="h-3 w-3 mr-1" /> Verified
                </Badge>
              ) : sendingOfficeEmailOtp ? (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                </div>
              ) : formData.officeEmail ? (
                <button
                  onClick={() => onUpdate({ officeEmail: '' })}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted transition-colors"
                  type="button"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              ) : null}
            </div>
            {!formData.officeEmail && (
              <p className="text-[11px] text-muted-foreground">
                For official communications
              </p>
            )}
            {formData.officeEmail && !formData.officeEmail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/) && (
              <p className="text-xs text-destructive">
                Please enter a valid email address or clear the field
              </p>
            )}
            {officeEmailOtpSent && !verificationStatus.officeEmailVerified && (
              <div className="flex gap-2 p-3 bg-primary/5 rounded-xl mt-2">
                <Input
                  placeholder="Enter 6-digit OTP"
                  value={officeEmailOtp}
                  onChange={(e) => setOfficeEmailOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="h-10 bg-white rounded-lg font-mono tracking-widest text-center"
                  maxLength={6}
                />
                <Button
                  onClick={() => verifyOtp('officeEmail')}
                  disabled={verifyingOfficeEmail || officeEmailOtp.length !== 6}
                  className="h-10 px-4 bg-primary hover:bg-primary/90 rounded-lg text-sm"
                >
                  {verifyingOfficeEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify'}
                </Button>
                {officeEmailTimer > 0 ? (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground min-w-[45px]">
                    <Clock className="h-3 w-3" />
                    {formatTimer(officeEmailTimer)}
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    onClick={() => sendOtp('officeEmail')}
                    disabled={sendingOfficeEmailOtp}
                    className="h-10 px-3 text-xs text-primary hover:text-primary"
                    type="button"
                  >
                    Resend
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Continue Button */}
          <Button
            onClick={onContinue}
            disabled={!canContinue}
            className="w-full h-[54px] text-base font-heading font-semibold rounded-[14px] bg-gradient-to-r from-primary to-[hsl(var(--teal-600))] shadow-[var(--shadow-teal)] hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:shadow-none disabled:transform-none"
          >
            Continue to PAN Verification
            <ArrowRight className="h-5 w-5 ml-2" />
          </Button>

          {/* Trust footer */}
          <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground pt-1">
            <Shield className="h-3.5 w-3.5" />
            <span>Secure · RBI Registered · CKYC</span>
          </div>
        </div>
      </div>
    </div>
  );
}
