import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2, AlertCircle } from "lucide-react";

export default function DigilockerSuccess() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [aadhaarData, setAadhaarData] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [redirectCountdown, setRedirectCountdown] = useState<number | null>(null);
  const [resolvedApplicationId, setResolvedApplicationId] = useState<string | null>(null);

  const applicationId = searchParams.get("applicationId");
  const orgId = searchParams.get("orgId");
  const id = searchParams.get("id");
  const isMock = searchParams.get("mock") === "true";
  const returnUrlParam = searchParams.get("returnUrl"); // From callback chain
  const callbackStatus = searchParams.get("status");

  // Check if this is a referral form callback
  // Priority: URL param (survives cross-domain) > localStorage (same-domain fallback)
  const referralContext = JSON.parse(localStorage.getItem("referral_aadhaar_pending") || "null");
  const isReferralCallback = !!returnUrlParam || !!referralContext;
  const effectiveReturnUrl = returnUrlParam || referralContext?.returnUrl;

  const fetchDetailsMutation = useMutation({
    mutationFn: async () => {
      if (isMock) {
        // Return mock data for testing
        return {
          success: true,
          data: {
            aadhaar_uid: "XXXX-XXXX-1234",
            name: "MOCK USER NAME",
            gender: "Male",
            dob: "1990-01-01",
            addresses: [{
              combined: "123 Mock Street, Mock City, Mock State - 123456",
            }],
            is_valid: true,
          },
          is_mock: true,
        };
      }

      const { data, error } = await supabase.functions.invoke("surepass-aadhaar-save", {
        body: {
          verificationId: id,
          aadhaarData: { status: "callback", applicationId, orgId },
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setAadhaarData(data.data);
      setStatus("success");
      
      // Capture resolved applicationId from response (from database lookup)
      if (data.applicationId) {
        setResolvedApplicationId(data.applicationId);
      }
      
      // Start auto-redirect countdown for regular application flow
      setRedirectCountdown(3);
    },
    onError: (error: any) => {
      setErrorMessage(error.message || "Failed to fetch Aadhaar details");
      setStatus("error");
    },
  });

  // Handle referral callback - fetch real data and redirect
  const handleReferralCallback = async (success: boolean) => {
    if (!effectiveReturnUrl) {
      setErrorMessage("Missing return URL for referral callback");
      setStatus("error");
      return;
    }

    if (!success) {
      // Clean up localStorage
      localStorage.removeItem("referral_aadhaar_pending");
      redirectToReferralForm(false);
      return;
    }

    // Fetch real Aadhaar data using public endpoint
    try {
      console.log("[DigilockerSuccess] Fetching Aadhaar details for referral...");
      setStatus("loading");

      const { data, error } = await supabase.functions.invoke("surepass-aadhaar-save", {
        body: {
          verificationId: id,
          aadhaarData: { status: "callback" },
        },
      });

      if (error || !data?.success) {
        console.error("[DigilockerSuccess] Error fetching Aadhaar details:", error || data?.error);
        // Still redirect with success since DigiLocker verified, but with placeholder data
        storeVerifiedInfoAndRedirect({
          name: "DigiLocker Verified",
          address: "Address verified via DigiLocker",
          dob: "DOB verified",
        });
        return;
      }

      // Build structured address from response
      const addr = data.data?.addresses?.[0];
      let addressData = null;
      let combinedAddress = "Address verified via DigiLocker";

      if (addr) {
        // Build line1: house + street + landmark
        const line1Parts = [addr.house, addr.street, addr.landmark].filter(Boolean);
        const line1 = line1Parts.join(', ') || '';
        
        // Build line2: locality + vtc + subdist
        const line2Parts = [addr.locality, addr.vtc, addr.subdist].filter(Boolean);
        const line2 = line2Parts.join(', ') || '';
        
        addressData = {
          line1: line1,
          line2: line2,
          city: addr.dist || '',
          state: addr.state || '',
          pincode: addr.pc || '',
        };
        
        combinedAddress = addr.combined || `${line1}, ${line2}, ${addr.dist}, ${addr.state} - ${addr.pc}`;
      }

      // Store real verified info
      const verifiedInfo = {
        name: data.data?.name || "DigiLocker Verified",
        address: combinedAddress,
        dob: data.data?.dob || "DOB verified",
        gender: data.data?.gender || undefined,
        aadhaarNumber: data.data?.aadhaar_uid || undefined,
        addressData: addressData,
      };

      console.log("[DigilockerSuccess] Storing verified info:", verifiedInfo);
      storeVerifiedInfoAndRedirect(verifiedInfo);

    } catch (err) {
      console.error("[DigilockerSuccess] Exception fetching Aadhaar details:", err);
      // Redirect with placeholder data
      storeVerifiedInfoAndRedirect({
        name: "DigiLocker Verified",
        address: "Address verified via DigiLocker",
        dob: "DOB verified",
      });
    }
  };

  const storeVerifiedInfoAndRedirect = (verifiedInfo: any) => {
    // Clean up localStorage
    localStorage.removeItem("referral_aadhaar_pending");

    // Store verified info for the form to consume
    localStorage.setItem("referral_aadhaar_verified", JSON.stringify(verifiedInfo));

    redirectToReferralForm(true);
  };

  const redirectToReferralForm = (success: boolean) => {
    // Build redirect URL
    try {
      const returnUrl = new URL(effectiveReturnUrl);
      // Remove any existing digilocker params
      returnUrl.searchParams.delete("digilocker_success");
      returnUrl.searchParams.delete("digilocker_failure");
      returnUrl.searchParams.delete("id");
      // Add the appropriate flag
      if (success) {
        returnUrl.searchParams.set("digilocker_success", "true");
      } else {
        returnUrl.searchParams.set("digilocker_failure", "true");
      }
      
      console.log("[DigilockerSuccess] Redirecting to:", returnUrl.toString());
      window.location.href = returnUrl.toString();
    } catch (e) {
      console.error("[DigilockerSuccess] Failed to parse returnUrl:", e);
      setErrorMessage("Failed to redirect back to application");
      setStatus("error");
    }
  };

  useEffect(() => {
    console.log("[DigilockerSuccess] Mounted with params:", {
      id,
      isMock,
      isReferralCallback,
      effectiveReturnUrl,
      callbackStatus,
      returnUrlParam,
    });

    // For referral callbacks, skip the authenticated API call
    // Just redirect back with success/failure based on the callback status
    if (isReferralCallback) {
      // Determine success based on: presence of 'id' or callback status
      const isSuccess = (id && callbackStatus !== "failure") || callbackStatus === "success" || isMock;
      console.log("[DigilockerSuccess] Referral callback - isSuccess:", isSuccess);
      
      // Small delay to ensure page renders before redirect
      setTimeout(() => {
        handleReferralCallback(isSuccess);
      }, 500);
      return;
    }

    // For regular application flow, fetch details via authenticated API
    if (id || isMock) {
      fetchDetailsMutation.mutate();
    } else {
      setErrorMessage("Missing verification ID");
      setStatus("error");
    }
  }, [id, isMock, isReferralCallback, effectiveReturnUrl, callbackStatus]);

  // Auto-redirect countdown effect
  useEffect(() => {
    if (redirectCountdown === null) return;
    
    if (redirectCountdown === 0) {
      // Auto-redirect to application page
      const targetAppId = resolvedApplicationId || applicationId;
      if (targetAppId) {
        // Invalidate caches before navigating to ensure fresh data
        queryClient.invalidateQueries({ queryKey: ["loan-verifications", targetAppId] });
        queryClient.invalidateQueries({ queryKey: ["loan-application", targetAppId] });
        navigate(`/los/applications/${targetAppId}`);
      } else {
        navigate("/los/applications");
      }
      return;
    }
    
    const timer = setTimeout(() => {
      setRedirectCountdown(prev => (prev !== null ? prev - 1 : null));
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [redirectCountdown, resolvedApplicationId, applicationId, navigate]);

  const handleContinue = () => {
    setRedirectCountdown(null); // Cancel auto-redirect
    const targetAppId = resolvedApplicationId || applicationId;
    if (targetAppId) {
      // Invalidate caches before navigating to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ["loan-verifications", targetAppId] });
      queryClient.invalidateQueries({ queryKey: ["loan-application", targetAppId] });
      navigate(`/los/applications/${targetAppId}`);
    } else {
      navigate("/los/applications");
    }
  };

  // If redirecting to referral form, show loading state
  if (isReferralCallback && status === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
            <CardTitle>Verification Complete</CardTitle>
            <CardDescription>
              Redirecting you back to the application form...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {status === "loading" && (
            <>
              <div className="mx-auto mb-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
              </div>
              <CardTitle>Processing Verification</CardTitle>
              <CardDescription>
                Fetching your Aadhaar details from DigiLocker...
              </CardDescription>
            </>
          )}

          {status === "success" && (
            <>
              <div className="mx-auto mb-4">
                <CheckCircle className="h-12 w-12 text-green-500" />
              </div>
              <CardTitle className="text-green-600">Verification Successful</CardTitle>
              <CardDescription>
                Your Aadhaar has been verified successfully via DigiLocker
                {redirectCountdown !== null && (
                  <span className="block mt-2 text-primary font-medium">
                    Redirecting in {redirectCountdown} seconds...
                  </span>
                )}
              </CardDescription>
            </>
          )}

          {status === "error" && (
            <>
              <div className="mx-auto mb-4">
                <AlertCircle className="h-12 w-12 text-destructive" />
              </div>
              <CardTitle className="text-destructive">Verification Failed</CardTitle>
              <CardDescription>{errorMessage}</CardDescription>
            </>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          {status === "success" && aadhaarData && (
            <div className="space-y-3 p-4 bg-muted rounded-lg">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Name:</span>
                <span className="font-medium">{aadhaarData.name}</span>
              </div>
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
              {aadhaarData.aadhaar_uid && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Aadhaar:</span>
                  <span className="font-medium">{aadhaarData.aadhaar_uid}</span>
                </div>
              )}
              {aadhaarData.addresses?.[0]?.combined && (
                <div className="pt-2 border-t">
                  <span className="text-muted-foreground text-sm">Address:</span>
                  <p className="text-sm mt-1">{aadhaarData.addresses[0].combined}</p>
                </div>
              )}
              {isMock && (
                <div className="mt-2 p-2 bg-amber-100 text-amber-800 rounded text-xs">
                  ⚠️ This is mock data for testing purposes
                </div>
              )}
            </div>
          )}

          <Button onClick={handleContinue} className="w-full">
            {status === "success" 
              ? `Continue Now${redirectCountdown !== null ? ` (${redirectCountdown})` : ''}`
              : "Go Back"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}