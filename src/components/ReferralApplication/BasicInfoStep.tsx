import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2, User, Mail, Phone, Clock, ArrowRight, IndianRupee, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface BasicInfoStepProps {
  formData: {
    name: string;
    email: string;
    officeEmail: string;
    phone: string;
    requestedAmount: number;
    tenureDays: number;
  };
  onUpdate: (data: Partial<{ name: string; email: string; officeEmail: string; phone: string; requestedAmount: number; tenureDays: number }>) => void;
  consents: {
    householdIncome: boolean;
    termsAndConditions: boolean;
    aadhaarConsent: boolean;
  };
  onConsentChange: (consent: 'householdIncome' | 'termsAndConditions' | 'aadhaarConsent', value: boolean) => void;
  verificationStatus: {
    emailVerified: boolean;
    phoneVerified: boolean;
    officeEmailVerified: boolean;
  };
  onVerificationComplete: (type: 'email' | 'phone' | 'officeEmail') => void;
  onNext: () => void;
}

export function BasicInfoStep({
  formData,
  onUpdate,
  consents,
  onConsentChange,
  verificationStatus,
  onVerificationComplete,
  onNext,
}: BasicInfoStepProps) {
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [officeEmailOtpSent, setOfficeEmailOtpSent] = useState(false);
  const [emailOtp, setEmailOtp] = useState("");
  const [phoneOtp, setPhoneOtp] = useState("");
  const [officeEmailOtp, setOfficeEmailOtp] = useState("");
  const [emailSessionId, setEmailSessionId] = useState("");
  const [phoneSessionId, setPhoneSessionId] = useState("");
  const [officeEmailSessionId, setOfficeEmailSessionId] = useState("");
  const [sendingEmailOtp, setSendingEmailOtp] = useState(false);
  const [sendingPhoneOtp, setSendingPhoneOtp] = useState(false);
  const [sendingOfficeEmailOtp, setSendingOfficeEmailOtp] = useState(false);
  const [verifyingEmail, setVerifyingEmail] = useState(false);
  const [verifyingPhone, setVerifyingPhone] = useState(false);
  const [verifyingOfficeEmail, setVerifyingOfficeEmail] = useState(false);
  const [emailTimer, setEmailTimer] = useState(0);
  const [phoneTimer, setPhoneTimer] = useState(0);
  const [officeEmailTimer, setOfficeEmailTimer] = useState(0);
  const [phoneTestOtp, setPhoneTestOtp] = useState<string | null>(null);

  // Refs to track if OTP was already sent for current value
  const lastPhoneSentRef = useRef<string>("");
  const lastEmailSentRef = useRef<string>("");
  const lastOfficeEmailSentRef = useRef<string>("");

  const startTimer = (type: 'email' | 'phone' | 'officeEmail') => {
    const setTimer = type === 'email' ? setEmailTimer : type === 'phone' ? setPhoneTimer : setOfficeEmailTimer;
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

  const sendOtp = async (type: 'email' | 'phone' | 'officeEmail') => {
    const identifier = type === 'email' ? formData.email : type === 'phone' ? formData.phone : formData.officeEmail;
    
    if ((type === 'email' || type === 'officeEmail') && !identifier.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      // Don't show toast for auto-send, just return
      return;
    }
    
    if (type === 'phone' && formData.phone.replace(/\D/g, '').length < 10) {
      // Don't show toast for auto-send, just return
      return;
    }

    const setSending = type === 'email' ? setSendingEmailOtp : type === 'phone' ? setSendingPhoneOtp : setSendingOfficeEmailOtp;
    const setOtpSent = type === 'email' ? setEmailOtpSent : type === 'phone' ? setPhoneOtpSent : setOfficeEmailOtpSent;
    const setSessionId = type === 'email' ? setEmailSessionId : type === 'phone' ? setPhoneSessionId : setOfficeEmailSessionId;

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-public-otp', {
        body: {
          identifier: type === 'phone' ? `+91${formData.phone.replace(/\D/g, '')}` : identifier,
          identifierType: type === 'officeEmail' ? 'email' : type,
        },
      });

      if (error) throw error;
      
      setSessionId(data.sessionId);
      setOtpSent(true);
      startTimer(type);
      
      // Track that we sent OTP for this value
      if (type === 'phone') {
        lastPhoneSentRef.current = formData.phone;
      } else if (type === 'email') {
        lastEmailSentRef.current = formData.email;
      } else {
        lastOfficeEmailSentRef.current = formData.officeEmail;
      }
      
      // Handle test mode for phone OTP
      if (type === 'phone' && data.isTestMode && data.testOtp) {
        setPhoneTestOtp(data.testOtp);
        toast.success(`Test Mode: WhatsApp not configured. Use OTP: ${data.testOtp}`);
      } else {
        const label = type === 'officeEmail' ? 'office email' : type;
        toast.success(type === 'phone' ? 'OTP sent via WhatsApp' : `OTP sent to your ${label}`);
      }
    } catch (error: any) {
      console.error('Error sending OTP:', error);
      toast.error(error.message || `Failed to send OTP to ${type}`);
    } finally {
      setSending(false);
    }
  };

  // Auto-send OTP when valid phone number is entered
  useEffect(() => {
    const cleanPhone = formData.phone.replace(/\D/g, '');
    if (
      cleanPhone.length === 10 && 
      !phoneOtpSent && 
      !verificationStatus.phoneVerified && 
      !sendingPhoneOtp &&
      lastPhoneSentRef.current !== formData.phone
    ) {
      // Debounce to avoid sending while user is still typing
      const timer = setTimeout(() => {
        sendOtp('phone');
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [formData.phone, phoneOtpSent, verificationStatus.phoneVerified, sendingPhoneOtp]);

  // Auto-send OTP when valid email is entered
  useEffect(() => {
    const isValidEmail = formData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    if (
      isValidEmail && 
      !emailOtpSent && 
      !verificationStatus.emailVerified && 
      !sendingEmailOtp &&
      lastEmailSentRef.current !== formData.email
    ) {
      // Debounce to avoid sending while user is still typing
      const timer = setTimeout(() => {
        sendOtp('email');
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [formData.email, emailOtpSent, verificationStatus.emailVerified, sendingEmailOtp]);

  // Auto-send OTP when valid office email is entered (optional field)
  useEffect(() => {
    const isValidOfficeEmail = formData.officeEmail?.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    if (
      isValidOfficeEmail && 
      !officeEmailOtpSent && 
      !verificationStatus.officeEmailVerified && 
      !sendingOfficeEmailOtp &&
      lastOfficeEmailSentRef.current !== formData.officeEmail
    ) {
      // Debounce to avoid sending while user is still typing
      const timer = setTimeout(() => {
        sendOtp('officeEmail');
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [formData.officeEmail, officeEmailOtpSent, verificationStatus.officeEmailVerified, sendingOfficeEmailOtp]);

  const verifyOtp = async (type: 'email' | 'phone' | 'officeEmail') => {
    const sessionId = type === 'email' ? emailSessionId : type === 'phone' ? phoneSessionId : officeEmailSessionId;
    const otp = type === 'email' ? emailOtp : type === 'phone' ? phoneOtp : officeEmailOtp;
    const setVerifying = type === 'email' ? setVerifyingEmail : type === 'phone' ? setVerifyingPhone : setVerifyingOfficeEmail;

    if (!sessionId) {
      toast.error("Session expired. Please request a new OTP.");
      if (type === 'email') {
        setEmailOtpSent(false);
        setEmailOtp("");
        lastEmailSentRef.current = "";
      } else if (type === 'phone') {
        setPhoneOtpSent(false);
        setPhoneOtp("");
        lastPhoneSentRef.current = "";
      } else {
        setOfficeEmailOtpSent(false);
        setOfficeEmailOtp("");
        lastOfficeEmailSentRef.current = "";
      }
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

      if (error) throw new Error(error.message || 'Verification failed');
      if (data?.error) throw new Error(data.error);

      if (data?.verified) {
        onVerificationComplete(type);
        const label = type === 'officeEmail' ? 'Office email' : type === 'email' ? 'Email' : 'Phone';
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

  const allConsentsChecked = consents.householdIncome && consents.termsAndConditions && consents.aadhaarConsent;
  const isValidPhone = formData.phone.replace(/\D/g, '').length === 10;
  const isValidEmail = formData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  const isValidLoanAmount = formData.requestedAmount >= 5000 && formData.requestedAmount <= 100000;
  const isValidTenure = formData.tenureDays >= 1 && formData.tenureDays <= 90;
  
  // Office email is optional, but if provided, it must be verified
  const officeEmailValid = !formData.officeEmail || verificationStatus.officeEmailVerified;
  
  // Updated canProceed: requires both phone AND email verification, office email optional
  const canProceed = 
    formData.name && 
    isValidPhone && 
    isValidEmail &&
    isValidLoanAmount && 
    isValidTenure && 
    allConsentsChecked &&
    verificationStatus.phoneVerified &&
    verificationStatus.emailVerified &&
    officeEmailValid;

  return (
    <div className="space-y-8">
      {/* Section Header */}
      <div className="flex items-center gap-4 pb-5 border-b border-border">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <User className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h3 className="text-xl font-heading font-bold text-foreground">Personal Information</h3>
          <p className="text-sm text-muted-foreground font-body">Enter your basic details to get started</p>
        </div>
      </div>

      {/* Form Fields */}
      <div className="space-y-6">
        {/* Loan Amount Field - First and Mandatory */}
        <div className="space-y-2">
          <Label htmlFor="loanAmount" className="text-sm font-heading font-semibold text-foreground flex items-center gap-2">
            <IndianRupee className="h-4 w-4 text-muted-foreground" />
            Loan Amount Required <span className="text-[hsl(var(--coral-500))]">*</span>
          </Label>
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-heading font-semibold text-sm">
              ₹
            </div>
            <Input
              id="loanAmount"
              type="number"
              placeholder="Enter amount (₹5,000 - ₹1,00,000)"
              value={formData.requestedAmount || ''}
              onChange={(e) => {
                const value = parseInt(e.target.value) || 0;
                onUpdate({ requestedAmount: value });
              }}
              min={5000}
              max={100000}
              className="h-12 bg-background border-2 border-border rounded-xl pl-10 text-base font-body focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
            />
          </div>
          <p className="text-xs text-muted-foreground font-body">
            Minimum ₹5,000 • Maximum ₹1,00,000
          </p>
          {formData.requestedAmount > 0 && (formData.requestedAmount < 5000 || formData.requestedAmount > 100000) && (
            <p className="text-xs text-[hsl(var(--coral-500))] font-body">
              Please enter an amount between ₹5,000 and ₹1,00,000
            </p>
          )}
        </div>

        {/* Tenure Days Field - Mandatory */}
        <div className="space-y-2">
          <Label htmlFor="tenureDays" className="text-sm font-heading font-semibold text-foreground flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            Tenure (Number of Days) <span className="text-[hsl(var(--coral-500))]">*</span>
          </Label>
          <Input
            id="tenureDays"
            type="number"
            placeholder="Enter tenure in days (1 - 90)"
            value={formData.tenureDays || ''}
            onChange={(e) => {
              const value = parseInt(e.target.value) || 0;
              onUpdate({ tenureDays: value });
            }}
            min={1}
            max={90}
            className="h-12 bg-background border-2 border-border rounded-xl text-base font-body focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
          />
          <p className="text-xs text-muted-foreground font-body">
            Minimum 1 day • Maximum 90 days
          </p>
          {formData.tenureDays > 0 && (formData.tenureDays < 1 || formData.tenureDays > 90) && (
            <p className="text-xs text-[hsl(var(--coral-500))] font-body">
              Please enter a tenure between 1 and 90 days
            </p>
          )}
        </div>

        {/* Name Field */}
        <div className="space-y-2">
          <Label htmlFor="name" className="text-sm font-heading font-semibold text-foreground">
            Full Name (as per PAN) <span className="text-[hsl(var(--coral-500))]">*</span>
          </Label>
          <Input
            id="name"
            placeholder="Enter your full name"
            value={formData.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            className="h-12 bg-background border-2 border-border rounded-xl text-base font-body focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
          />
        </div>

        {/* Phone Field with Auto OTP */}
        <div className="space-y-2">
          <Label htmlFor="phone" className="text-sm font-heading font-semibold text-foreground flex items-center gap-2">
            <Phone className="h-4 w-4 text-muted-foreground" />
            Mobile Number <span className="text-[hsl(var(--coral-500))]">*</span>
          </Label>
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-heading font-semibold text-sm">
              +91
            </div>
            <Input
              id="phone"
              type="tel"
              placeholder="Enter 10-digit mobile"
              value={formData.phone}
              onChange={(e) => onUpdate({ phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
              disabled={verificationStatus.phoneVerified}
              className="h-12 bg-background border-2 border-border rounded-xl pl-14 pr-28 text-base font-body focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
              maxLength={10}
            />
            {verificationStatus.phoneVerified ? (
              <Badge className="absolute right-3 top-1/2 -translate-y-1/2 bg-[hsl(var(--success))] text-white border-0 font-heading">
                <Check className="h-3 w-3 mr-1" /> Verified
              </Badge>
            ) : sendingPhoneOtp ? (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Sending OTP...</span>
              </div>
            ) : null}
          </div>

          {/* Phone OTP Input - Shows automatically when OTP is sent */}
          {phoneOtpSent && !verificationStatus.phoneVerified && (
            <div className="space-y-2 mt-3">
              {phoneTestOtp && (
                <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg">
                  <strong>Test Mode:</strong> SMS not configured. Use OTP: <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono font-bold">{phoneTestOtp}</code>
                </div>
              )}
              <div className="flex gap-3 p-4 bg-[hsl(var(--electric-blue-100))] rounded-xl border border-[hsl(var(--electric-blue-400))]/20">
                <Input
                  placeholder="Enter 6-digit OTP"
                  value={phoneOtp}
                  onChange={(e) => setPhoneOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="h-11 bg-white border-2 border-border rounded-xl font-body tracking-widest"
                  maxLength={6}
                />
                <Button
                  type="button"
                  onClick={() => verifyOtp('phone')}
                  disabled={verifyingPhone || phoneOtp.length !== 6}
                  className="h-11 px-5 btn-electric rounded-xl font-heading"
                >
                  {verifyingPhone ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify'}
                </Button>
                {phoneTimer > 0 && (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground font-body min-w-[60px]">
                    <Clock className="h-3.5 w-3.5" />
                    {formatTimer(phoneTimer)}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Email Field with Auto OTP - Now Mandatory */}
        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm font-heading font-semibold text-foreground flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            Email Address <span className="text-[hsl(var(--coral-500))]">*</span>
          </Label>
          <div className="relative">
            <Input
              id="email"
              type="email"
              placeholder="Enter your email"
              value={formData.email}
              onChange={(e) => onUpdate({ email: e.target.value })}
              disabled={verificationStatus.emailVerified}
              className="h-12 bg-background border-2 border-border rounded-xl text-base font-body pr-36 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
            />
            {verificationStatus.emailVerified ? (
              <Badge className="absolute right-3 top-1/2 -translate-y-1/2 bg-[hsl(var(--success))] text-white border-0 font-heading">
                <Check className="h-3 w-3 mr-1" /> Verified
              </Badge>
            ) : sendingEmailOtp ? (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Sending OTP...</span>
              </div>
            ) : null}
          </div>

          {/* Email OTP Input - Shows automatically when OTP is sent */}
          {emailOtpSent && !verificationStatus.emailVerified && (
            <div className="flex gap-3 mt-3 p-4 bg-[hsl(var(--electric-blue-100))] rounded-xl border border-[hsl(var(--electric-blue-400))]/20">
              <Input
                placeholder="Enter 6-digit OTP"
                value={emailOtp}
                onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="h-11 bg-white border-2 border-border rounded-xl font-body tracking-widest"
                maxLength={6}
              />
              <Button
                type="button"
                onClick={() => verifyOtp('email')}
                disabled={verifyingEmail || emailOtp.length !== 6}
                className="h-11 px-5 btn-electric rounded-xl font-heading"
              >
                {verifyingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify'}
              </Button>
              {emailTimer > 0 && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground font-body min-w-[60px]">
                  <Clock className="h-3.5 w-3.5" />
                  {formatTimer(emailTimer)}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Office Email Field - Optional with OTP */}
        <div className="space-y-2">
          <Label htmlFor="officeEmail" className="text-sm font-heading font-semibold text-foreground flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            Office Email ID <span className="text-xs text-muted-foreground font-normal">(Optional)</span>
          </Label>
          <div className="relative">
            <Input
              id="officeEmail"
              type="email"
              placeholder="Enter your office email"
              value={formData.officeEmail}
              onChange={(e) => onUpdate({ officeEmail: e.target.value })}
              disabled={verificationStatus.officeEmailVerified}
              className="h-12 bg-background border-2 border-border rounded-xl text-base font-body pr-36 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
            />
            {verificationStatus.officeEmailVerified ? (
              <Badge className="absolute right-3 top-1/2 -translate-y-1/2 bg-[hsl(var(--success))] text-white border-0 font-heading">
                <Check className="h-3 w-3 mr-1" /> Verified
              </Badge>
            ) : sendingOfficeEmailOtp ? (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Sending OTP...</span>
              </div>
            ) : null}
          </div>

          {/* Office Email OTP Input - Shows automatically when OTP is sent */}
          {officeEmailOtpSent && !verificationStatus.officeEmailVerified && (
            <div className="flex gap-3 mt-3 p-4 bg-[hsl(var(--electric-blue-100))] rounded-xl border border-[hsl(var(--electric-blue-400))]/20">
              <Input
                placeholder="Enter 6-digit OTP"
                value={officeEmailOtp}
                onChange={(e) => setOfficeEmailOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="h-11 bg-white border-2 border-border rounded-xl font-body tracking-widest"
                maxLength={6}
              />
              <Button
                type="button"
                onClick={() => verifyOtp('officeEmail')}
                disabled={verifyingOfficeEmail || officeEmailOtp.length !== 6}
                className="h-11 px-5 btn-electric rounded-xl font-heading"
              >
                {verifyingOfficeEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify'}
              </Button>
              {officeEmailTimer > 0 && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground font-body min-w-[60px]">
                  <Clock className="h-3.5 w-3.5" />
                  {formatTimer(officeEmailTimer)}
                </div>
              )}
            </div>
          )}
          
          {/* Hint text for optional field */}
          {!formData.officeEmail && !verificationStatus.officeEmailVerified && (
            <p className="text-xs text-muted-foreground font-body">
              Provide your work email for official communications (if applicable)
            </p>
          )}
        </div>
      </div>

      {/* Consent Section */}
      <div className="space-y-4 pt-6 border-t border-border">
        <h4 className="text-sm font-heading font-bold text-foreground uppercase tracking-wider">Consents & Declarations</h4>
        
        <div className="space-y-4 p-5 rounded-xl border-2 border-border bg-muted/30">
          <div className="flex items-start space-x-4">
            <Checkbox
              id="householdIncome"
              checked={consents.householdIncome}
              onCheckedChange={(checked) => onConsentChange('householdIncome', checked as boolean)}
              className="mt-0.5 h-5 w-5 rounded border-2"
            />
            <Label htmlFor="householdIncome" className="text-sm text-muted-foreground font-body leading-relaxed cursor-pointer">
              I/We hereby confirm that the Household Income of my family is more than ₹ 3 Lakh per annum
            </Label>
          </div>

          <div className="flex items-start space-x-4">
            <Checkbox
              id="termsAndConditions"
              checked={consents.termsAndConditions}
              onCheckedChange={(checked) => onConsentChange('termsAndConditions', checked as boolean)}
              className="mt-0.5 h-5 w-5 rounded border-2"
            />
      <Label htmlFor="termsAndConditions" className="text-sm text-muted-foreground font-body leading-relaxed cursor-pointer">
        I have read and agreed to the{' '}
        <a href="https://paisaasaarthi.com/terms" className="text-primary font-semibold hover:underline" target="_blank" rel="noopener noreferrer">Terms and Conditions</a>,{' '}
        <a href="https://paisaasaarthi.com/privacy" className="text-primary font-semibold hover:underline" target="_blank" rel="noopener noreferrer">Privacy Policy</a> and{' '}
        <a href="/risk" className="text-primary font-semibold hover:underline" target="_blank">Gradation of Risk</a>
      </Label>
          </div>

          <div className="flex items-start space-x-4 p-4 bg-[hsl(var(--coral-500))]/5 rounded-lg border-l-4 border-[hsl(var(--coral-500))]">
            <Checkbox
              id="aadhaarConsent"
              checked={consents.aadhaarConsent}
              onCheckedChange={(checked) => onConsentChange('aadhaarConsent', checked as boolean)}
              className="mt-0.5 h-5 w-5 rounded border-2"
            />
            <Label htmlFor="aadhaarConsent" className="text-sm text-muted-foreground font-body leading-relaxed cursor-pointer">
              <span className="font-heading font-semibold text-foreground">Aadhaar Consent:</span> I hereby give my consent to fetch my CKYCR record from the Central KYC Records Registry 
              using my KYC identifier. I/we further express my interest and accord consent to receive calls/emails/SMS 
              from Skyrise Credit and Marketing Limited pertaining to their financial products and offers.
            </Label>
          </div>
        </div>
      </div>

      {/* Next Button */}
      <Button
        onClick={onNext}
        disabled={!canProceed}
        className="w-full h-14 text-lg font-heading font-bold btn-electric rounded-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
      >
        Continue to PAN Verification
        <ArrowRight className="h-5 w-5 ml-2" />
      </Button>
    </div>
  );
}
