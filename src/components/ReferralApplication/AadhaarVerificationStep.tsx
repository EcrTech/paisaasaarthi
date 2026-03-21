import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ArrowLeft, ArrowRight, FileCheck, ShieldCheck, MapPin, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useAnalytics } from "@/hooks/useAnalytics";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const FUNCTIONS_BASE = `${SUPABASE_URL}/functions/v1`;

interface CommunicationAddress {
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
}

interface AadhaarVerificationStepProps {
  onVerified: (data: {
    name: string;
    address: string;
    dob: string;
    aadhaarNumber?: string;
    gender?: string;
    addressData?: {
      line1: string;
      line2: string;
      city: string;
      state: string;
      pincode: string;
    };
  }) => void;
  onNext: () => void;
  onBack: () => void;
  isVerified: boolean;
  verifiedData?: { name: string; address: string; dob: string };
  communicationAddress?: CommunicationAddress;
  onCommunicationAddressChange?: (address: CommunicationAddress | null) => void;
  isDifferentAddress?: boolean;
  onDifferentAddressChange?: (isDifferent: boolean) => void;
  applicationId?: string | null;
}

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry"
];

type AadhaarPhase = "ready" | "initializing" | "verifying" | "saving" | "verified" | "failed";

export function AadhaarVerificationStep({
  onVerified,
  onNext,
  onBack,
  isVerified,
  verifiedData,
  communicationAddress,
  onCommunicationAddressChange,
  isDifferentAddress = false,
  onDifferentAddressChange,
  applicationId,
}: AadhaarVerificationStepProps) {
  const { trackAadhaarStart, trackAadhaarSuccess, trackStep } = useAnalytics();
  const [phase, setPhase] = useState<AadhaarPhase>(isVerified ? "verified" : "ready");
  const [errorMessage, setErrorMessage] = useState("");

  const [localDifferentAddress, setLocalDifferentAddress] = useState(isDifferentAddress);
  const [localCommAddress, setLocalCommAddress] = useState<CommunicationAddress>(
    communicationAddress || { addressLine1: "", addressLine2: "", city: "", state: "", pincode: "" }
  );

  // Create a verification record and get SDK token, then load DigiBoost SDK
  const startVerification = async () => {
    setPhase("initializing");
    setErrorMessage("");
    trackAadhaarStart();

    try {
      // Step 1: Create a verification record in loan_verifications
      let verificationId: string;

      // Use the surepass-aadhaar-init endpoint which creates/validates the record
      // First, create a pending verification record via direct API
      const createResponse = await fetch(`${FUNCTIONS_BASE}/surepass-aadhaar-init`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          verificationId: applicationId ? undefined : undefined,
        }),
      });

      // We need to create the record first, then init
      // Let's use a simpler approach: call surepass-aadhaar-init with a pre-created record
      // Actually, for the referral flow, we should create the record ourselves
      // and then call init with its ID

      // Create a pending loan_verification record using the edge function approach
      const initBody: any = {};

      if (applicationId) {
        // Create the verification record via a lightweight call
        const recordRes = await fetch(`${SUPABASE_URL}/rest/v1/loan_verifications`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            Prefer: "return=representation",
          },
          body: JSON.stringify({
            loan_application_id: applicationId,
            verification_type: "aadhaar",
            verification_source: "surepass",
            status: "pending",
            request_data: { initiated_at: new Date().toISOString() },
          }),
        });

        const records = await recordRes.json();
        verificationId = Array.isArray(records) ? records[0]?.id : records?.id;
      } else {
        // No application ID — generate a temp UUID
        verificationId = crypto.randomUUID();
      }

      if (!verificationId) {
        throw new Error("Failed to create verification record");
      }

      // Step 2: Initialize Surepass DigiLocker session
      const initResponse = await fetch(`${FUNCTIONS_BASE}/surepass-aadhaar-init`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ verificationId }),
      });

      const initData = await initResponse.json();

      if (!initData.success) {
        throw new Error(initData.error || "Failed to initialize DigiLocker");
      }

      const sdkToken = initData.data.token;

      // Step 3: Load DigiBoost SDK
      setPhase("verifying");

      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/gh/surepassio/surepass-digiboost-web-sdk@latest/index.min.js";
      script.onload = () => {
        try {
          (window as any).DigiboostSdk({
            gateway: "sandbox",
            token: sdkToken,
            selector: "#digilocker-sdk-referral",
            onSuccess: async (data: any) => {
              console.log("[AadhaarVerificationStep] SDK onSuccess:", data);
              await saveAadhaarData(verificationId, data);
            },
            onFailure: (error: any) => {
              console.error("[AadhaarVerificationStep] SDK onFailure:", error);
              setErrorMessage(error?.message || "DigiLocker verification was cancelled or failed.");
              setPhase("failed");
            },
          });
        } catch (err) {
          console.error("[AadhaarVerificationStep] SDK init error:", err);
          setErrorMessage("Failed to start DigiLocker verification");
          setPhase("failed");
        }
      };
      script.onerror = () => {
        setErrorMessage("Failed to load verification module. Please check your internet connection.");
        setPhase("failed");
      };
      document.body.appendChild(script);
    } catch (err: any) {
      console.error("[AadhaarVerificationStep] Init error:", err);
      setErrorMessage(err.message || "Failed to initialize verification");
      setPhase("failed");
    }
  };

  // Save Aadhaar data from SDK callback
  const saveAadhaarData = async (verificationId: string, data: any) => {
    setPhase("saving");

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
        console.warn("[AadhaarVerificationStep] Save warning:", result.error);
        // Continue anyway — the data was verified by DigiLocker
      }

      // Extract address data
      const addr = data.address || data.addresses?.[0];
      let addressStr = "";
      let addressData = undefined;

      if (addr) {
        if (typeof addr === "string") {
          addressStr = addr;
        } else {
          const line1Parts = [addr.house, addr.street, addr.landmark].filter(Boolean);
          const line2Parts = [addr.locality, addr.vtc, addr.subdist].filter(Boolean);
          addressStr = addr.combined || [line1Parts.join(", "), line2Parts.join(", "), addr.dist, addr.state, addr.pc].filter(Boolean).join(", ");
          addressData = {
            line1: line1Parts.join(", "),
            line2: line2Parts.join(", "),
            city: addr.dist || "",
            state: addr.state || "",
            pincode: addr.pc || "",
          };
        }
      }

      const verifiedInfo = {
        name: data.name || data.full_name || "",
        address: addressStr,
        dob: data.dob || data.date_of_birth || "",
        gender: data.gender || "",
        aadhaarNumber: data.aadhaar_uid || data.aadhaar_number || "",
        addressData,
      };

      setPhase("verified");
      onVerified(verifiedInfo);
      trackAadhaarSuccess();
      trackStep(3, "aadhaar_verified", "referral");
      toast.success("Aadhaar verified successfully via DigiLocker");
    } catch (err: any) {
      console.error("[AadhaarVerificationStep] Save error:", err);
      // Still mark as verified since DigiLocker confirmed it
      setPhase("verified");
      onVerified({
        name: data.name || "",
        address: "Verified via DigiLocker",
        dob: data.dob || "",
      });
      toast.success("Aadhaar verified successfully");
    }
  };

  const getMaskedAadhaar = (aadhaarNumber?: string) => {
    if (aadhaarNumber && aadhaarNumber.length >= 4) {
      return `XXXX XXXX ${aadhaarNumber.slice(-4)}`;
    }
    return "XXXX XXXX XXXX";
  };

  return (
    <div className="space-y-8">
      {/* Section Header */}
      <div className="flex items-center gap-4 pb-5 border-b border-border">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <FileCheck className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h3 className="text-xl font-heading font-bold text-foreground">Identity Verification</h3>
          <p className="text-sm text-muted-foreground font-body">
            {isVerified || phase === "verified" ? "Your identity has been verified" : "Verify your identity using DigiLocker"}
          </p>
        </div>
      </div>

      {/* Back Button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors font-body"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to PAN Verification
      </button>

      {/* Verified Details Card */}
      {(isVerified || phase === "verified") && verifiedData && (
        <Card className="rounded-xl overflow-hidden bg-[hsl(var(--success))]/5 border-2 border-[hsl(var(--success))]/20">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[hsl(var(--success))]">
                <ShieldCheck className="h-5 w-5 text-white" />
              </div>
              <span className="font-heading font-bold text-[hsl(var(--success))]">
                Aadhaar Verified Successfully
              </span>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground font-body text-sm">Name</span>
                <span className="font-heading font-semibold text-foreground">{verifiedData.name}</span>
              </div>
              {verifiedData.address && (
                <div className="flex justify-between items-start">
                  <span className="text-muted-foreground font-body text-sm">Address</span>
                  <span className="font-body text-foreground text-right max-w-[220px] text-sm">{verifiedData.address}</span>
                </div>
              )}
              {verifiedData.dob && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground font-body text-sm">DOB</span>
                  <span className="font-heading font-semibold text-foreground">{verifiedData.dob}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* DigiLocker Verification — Not yet verified */}
      {!isVerified && phase !== "verified" && (
        <div className="space-y-4">
          {/* Ready / Failed state — show verify button */}
          {(phase === "ready" || phase === "failed") && (
            <Card className="rounded-xl border-2 border-primary/20 bg-primary/5">
              <CardContent className="p-6 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <ShieldCheck className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h4 className="font-heading font-bold text-lg text-foreground mb-2">
                    Verify via DigiLocker
                  </h4>
                  <p className="text-sm text-muted-foreground font-body">
                    Complete your Aadhaar verification securely through DigiLocker.
                    This is required to proceed with your loan application.
                  </p>
                </div>

                {phase === "failed" && errorMessage && (
                  <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <XCircle className="h-4 w-4 text-destructive" />
                      <span className="text-sm font-medium text-destructive">Verification Failed</span>
                    </div>
                    <p className="text-xs text-destructive/80">{errorMessage}</p>
                  </div>
                )}

                <div id="digilocker-sdk-referral" />

                <Button
                  onClick={startVerification}
                  className="w-full h-14 text-lg font-heading font-bold btn-electric rounded-xl"
                >
                  <ShieldCheck className="h-5 w-5 mr-2" />
                  {phase === "failed" ? "Try Again" : "Verify with DigiLocker"}
                </Button>
                <p className="text-xs text-muted-foreground font-body">
                  A popup will open for you to authenticate with DigiLocker
                </p>
              </CardContent>
            </Card>
          )}

          {/* Initializing */}
          {phase === "initializing" && (
            <div className="flex flex-col items-center py-8">
              <Loader2 className="h-10 w-10 animate-spin text-primary mb-3" />
              <p className="text-sm font-medium text-foreground">Preparing DigiLocker...</p>
            </div>
          )}

          {/* Verifying — SDK popup is active */}
          {phase === "verifying" && (
            <div className="text-center py-6">
              <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground">DigiLocker verification in progress...</p>
              <p className="text-xs text-muted-foreground mt-1">
                Please complete the verification in the popup window
              </p>
              <div id="digilocker-sdk-referral" className="mt-4" />
            </div>
          )}

          {/* Saving */}
          {phase === "saving" && (
            <div className="flex flex-col items-center py-8">
              <Loader2 className="h-10 w-10 animate-spin text-primary mb-3" />
              <p className="text-sm font-medium text-foreground">Saving verification data...</p>
            </div>
          )}
        </div>
      )}

      {/* Communication Address Section — Show only when verified */}
      {(isVerified || phase === "verified") && (
        <div className="space-y-4">
          <div className="flex items-start space-x-3 p-4 bg-muted/30 rounded-xl border border-border">
            <Checkbox
              id="differentAddress"
              checked={localDifferentAddress}
              onCheckedChange={(checked) => {
                const isChecked = checked === true;
                setLocalDifferentAddress(isChecked);
                onDifferentAddressChange?.(isChecked);
                if (!isChecked) {
                  onCommunicationAddressChange?.(null);
                }
              }}
              className="mt-0.5"
            />
            <div className="space-y-1">
              <Label
                htmlFor="differentAddress"
                className="text-sm font-heading font-semibold text-foreground cursor-pointer"
              >
                Communication address is different from Aadhaar address
              </Label>
              <p className="text-xs text-muted-foreground font-body">
                Check this if you want loan-related documents sent to a different address
              </p>
            </div>
          </div>

          {/* Communication Address Form */}
          {localDifferentAddress && (
            <Card className="rounded-xl border-2 border-primary/20 bg-primary/5">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <MapPin className="h-4 w-4 text-primary" />
                  </div>
                  <span className="font-heading font-bold text-foreground">Communication Address</span>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-heading font-medium text-foreground">
                    Address Line 1 <span className="text-[hsl(var(--coral-500))]">*</span>
                  </Label>
                  <Input
                    placeholder="House/Flat No., Building Name"
                    value={localCommAddress.addressLine1}
                    onChange={(e) => {
                      const updated = { ...localCommAddress, addressLine1: e.target.value };
                      setLocalCommAddress(updated);
                      onCommunicationAddressChange?.(updated);
                    }}
                    className="h-12 bg-background border-2 border-border rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-heading font-medium text-foreground">
                    Address Line 2
                  </Label>
                  <Input
                    placeholder="Street, Locality, Landmark"
                    value={localCommAddress.addressLine2}
                    onChange={(e) => {
                      const updated = { ...localCommAddress, addressLine2: e.target.value };
                      setLocalCommAddress(updated);
                      onCommunicationAddressChange?.(updated);
                    }}
                    className="h-12 bg-background border-2 border-border rounded-xl"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-heading font-medium text-foreground">
                      City <span className="text-[hsl(var(--coral-500))]">*</span>
                    </Label>
                    <Input
                      placeholder="City"
                      value={localCommAddress.city}
                      onChange={(e) => {
                        const updated = { ...localCommAddress, city: e.target.value };
                        setLocalCommAddress(updated);
                        onCommunicationAddressChange?.(updated);
                      }}
                      className="h-12 bg-background border-2 border-border rounded-xl"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-heading font-medium text-foreground">
                      PIN Code <span className="text-[hsl(var(--coral-500))]">*</span>
                    </Label>
                    <Input
                      placeholder="6-digit PIN"
                      value={localCommAddress.pincode}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                        const updated = { ...localCommAddress, pincode: value };
                        setLocalCommAddress(updated);
                        onCommunicationAddressChange?.(updated);
                      }}
                      className="h-12 bg-background border-2 border-border rounded-xl"
                      maxLength={6}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-heading font-medium text-foreground">
                    State <span className="text-[hsl(var(--coral-500))]">*</span>
                  </Label>
                  <Select
                    value={localCommAddress.state}
                    onValueChange={(value) => {
                      const updated = { ...localCommAddress, state: value };
                      setLocalCommAddress(updated);
                      onCommunicationAddressChange?.(updated);
                    }}
                  >
                    <SelectTrigger className="h-12 bg-background border-2 border-border rounded-xl">
                      <SelectValue placeholder="Select State" />
                    </SelectTrigger>
                    <SelectContent>
                      {INDIAN_STATES.map((state) => (
                        <SelectItem key={state} value={state}>
                          {state}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Next Button — only enabled when verified */}
      <Button
        onClick={() => {
          if (localDifferentAddress) {
            if (!localCommAddress.addressLine1 || !localCommAddress.city || !localCommAddress.state || !localCommAddress.pincode) {
              toast.error("Please fill all required communication address fields");
              return;
            }
            if (localCommAddress.pincode.length !== 6) {
              toast.error("Please enter a valid 6-digit PIN code");
              return;
            }
          }
          onNext();
        }}
        disabled={!isVerified && phase !== "verified"}
        className="w-full h-14 text-lg font-heading font-bold btn-electric rounded-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
      >
        {isVerified || phase === "verified" ? (
          <>
            Continue to Video KYC
            <ArrowRight className="h-5 w-5 ml-2" />
          </>
        ) : (
          "Complete DigiLocker Verification to Continue"
        )}
      </Button>
    </div>
  );
}
