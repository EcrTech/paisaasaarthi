import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AuthLayout } from "@/components/Auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNotification } from "@/hooks/useNotification";
import { ForgotPasswordDialog } from "@/components/Auth/ForgotPasswordDialog";
import { Eye, EyeOff, Loader2, ArrowLeft, Shield } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

console.log('[Login] Module loaded');

const WIDGET_SCRIPT_ID = "help-widget-script";
const WIDGET_SRC = "https://crm.in-sync.co.in/help-widget.js";

type LoginStep = 'credentials' | 'otp';

export default function Login() {
  console.log('[Login] Component rendering...');

  // Load help widget on login page
  useEffect(() => {
    if (document.getElementById(WIDGET_SCRIPT_ID)) return;

    const script = document.createElement("script");
    script.id = WIDGET_SCRIPT_ID;
    script.src = WIDGET_SRC;
    script.setAttribute("data-source", "paisaa_saarthi");
    document.body.appendChild(script);

    return () => {
      document.getElementById(WIDGET_SCRIPT_ID)?.remove();
      document.querySelectorAll('[id*="help-widget"], [class*="help-widget"]').forEach((el) => el.remove());
    };
  }, []);

  const navigate = useNavigate();
  const notify = useNotification();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // 2FA OTP states
  const [step, setStep] = useState<LoginStep>('credentials');
  const [otp, setOtp] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [userPhone, setUserPhone] = useState<string | null>(null);
  const [pendingOtpVerification, setPendingOtpVerification] = useState(false);
  const pendingOtpRef = useRef(false);

  // Keep ref in sync with state so the auth listener always reads the latest value
  useEffect(() => {
    pendingOtpRef.current = pendingOtpVerification;
  }, [pendingOtpVerification]);

  useEffect(() => {
    console.log('[Login] useEffect - setting up auth listener (stable, created once)...');
    let mounted = true;

    // Listen for auth changes and redirect on successful login
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      console.log("[Login] Auth state change:", event, session ? "Session exists" : "No session");
      // Don't redirect if we're in the middle of 2FA flow (will sign out shortly)
      if (event === 'SIGNED_IN' && session && !pendingOtpRef.current) {
        console.log("[Login] User signed in, redirecting to LOS dashboard");
        navigate("/los/dashboard", { replace: true });
      }
    });

    // Check if user is already logged in - do this after setting up listener
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      console.log("[Login] Initial session check:", session ? "Session exists" : "No session");
      if (session) {
        console.log("[Login] Redirecting to LOS dashboard");
        navigate("/los/dashboard", { replace: true });
      }
    });

    return () => {
      console.log('[Login] Cleanup - unsubscribing');
      mounted = false;
      subscription.unsubscribe();
    };
  }, [navigate]); // Removed pendingOtpVerification - using ref instead

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[Login] handleCredentialsSubmit called');
    setLoading(true);

    try {
      // Set flag to prevent auth listener from redirecting during 2FA check
      setPendingOtpVerification(true);
      
      // First verify credentials
      console.log('[Login] Verifying credentials...');
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        console.error('[Login] Credentials verification error:', authError);
        setPendingOtpVerification(false);
        throw authError;
      }

      console.log('[Login] Credentials verified, fetching user profile for phone...');
      
      // Get user's phone number from profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('phone')
        .eq('id', authData.user.id)
        .single();

      if (profileError || !profile?.phone) {
        console.log('[Login] No phone number found, completing login without 2FA');
        setPendingOtpVerification(false);
        notify.success("Welcome back!", "You've successfully signed in");
        navigate("/los/dashboard", { replace: true });
        return;
      }

      // Sign out temporarily - we'll complete login after OTP verification
      await supabase.auth.signOut();

      setUserPhone(profile.phone);
      
      // Add delay after signOut to let the Supabase client stabilize
      // before invoking the edge function
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Send OTP via WhatsApp with retry logic
      await sendOtpWithRetry(profile.phone);
      
      setStep('otp');
      notify.success("Credentials verified", "Please enter the OTP sent to your phone");
    } catch (error: any) {
      console.error('[Login] Credentials verification failed:', error);
      notify.error("Login failed", error);
    } finally {
      setLoading(false);
    }
  };

  const sendOtp = async (phone: string) => {
    setSendingOtp(true);
    try {
      console.log('[Login] Sending OTP to:', phone);
      
      const { data, error } = await supabase.functions.invoke('send-public-otp', {
        body: {
          identifier: phone,
          identifierType: 'phone'
        }
      });

      if (error) throw error;

      if (data.success) {
        setSessionId(data.sessionId);
        setResendCooldown(60);
        console.log('[Login] OTP sent successfully');
      } else {
        throw new Error(data.error || 'Failed to send OTP');
      }
    } catch (error: any) {
      console.error('[Login] Failed to send OTP:', error);
      notify.error("Failed to send OTP", error.message || "Please try again");
      throw error;
    } finally {
      setSendingOtp(false);
    }
  };

  const sendOtpWithRetry = async (phone: string) => {
    try {
      await sendOtp(phone);
    } catch (firstError) {
      console.log('[Login] First OTP attempt failed, retrying after delay...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      await sendOtp(phone); // If this also fails, error propagates to caller
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp || otp.length !== 6) {
      notify.error("Invalid OTP", new Error("Please enter a valid 6-digit OTP"));
      return;
    }

    setVerifyingOtp(true);
    try {
      console.log('[Login] Verifying OTP...');
      
      const { data, error } = await supabase.functions.invoke('verify-public-otp', {
        body: {
          sessionId,
          otp
        }
      });

      if (error) throw error;

      if (data.success && data.verified) {
        console.log('[Login] OTP verified, completing login...');
        
        // Reset the flag so auth listener can redirect
        setPendingOtpVerification(false);
        
        // Complete login with credentials
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) throw signInError;

        notify.success("Welcome back!", "You've successfully signed in with 2FA");
        navigate("/los/dashboard", { replace: true });
      } else {
        throw new Error(data.error || 'Invalid OTP');
      }
    } catch (error: any) {
      console.error('[Login] OTP verification failed:', error);
      notify.error("Verification failed", error.message || "Please try again");
      setOtp("");
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || !userPhone) return;
    
    try {
      await sendOtp(userPhone);
      notify.success("OTP Resent", "A new OTP has been sent to your phone");
    } catch (error) {
      // Error already handled in sendOtp
    }
  };

  const handleBackToCredentials = async () => {
    setStep('credentials');
    setOtp("");
    setSessionId(null);
    setUserPhone(null);
  };

  console.log('[Login] About to render AuthLayout...');
  
  if (step === 'otp') {
    return (
      <AuthLayout 
        title="Two-Factor Authentication" 
        subtitle={`Enter the OTP sent to ${userPhone ? `****${userPhone.slice(-4)}` : 'your phone'}`}
      >
        <div className="space-y-6">
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <Shield className="h-8 w-8 text-primary" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="otp" className="text-center block">One-Time Password</Label>
            <div className="flex justify-center">
              <InputOTP 
                maxLength={6} 
                value={otp} 
                onChange={setOtp}
                disabled={verifyingOtp}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>
          </div>

          <Button 
            onClick={handleVerifyOtp} 
            className="w-full" 
            disabled={otp.length !== 6 || verifyingOtp}
          >
            {verifyingOtp ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              "Verify & Sign In"
            )}
          </Button>

          <div className="text-center">
            <button
              type="button"
              onClick={handleResendOtp}
              disabled={resendCooldown > 0 || sendingOtp}
              className="text-sm text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
            >
              {sendingOtp ? (
                "Sending..."
              ) : resendCooldown > 0 ? (
                `Resend OTP in ${resendCooldown}s`
              ) : (
                "Resend OTP"
              )}
            </button>
          </div>

          <Button
            type="button"
            variant="ghost"
            onClick={handleBackToCredentials}
            className="w-full"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Login
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to your account">
      <form onSubmit={handleCredentialsSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <button
              type="button"
              onClick={() => setShowForgotPassword(true)}
              className="text-sm text-primary hover:underline"
            >
              Forgot password?
            </button>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Verifying...
            </>
          ) : (
            "Sign In"
          )}
        </Button>

      </form>

      <ForgotPasswordDialog
        open={showForgotPassword}
        onOpenChange={setShowForgotPassword}
      />
    </AuthLayout>
  );
}
