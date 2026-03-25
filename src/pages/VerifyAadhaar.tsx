import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2, AlertCircle, ShieldCheck } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://newvgnbygvtnmyomxbmu.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ld3ZnbmJ5Z3Z0bm15b214Ym11Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxODY4MTIsImV4cCI6MjA4ODc2MjgxMn0.pVaREVeEVFGAXxR57DMzCYmZmnaIrbliVdUSUFgdxlg";
const FUNCTIONS_BASE = `${SUPABASE_URL}/functions/v1`;

type PageStatus = "loading" | "ready" | "verifying" | "success" | "error";

export default function VerifyAadhaar() {
  const { verificationId } = useParams<{ verificationId: string }>();
  const [status, setStatus] = useState<PageStatus>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [aadhaarData, setAadhaarData] = useState<any>(null);
  const [sdkToken, setSdkToken] = useState<string | null>(null);

  // Step 1: Initialize Surepass session when page loads
  useEffect(() => {
    if (!verificationId) {
      setErrorMessage("Invalid verification link");
      setStatus("error");
      return;
    }

    initializeSurepass();
  }, [verificationId]);

  const initializeSurepass = async () => {
    setStatus("loading");
    try {
      const response = await fetch(`${FUNCTIONS_BASE}/surepass-aadhaar-init`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ verificationId }),
      });

      const data = await response.json();

      if (!data.success) {
        setErrorMessage(data.error || "Failed to initialize verification");
        setStatus("error");
        return;
      }

      setSdkToken(data.data.token);
      setStatus("ready");
    } catch (err) {
      console.error("[VerifyAadhaar] Init error:", err);
      setErrorMessage("Unable to connect to verification service. Please try again.");
      setStatus("error");
    }
  };

  // Step 2: Load DigiBoost SDK and start verification
  const startVerification = () => {
    if (!sdkToken) return;

    setStatus("verifying");

    const script = document.createElement("script");
    script.src =
      "https://cdn.jsdelivr.net/gh/surepassio/surepass-digiboost-web-sdk@latest/index.min.js";
    script.onload = () => {
      try {
        (window as any).DigiboostSdk({
          gateway: "production",
          token: sdkToken,
          selector: "#digilocker-sdk-container",
          onSuccess: async (data: any) => {
            console.log("[VerifyAadhaar] SDK onSuccess:", data);
            await saveAadhaarData(data);
          },
          onFailure: (error: any) => {
            console.error("[VerifyAadhaar] SDK onFailure:", error);
            setErrorMessage(
              error?.message || "DigiLocker verification was cancelled or failed. Please try again."
            );
            setStatus("error");
          },
        });
      } catch (err) {
        console.error("[VerifyAadhaar] SDK init error:", err);
        setErrorMessage("Failed to start DigiLocker verification");
        setStatus("error");
      }
    };
    script.onerror = () => {
      setErrorMessage("Failed to load verification module. Please check your internet connection.");
      setStatus("error");
    };
    document.body.appendChild(script);
  };

  // Step 3: Save Aadhaar data to backend
  const saveAadhaarData = async (data: any) => {
    try {
      const response = await fetch(`${FUNCTIONS_BASE}/surepass-aadhaar-save`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          verificationId,
          aadhaarData: data,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        setErrorMessage(result.error || "Failed to save verification data");
        setStatus("error");
        return;
      }

      setAadhaarData(data);
      setStatus("success");
    } catch (err) {
      console.error("[VerifyAadhaar] Save error:", err);
      setErrorMessage("Failed to save verification. Please contact support.");
      setStatus("error");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/30 p-4">
      <Card className="w-full max-w-md shadow-lg">
        {/* Header */}
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-2 p-3 rounded-full bg-primary/10 w-fit">
            <ShieldCheck className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-xl">Aadhaar Verification</CardTitle>
          <CardDescription>
            Verify your identity securely via DigiLocker
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Loading state */}
          {status === "loading" && (
            <div className="text-center py-8">
              <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Preparing verification...</p>
            </div>
          )}

          {/* Ready — show start button */}
          {status === "ready" && (
            <div className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg text-sm space-y-2">
                <p className="font-medium">How it works:</p>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                  <li>Click the button below to open DigiLocker</li>
                  <li>Log in with your Aadhaar-linked mobile number</li>
                  <li>Authorize access to your Aadhaar document</li>
                  <li>Your identity will be verified automatically</li>
                </ol>
              </div>

              <div id="digilocker-sdk-container" />

              <Button onClick={startVerification} className="w-full" size="lg">
                <ShieldCheck className="mr-2 h-5 w-5" />
                Start DigiLocker Verification
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                Your data is securely processed and protected under DPDP regulations.
              </p>
            </div>
          )}

          {/* Verifying — SDK is active */}
          {status === "verifying" && (
            <div className="text-center py-8">
              <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-3" />
              <p className="text-sm font-medium">DigiLocker verification in progress...</p>
              <p className="text-xs text-muted-foreground mt-1">
                Please complete the verification in the popup window
              </p>
              <div id="digilocker-sdk-container" className="mt-4" />
            </div>
          )}

          {/* Success */}
          {status === "success" && (
            <div className="text-center py-4">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-green-600 mb-1">
                Verification Successful
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Your Aadhaar has been verified successfully
              </p>

              {aadhaarData && (
                <div className="text-left space-y-2 p-4 bg-green-50 border border-green-200 rounded-lg text-sm">
                  {aadhaarData.name && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Name:</span>
                      <span className="font-medium">{aadhaarData.name}</span>
                    </div>
                  )}
                  {aadhaarData.dob && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">DOB:</span>
                      <span className="font-medium">{aadhaarData.dob}</span>
                    </div>
                  )}
                  {aadhaarData.gender && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Gender:</span>
                      <span className="font-medium">{aadhaarData.gender}</span>
                    </div>
                  )}
                </div>
              )}

              <p className="text-xs text-muted-foreground mt-4">
                You can close this page now. Your verification has been recorded.
              </p>
            </div>
          )}

          {/* Error */}
          {status === "error" && (
            <div className="text-center py-4">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-destructive mb-1">
                Verification Failed
              </h3>
              <p className="text-sm text-muted-foreground mb-4">{errorMessage}</p>

              <Button onClick={initializeSurepass} variant="outline" className="w-full">
                Try Again
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
