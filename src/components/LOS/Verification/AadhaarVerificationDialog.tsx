import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, AlertCircle, Send, MessageCircle, Mail, Copy, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

interface AadhaarVerificationDialogProps {
  open: boolean;
  onClose: () => void;
  applicationId: string;
  orgId: string;
  applicant: any;
  existingVerification?: any;
}

export default function AadhaarVerificationDialog({
  open,
  onClose,
  applicationId,
  orgId,
  applicant,
  existingVerification,
}: AadhaarVerificationDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch Aadhaar OCR data from uploaded documents
  const { data: aadhaarOcr } = useQuery({
    queryKey: ["aadhaar-doc-ocr", applicationId],
    queryFn: async () => {
      const { data } = await supabase
        .from("loan_documents")
        .select("document_type, ocr_data")
        .eq("loan_application_id", applicationId)
        .in("document_type", ["aadhaar_front", "aadhaar_back", "aadhaar_card"])
        .order("created_at", { ascending: false });
      if (!data || data.length === 0) return null;
      const front = data.find(d => d.document_type === "aadhaar_front" || d.document_type === "aadhaar_card");
      const back = data.find(d => d.document_type === "aadhaar_back");
      return {
        ...(back?.ocr_data as Record<string, any> || {}),
        ...(front?.ocr_data as Record<string, any> || {}),
        address: (back?.ocr_data as Record<string, any>)?.address || (front?.ocr_data as Record<string, any>)?.address || "",
      };
    },
    enabled: !!applicationId,
  });

  const [formData, setFormData] = useState({
    aadhaar_last4: existingVerification?.request_data?.aadhaar_last4 || "",
    verified_address: existingVerification?.response_data?.verified_address || "",
    address_match_result: existingVerification?.response_data?.address_match_result || "exact",
    aadhaar_status: existingVerification?.response_data?.aadhaar_status || "valid",
    status: existingVerification?.status || "success",
    remarks: existingVerification?.remarks || "",
    name: existingVerification?.response_data?.name || "",
  });

  // Pre-fill from OCR data if no existing verification
  useEffect(() => {
    if (aadhaarOcr && !existingVerification) {
      const aadhaarNum = aadhaarOcr.aadhaar_number?.replace(/\s/g, '') || "";
      setFormData(prev => ({
        ...prev,
        aadhaar_last4: prev.aadhaar_last4 || (aadhaarNum ? aadhaarNum.slice(-4) : ""),
        name: prev.name || aadhaarOcr.name || "",
        verified_address: prev.verified_address || aadhaarOcr.address || "",
      }));
    }
  }, [aadhaarOcr, existingVerification]);

  const [digilockerUrl, setDigilockerUrl] = useState<string | null>(null);
  const [uniqueRequestNumber, setUniqueRequestNumber] = useState<string | null>(
    existingVerification?.request_data?.unique_request_number || null
  );
  const [whatsappSent, setWhatsappSent] = useState(false);
  const [whatsappError, setWhatsappError] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [sendingWhatsapp, setSendingWhatsapp] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [verificationComplete, setVerificationComplete] = useState(
    existingVerification?.status === "success"
  );

  const applicantPhone = applicant?.mobile_number || applicant?.phone || applicant?.mobile || "";
  const applicantEmail = applicant?.email || "";
  const applicantName = `${applicant?.first_name || ""} ${applicant?.last_name || ""}`.trim() || "Customer";

  // Initiate Aadhaar verification via VerifiedU DigiLocker
  const initiateMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('verifiedu-aadhaar-initiate', {
        body: {
          applicationId,
          orgId,
          successUrl: `${window.location.origin}/digilocker/success`,
          failureUrl: `${window.location.origin}/digilocker/failure`,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || "Failed to initiate Aadhaar verification");
      return data;
    },
    onSuccess: async (data) => {
      const url = data.data.url;
      const reqNumber = data.data.unique_request_number;
      setDigilockerUrl(url);
      setUniqueRequestNumber(reqNumber);
      toast({
        title: "DigiLocker Verification Initiated",
        description: "Sending verification link to the customer...",
      });

      // Auto-send WhatsApp and Email in parallel
      if (applicantPhone) autoSendWhatsApp(url);
      if (applicantEmail) autoSendEmail(url);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Initiation Failed",
        description: error.message || "Failed to initiate Aadhaar verification",
      });
    },
  });

  // Send verification link via WhatsApp (uses template for cold outreach)
  const sendWhatsApp = async (url?: string) => {
    const linkUrl = url || digilockerUrl;
    if (!linkUrl || !applicantPhone) return;
    setSendingWhatsapp(true);
    setWhatsappError(null);
    try {
      // Use approved template "aadhaar_verification_link" with variables:
      // {{1}} = customer name, {{2}} = application ID, {{3}} = DigiLocker URL
      const { data, error } = await supabase.functions.invoke('send-whatsapp-message', {
        body: {
          phoneNumber: applicantPhone,
          templateName: "aadhaar_verification_link",
          templateVariables: {
            "1": applicantName,
            "2": applicationId,
            "3": linkUrl,
          },
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to send WhatsApp message");

      setWhatsappSent(true);
      toast({ title: "WhatsApp sent", description: "Verification link sent to customer via WhatsApp" });
    } catch (err: any) {
      console.error("WhatsApp send error:", err);
      const errMsg = err.message || "Failed to send WhatsApp. You can copy the link and send manually.";
      setWhatsappError(errMsg);
      toast({ variant: "destructive", title: "WhatsApp Failed", description: errMsg });
    } finally {
      setSendingWhatsapp(false);
    }
  };

  // Send verification link via Email
  const sendEmail = async (url?: string) => {
    const linkUrl = url || digilockerUrl;
    if (!linkUrl || !applicantEmail) return;
    setSendingEmail(true);
    setEmailError(null);
    try {
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #0d9488; padding: 24px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Aadhaar Verification</h1>
          </div>
          <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <p>Hi ${applicantName},</p>
            <p>Please complete your Aadhaar verification for your loan application by clicking the button below:</p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${linkUrl}" style="background: #0d9488; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                Verify Aadhaar via DigiLocker
              </a>
            </div>
            <p style="color: #6b7280; font-size: 14px;">This link will take you to DigiLocker where you can securely authorize access to your Aadhaar data.</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
            <p style="color: #9ca3af; font-size: 12px;">If the button doesn't work, copy and paste this link into your browser:<br/>${linkUrl}</p>
            <p style="color: #6b7280; font-size: 14px;">Team Paisaa Saarthi</p>
          </div>
        </div>
      `;

      const { data, error } = await supabase.functions.invoke('send-email', {
        body: {
          to: applicantEmail,
          subject: "Complete Your Aadhaar Verification - Paisaa Saarthi",
          html,
        },
      });

      if (error) throw error;

      setEmailSent(true);
      toast({ title: "Email sent", description: "Verification link sent to customer via Email" });
    } catch (err: any) {
      console.error("Email send error:", err);
      const errMsg = err.message || "Failed to send email. You can copy the link and send manually.";
      setEmailError(errMsg);
      toast({ variant: "destructive", title: "Email Failed", description: errMsg });
    } finally {
      setSendingEmail(false);
    }
  };

  // Auto-send functions called from initiateMutation.onSuccess
  const autoSendWhatsApp = (url: string) => sendWhatsApp(url);
  const autoSendEmail = (url: string) => sendEmail(url);

  // Check verification status via VerifiedU
  const checkStatus = async () => {
    if (!uniqueRequestNumber) {
      toast({ variant: "destructive", title: "No request number available" });
      return;
    }
    setCheckingStatus(true);
    try {
      const { data, error } = await supabase.functions.invoke('verifiedu-aadhaar-details', {
        body: {
          uniqueRequestNumber,
          applicationId,
          orgId,
        },
      });

      if (error) throw error;

      if (data?.success && data?.data?.is_valid) {
        // Verification complete - update form with response data
        const aadhaarData = data.data;
        const address = aadhaarData.addresses?.[0]?.combined || "";
        const aadhaarUid = aadhaarData.aadhaar_uid || "";
        const last4 = aadhaarUid.slice(-4);

        setFormData(prev => ({
          ...prev,
          name: aadhaarData.name || prev.name,
          verified_address: address || prev.verified_address,
          aadhaar_last4: last4 || prev.aadhaar_last4,
          aadhaar_status: "valid",
          status: "success",
          address_match_result: "exact",
        }));
        setVerificationComplete(true);

        toast({ title: "Aadhaar Verified!", description: `Customer ${aadhaarData.name} verified successfully via DigiLocker` });

        // Invalidate queries to refresh the verification status in the dashboard
        queryClient.invalidateQueries({ queryKey: ["loan-verifications", applicationId] });
      } else if (data?.success && data?.data && !data?.data?.is_valid) {
        toast({
          variant: "destructive",
          title: "Verification Failed",
          description: "Aadhaar verification returned invalid. Customer may need to retry.",
        });
        setFormData(prev => ({ ...prev, status: "failed", aadhaar_status: "invalid" }));
      } else {
        toast({
          title: "Verification Pending",
          description: "Customer has not completed the DigiLocker verification yet. Please try again later.",
        });
      }
    } catch (err: any) {
      console.error("Status check error:", err);
      const errMsg = err?.message || "";
      if (errMsg.includes("409") || errMsg.includes("mismatch") || errMsg.includes("Conflict")) {
        toast({
          variant: "destructive",
          title: "Temporary Issue",
          description: "The verification service returned a temporary error. Please wait a moment and click 'Check Status' again.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Status Check Failed",
          description: "Failed to check verification status. The customer may not have completed verification yet.",
        });
      }
    } finally {
      setCheckingStatus(false);
    }
  };

  // Copy link to clipboard
  const copyLink = () => {
    if (digilockerUrl) {
      navigator.clipboard.writeText(digilockerUrl);
      toast({ title: "Link copied to clipboard" });
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const verificationData = {
        loan_application_id: applicationId,
        applicant_id: applicant?.id,
        verification_type: "aadhaar",
        verification_source: "verifiedu",
        status: formData.status,
        request_data: {
          aadhaar_last4: formData.aadhaar_last4,
          unique_request_number: uniqueRequestNumber,
        },
        response_data: {
          verified_address: formData.verified_address,
          address_match_result: formData.address_match_result,
          aadhaar_status: formData.aadhaar_status,
          name: formData.name,
        },
        remarks: formData.remarks,
        verified_at: new Date().toISOString(),
      };

      if (existingVerification) {
        const { error } = await supabase
          .from("loan_verifications")
          .update(verificationData)
          .eq("id", existingVerification.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("loan_verifications")
          .insert(verificationData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loan-verifications", applicationId] });
      toast({ title: "Aadhaar verification saved successfully" });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to save verification",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Determine if we're in "already initiated" state (e.g. existing in_progress verification)
  const isAlreadyInitiated = !!uniqueRequestNumber && !digilockerUrl && existingVerification?.status === "in_progress";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Aadhaar Verification</DialogTitle>
          <DialogDescription>
            Send DigiLocker verification link to the customer via WhatsApp & Email
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Customer Info */}
          <div className="p-3 bg-muted rounded-md">
            <p className="text-xs font-medium text-muted-foreground mb-2">Customer Details</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Name: </span>
                <span className="font-medium">{applicantName}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Phone: </span>
                <span className="font-medium">{applicantPhone || "N/A"}</span>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">Email: </span>
                <span className="font-medium">{applicantEmail || "N/A"}</span>
              </div>
            </div>
          </div>

          {/* Step 1: Initiate Verification */}
          {!digilockerUrl && !isAlreadyInitiated && !verificationComplete && (
            <>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Click below to generate a DigiLocker verification link. The link will be sent to the customer via WhatsApp and Email.
                </AlertDescription>
              </Alert>

              <Button
                onClick={() => initiateMutation.mutate()}
                disabled={initiateMutation.isPending}
                variant="default"
                className="w-full"
              >
                {initiateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Send className="mr-2 h-4 w-4" />
                Generate Verification Link
              </Button>
            </>
          )}

          {/* Step 2: Send link to customer */}
          {(digilockerUrl || isAlreadyInitiated) && !verificationComplete && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 bg-primary/10 rounded-md">
                <CheckCircle className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">DigiLocker verification link generated</span>
              </div>

              {/* Link display with copy */}
              {digilockerUrl && (
                <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                  <Input
                    value={digilockerUrl}
                    readOnly
                    className="text-xs h-8 font-mono"
                  />
                  <Button variant="outline" size="sm" onClick={copyLink} className="shrink-0">
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              )}

              {/* Auto-send status */}
              <div className="space-y-2">
                {/* WhatsApp status */}
                <div className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                  <div className="flex items-center gap-2 text-sm">
                    <MessageCircle className="h-4 w-4" />
                    <span>WhatsApp</span>
                    {!applicantPhone && <span className="text-xs text-destructive">(no phone)</span>}
                  </div>
                  {sendingWhatsapp ? (
                    <Badge variant="outline" className="text-xs"><Loader2 className="h-3 w-3 animate-spin mr-1" />Sending...</Badge>
                  ) : whatsappSent ? (
                    <Badge className="bg-green-100 text-green-800 text-xs"><CheckCircle className="h-3 w-3 mr-1" />Sent</Badge>
                  ) : whatsappError ? (
                    <div className="flex items-center gap-1">
                      <Badge variant="destructive" className="text-xs">Failed</Badge>
                      <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => sendWhatsApp()} disabled={!applicantPhone}>
                        Retry
                      </Button>
                    </div>
                  ) : applicantPhone ? (
                    <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={() => sendWhatsApp()} disabled={!digilockerUrl}>
                      Send
                    </Button>
                  ) : null}
                </div>

                {/* Email status */}
                <div className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4" />
                    <span>Email</span>
                    {!applicantEmail && <span className="text-xs text-destructive">(no email)</span>}
                  </div>
                  {sendingEmail ? (
                    <Badge variant="outline" className="text-xs"><Loader2 className="h-3 w-3 animate-spin mr-1" />Sending...</Badge>
                  ) : emailSent ? (
                    <Badge className="bg-blue-100 text-blue-800 text-xs"><CheckCircle className="h-3 w-3 mr-1" />Sent</Badge>
                  ) : emailError ? (
                    <div className="flex items-center gap-1">
                      <Badge variant="destructive" className="text-xs">Failed</Badge>
                      <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => sendEmail()} disabled={!applicantEmail}>
                        Retry
                      </Button>
                    </div>
                  ) : applicantEmail ? (
                    <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={() => sendEmail()} disabled={!digilockerUrl}>
                      Send
                    </Button>
                  ) : null}
                </div>
              </div>

              {/* Check Status */}
              <div className="border-t pt-4">
                <p className="text-sm text-muted-foreground mb-2">
                  After the customer completes verification via DigiLocker, click below to fetch the results.
                </p>
                <Button
                  onClick={checkStatus}
                  disabled={checkingStatus}
                  variant="outline"
                  className="w-full"
                >
                  {checkingStatus ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  {checkingStatus ? "Checking..." : "Check Verification Status"}
                </Button>
              </div>
            </div>
          )}

          {/* Verification Complete Indicator */}
          {verificationComplete && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-md">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="font-medium text-green-800">Aadhaar Verified Successfully</span>
              </div>
              {formData.name && (
                <p className="text-sm text-green-700">Name: {formData.name}</p>
              )}
              {formData.verified_address && (
                <p className="text-sm text-green-700 mt-1">Address: {formData.verified_address}</p>
              )}
            </div>
          )}

          {/* Manual Entry / Results Section */}
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium mb-3">
              {verificationComplete ? "Verified Details" : "Manual Entry (Optional)"}
            </h4>
          </div>

          <div>
            <Label>Aadhaar Last 4 Digits</Label>
            <Input
              value={formData.aadhaar_last4}
              onChange={(e) => setFormData({ ...formData, aadhaar_last4: e.target.value.replace(/\D/g, '').slice(0, 4) })}
              placeholder="XXXX"
              maxLength={4}
            />
          </div>

          <div>
            <Label>Name on Aadhaar</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Full name as per Aadhaar"
            />
          </div>

          <div>
            <Label>Verified Address</Label>
            <Textarea
              value={formData.verified_address}
              onChange={(e) => setFormData({ ...formData, verified_address: e.target.value })}
              placeholder="Address as per Aadhaar"
              rows={3}
            />
          </div>

          <div>
            <Label>Address Match Result</Label>
            <Select value={formData.address_match_result} onValueChange={(value) => setFormData({ ...formData, address_match_result: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="exact">Exact Match</SelectItem>
                <SelectItem value="partial">Partial Match</SelectItem>
                <SelectItem value="no_match">No Match</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Aadhaar Status</Label>
            <Select value={formData.aadhaar_status} onValueChange={(value) => setFormData({ ...formData, aadhaar_status: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="valid">Valid</SelectItem>
                <SelectItem value="invalid">Invalid</SelectItem>
                <SelectItem value="not_found">Not Found</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Verification Status</Label>
            <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Remarks</Label>
            <Textarea
              value={formData.remarks}
              onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
              placeholder="Additional notes or observations"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "Saving..." : "Save Verification"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
