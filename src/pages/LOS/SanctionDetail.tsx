import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/Layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Upload, User, MapPin, Edit2, Save, X, FileText, Pencil, History } from "lucide-react";
import { LoadingState } from "@/components/common/LoadingState";
import { format } from "date-fns";
import { toast } from "sonner";
import { extractAadhaarAddress, extractAddressString } from "@/lib/addressUtils";
import DisbursementDashboard from "@/components/LOS/Disbursement/DisbursementDashboard";
import SanctionGenerator from "@/components/LOS/Sanction/SanctionGenerator";
import UploadSignedDocumentDialog from "@/components/LOS/Sanction/UploadSignedDocumentDialog";
import { useOrgContext } from "@/hooks/useOrgContext";
import { ApplicantProfileCard } from "@/components/LOS/ApplicantProfileCard";
import { BankDetailsSection } from "@/components/LOS/BankDetailsSection";
import { ReferralsSection } from "@/components/LOS/ReferralsSection";
import { ApplicationSummary } from "@/components/LOS/ApplicationSummary";
import { AssignmentDialog } from "@/components/LOS/AssignmentDialog";
import { CaseHistoryDialog } from "@/components/LOS/CaseHistoryDialog";
import DocumentUpload from "@/components/LOS/DocumentUpload";
import DocumentDataVerification from "@/components/LOS/DocumentDataVerification";
import ApprovalHistory from "@/components/LOS/Approval/ApprovalHistory";
import VerificationDashboard from "@/components/LOS/VerificationDashboard";

import { STAGE_LABELS, STATUS_COLORS } from "@/constants/loanStages";

const formatAddress = (address: any) => {
  if (!address) return "N/A";
  if (typeof address === "string") return address;
  const parts = [address.line1, address.line2, address.city, address.state, address.pincode].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "N/A";
};

export default function SanctionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { orgId } = useOrgContext();
  const queryClient = useQueryClient();
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [isAssignmentDialogOpen, setIsAssignmentDialogOpen] = useState(false);
  const [isCaseHistoryOpen, setIsCaseHistoryOpen] = useState(false);
  const [isEditingApplicant, setIsEditingApplicant] = useState(false);
  const [isEditingReferrals, setIsEditingReferrals] = useState(false);
  const [applicantData, setApplicantData] = useState({
    gender: "",
    marital_status: "",
    religion: "",
    pan_number: "",
    mobile: "",
    current_address: "",
  });
  const [referralData, setReferralData] = useState({
    professional_ref_name: "",
    professional_ref_mobile: "",
    professional_ref_email: "",
    professional_ref_address: "",
    personal_ref_name: "",
    personal_ref_mobile: "",
    personal_ref_email: "",
    personal_ref_address: "",
  });

  const { data: application, isLoading } = useQuery({
    queryKey: ["sanction-application", id, orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_applications")
        .select(`
          *,
          assigned_to,
          contacts(first_name, last_name, email, phone),
          assigned_profile:profiles!loan_applications_assigned_to_fkey(first_name, last_name),
          approved_by_profile:profiles!loan_applications_approved_by_fkey(first_name, last_name),
          loan_applicants(*),
          loan_verifications(*)
        `)
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: sanction } = useQuery({
    queryKey: ["loan-sanction-detail", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("loan_sanctions")
        .select("*")
        .eq("loan_application_id", id)
        .maybeSingle();
      return data;
    },
    enabled: !!id,
  });

  const { data: documents = [] } = useQuery({
    queryKey: ["loan-documents", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_documents")
        .select("*")
        .eq("loan_application_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const primaryApplicant = application?.loan_applicants?.[0];
  const tenureDays = application?.tenure_days;

  // Initialize applicant data when primaryApplicant changes
  useEffect(() => {
    if (primaryApplicant) {
      const address = primaryApplicant.current_address as Record<string, any> | string | null;
      let addressStr = "";
      if (address) {
        if (typeof address === "string") addressStr = address;
        else if (typeof address === "object") addressStr = [address.line1, address.line2, address.city, address.state, address.pincode].filter(Boolean).join(", ");
      }
      setApplicantData({
        gender: (primaryApplicant.gender as string) || "",
        marital_status: (primaryApplicant.marital_status as string) || "",
        religion: (primaryApplicant.religion as string) || "",
        pan_number: (primaryApplicant.pan_number as string) || "",
        mobile: (primaryApplicant.mobile as string) || "",
        current_address: addressStr,
      });
    }
  }, [
    primaryApplicant?.id,
    primaryApplicant?.gender,
    primaryApplicant?.dob,
    primaryApplicant?.current_address,
    primaryApplicant?.marital_status,
    primaryApplicant?.religion,
    primaryApplicant?.pan_number,
    primaryApplicant?.mobile
  ]);

  // Save applicant mutation
  const saveApplicantMutation = useMutation({
    mutationFn: async (data: typeof applicantData) => {
      if (!primaryApplicant?.id) throw new Error("No applicant to update");
      const updateData: Record<string, any> = {};
      if (data.gender) updateData.gender = data.gender;
      if (data.marital_status) updateData.marital_status = data.marital_status;
      if (data.religion) updateData.religion = data.religion;
      if (data.pan_number) updateData.pan_number = data.pan_number;
      if (data.mobile) updateData.mobile = data.mobile;
      if (data.current_address) updateData.current_address = { line1: data.current_address };
      const { error } = await supabase
        .from("loan_applicants")
        .update(updateData)
        .eq("id", primaryApplicant.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Applicant details updated successfully");
      setIsEditingApplicant(false);
      queryClient.invalidateQueries({ queryKey: ["sanction-application", id, orgId] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update applicant details");
    },
  });

  // Verified document data
  const getParsedData = (docType: string) => {
    const doc = documents.find((d) => d.document_type === docType);
    return doc?.ocr_data as Record<string, any> | null;
  };

  const verifications = (application as any)?.loan_verifications || [];
  const getVerificationData = (verType: string) => {
    const ver = verifications.find((v: any) => v.verification_type === verType);
    return ver?.response_data as Record<string, any> | null;
  };

  const panDocData = getParsedData("pan_card");
  const panVerData = getVerificationData("pan");
  const panData: Record<string, any> | null = panDocData || panVerData
    ? {
        ...panVerData,
        ...panDocData,
        name: panDocData?.name || panVerData?.name_on_pan || panVerData?.name,
        pan_number: panDocData?.pan_number || (panVerData as any)?.pan_number || (panVerData as any)?.pan,
        father_name: panDocData?.father_name || panVerData?.father_name,
        dob: panDocData?.dob || panVerData?.dob,
        status: panDocData?.status || (panVerData as any)?.pan_status || (panVerData as any)?.status,
      }
    : null;

  const aadhaarFrontData = getParsedData("aadhaar_front");
  const aadhaarBackData = getParsedData("aadhaar_back");
  const aadhaarDocData = (aadhaarFrontData || aadhaarBackData) ? {
    ...aadhaarBackData,
    ...aadhaarFrontData,
    address: extractAadhaarAddress(aadhaarBackData, aadhaarFrontData),
  } : null;
  const aadhaarVerData = getVerificationData("aadhaar");
  const aadhaarData: Record<string, any> | null = aadhaarDocData || aadhaarVerData
    ? {
        ...aadhaarVerData,
        ...aadhaarDocData,
        address: extractAddressString(aadhaarDocData?.address) || aadhaarVerData?.verified_address || extractAddressString(aadhaarVerData?.address),
      }
    : null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <LoadingState message="Loading sanction details..." />
      </DashboardLayout>
    );
  }

  if (!application) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <h3 className="text-lg font-semibold">Application not found</h3>
        </div>
      </DashboardLayout>
    );
  }

  const canUploadSigned = sanction?.documents_emailed_at && sanction?.status !== 'signed';

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/los/sanctions")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-foreground">
                  {application.loan_id || application.application_number}
                </h1>
                <Badge className={STATUS_COLORS[application.status]}>
                  {application.status.replace("_", " ").toUpperCase()}
                </Badge>
                <Badge variant="outline">
                  {STAGE_LABELS[application.current_stage] || application.current_stage}
                </Badge>
                {sanction?.status === 'signed' && (
                  <Badge className="bg-green-500">Documents Signed</Badge>
                )}
              </div>
              <p className="text-muted-foreground mt-1">
                {application.loan_id && (
                  <span className="mr-2">Application: {application.application_number} •</span>
                )}
                Created {format(new Date(application.created_at), "MMM dd, yyyy")}
                {application.approved_by_profile && (
                  <>
                    {" • "}
                    <span className="text-green-600 font-medium">
                      Approved by {(application.approved_by_profile as any).first_name} {(application.approved_by_profile as any).last_name || ""}
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canUploadSigned && (
              <Button variant="outline" onClick={() => setUploadDialogOpen(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Upload Signed Document
              </Button>
            )}
            <SanctionGenerator applicationId={application.id} orgId={orgId || ""} />
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-2 md:grid-cols-5">
          <Card className="p-3">
            <div className="text-xs text-muted-foreground">Requested Amount</div>
            <div className="text-lg font-bold">{formatCurrency(application.requested_amount)}</div>
          </Card>
          <Card className="p-3">
            <div className="text-xs text-muted-foreground">Tenure</div>
            <div className="text-lg font-bold">{tenureDays} days</div>
          </Card>
          <Card className="p-3">
            <div className="text-xs text-muted-foreground">Applicant</div>
            <div className="text-sm font-medium truncate">
              {primaryApplicant
                ? `${primaryApplicant.first_name} ${primaryApplicant.last_name || ""}`.trim()
                : application.contacts
                ? `${(application.contacts as any).first_name} ${(application.contacts as any).last_name || ""}`.trim()
                : "N/A"}
            </div>
          </Card>
          <Card
            className="p-3 cursor-pointer hover:bg-muted/50 transition-colors group"
            onClick={() => setIsAssignmentDialogOpen(true)}
          >
            <div className="text-xs text-muted-foreground flex items-center justify-between">
              <span>Assigned To</span>
              <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="text-sm font-medium truncate">
              {(application as any).assigned_profile
                ? `${(application as any).assigned_profile.first_name} ${(application as any).assigned_profile.last_name || ""}`
                : "Unassigned"}
            </div>
          </Card>
          <Card className="p-3">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              Location
            </div>
            {application.latitude && application.longitude ? (
              <div className="text-xs font-mono text-muted-foreground">
                {Number(application.latitude).toFixed(4)}, {Number(application.longitude).toFixed(4)}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">Not captured</div>
            )}
          </Card>
          <Card
            className="p-3 cursor-pointer hover:bg-muted/50 transition-colors group"
            onClick={() => setIsCaseHistoryOpen(true)}
          >
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <History className="h-3 w-3" />
              Case History
            </div>
            <div className="text-sm font-medium text-primary">
              View Timeline
            </div>
          </Card>
        </div>

        {/* Applicant Profile with Documents */}
        {primaryApplicant && orgId && (
          <ApplicantProfileCard
            applicationId={id!}
            applicantId={primaryApplicant.id as string}
            orgId={orgId}
            applicant={primaryApplicant}
            applicantName={`${primaryApplicant.first_name} ${primaryApplicant.middle_name || ''} ${primaryApplicant.last_name || ''}`.trim()}
            panNumber={primaryApplicant.pan_number as string}
            aadhaarNumber={primaryApplicant.aadhaar_number as string}
            mobile={primaryApplicant.mobile as string}
            dateOfBirth={primaryApplicant.dob && !isNaN(new Date(primaryApplicant.dob as string).getTime())
              ? format(new Date(primaryApplicant.dob as string), "MMM dd, yyyy")
              : undefined}
            gender={primaryApplicant.gender as string}
          />
        )}

        {/* Application Details Section */}
        <div className="space-y-4">
          {/* Applicant Details Card - Editable */}
          <Card>
            <CardHeader className="py-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <User className="h-4 w-4" />
                  Applicant Details
                </CardTitle>
                {primaryApplicant && (
                  <div className="flex gap-2">
                    {isEditingApplicant ? (
                      <>
                        <Button variant="outline" size="sm" onClick={() => setIsEditingApplicant(false)}>
                          <X className="h-3 w-3 mr-1" />
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => saveApplicantMutation.mutate(applicantData)}
                          disabled={saveApplicantMutation.isPending}
                        >
                          <Save className="h-3 w-3 mr-1" />
                          {saveApplicantMutation.isPending ? "Saving..." : "Save"}
                        </Button>
                      </>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => setIsEditingApplicant(true)}>
                        <Edit2 className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              {primaryApplicant ? (
                isEditingApplicant ? (
                  <div className="grid gap-4 md:grid-cols-4">
                    <div>
                      <Label className="text-xs">Full Name</Label>
                      <p className="text-sm mt-1">
                        {primaryApplicant.first_name} {primaryApplicant.middle_name || ""}{" "}
                        {primaryApplicant.last_name || ""}
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs">Date of Birth</Label>
                      <p className="text-sm mt-1">
                        {primaryApplicant.dob && !isNaN(new Date(primaryApplicant.dob as string).getTime())
                          ? format(new Date(primaryApplicant.dob as string), "MMM dd, yyyy")
                          : "N/A"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs">Gender</Label>
                      <Select
                        value={applicantData.gender}
                        onValueChange={(value) => setApplicantData({ ...applicantData, gender: value })}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Marital Status</Label>
                      <Select
                        value={applicantData.marital_status}
                        onValueChange={(value) => setApplicantData({ ...applicantData, marital_status: value })}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="single">Single</SelectItem>
                          <SelectItem value="married">Married</SelectItem>
                          <SelectItem value="divorced">Divorced</SelectItem>
                          <SelectItem value="widowed">Widowed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Religion</Label>
                      <Select
                        value={applicantData.religion}
                        onValueChange={(value) => setApplicantData({ ...applicantData, religion: value })}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select religion" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="hindu">Hindu</SelectItem>
                          <SelectItem value="muslim">Muslim</SelectItem>
                          <SelectItem value="christian">Christian</SelectItem>
                          <SelectItem value="sikh">Sikh</SelectItem>
                          <SelectItem value="buddhist">Buddhist</SelectItem>
                          <SelectItem value="jain">Jain</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">PAN Number</Label>
                      <Input
                        value={applicantData.pan_number}
                        onChange={(e) => setApplicantData({ ...applicantData, pan_number: e.target.value.toUpperCase() })}
                        placeholder="ABCDE1234F"
                        className="mt-1 font-mono"
                        maxLength={10}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Mobile</Label>
                      <Input
                        value={applicantData.mobile}
                        onChange={(e) => setApplicantData({ ...applicantData, mobile: e.target.value })}
                        placeholder="9876543210"
                        className="mt-1"
                        maxLength={10}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label className="text-xs">Current Address</Label>
                      <Input
                        value={applicantData.current_address}
                        onChange={(e) => setApplicantData({ ...applicantData, current_address: e.target.value })}
                        placeholder="Enter full address"
                        className="mt-1"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-x-4 gap-y-2 md:grid-cols-4">
                    <div>
                      <label className="text-xs text-muted-foreground">Full Name</label>
                      <p className="text-sm">
                        {primaryApplicant.first_name} {primaryApplicant.middle_name || ""}{" "}
                        {primaryApplicant.last_name || ""}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Date of Birth</label>
                      <p className="text-sm">
                        {primaryApplicant.dob && !isNaN(new Date(primaryApplicant.dob as string).getTime())
                          ? format(new Date(primaryApplicant.dob as string), "MMM dd, yyyy")
                          : "N/A"}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Gender</label>
                      <p className="text-sm">{(primaryApplicant.gender as string) || "N/A"}</p>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Marital Status</label>
                      <p className="text-sm">{(primaryApplicant.marital_status as string) || "N/A"}</p>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Religion</label>
                      <p className="text-sm capitalize">{(primaryApplicant.religion as string) || "N/A"}</p>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">PAN Number</label>
                      <p className="text-sm font-mono">{(primaryApplicant.pan_number as string) || "N/A"}</p>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Mobile</label>
                      <p className="text-sm">{(primaryApplicant.mobile as string) || "N/A"}</p>
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-xs text-muted-foreground">Current Address</label>
                      <p className="text-sm">{formatAddress(primaryApplicant.current_address)}</p>
                    </div>
                  </div>
                )
              ) : (
                <p className="text-sm text-muted-foreground">No applicant details available.</p>
              )}

              {/* Referrals Section */}
              <ReferralsSection
                primaryApplicant={primaryApplicant}
                applicationId={id!}
                orgId={orgId!}
                isEditingReferrals={isEditingReferrals}
                setIsEditingReferrals={setIsEditingReferrals}
                referralData={referralData}
                setReferralData={setReferralData}
                queryClient={queryClient}
              />
            </CardContent>
          </Card>

          {/* Bank Details Section */}
          <BankDetailsSection
            applicationId={application.id}
            orgId={orgId!}
            applicantId={primaryApplicant?.id}
          />

          {/* Verification Dashboard - PAN, Aadhaar, Bank, Employment, etc. */}
          <VerificationDashboard
            applicationId={application.id}
            orgId={orgId!}
          />

          {/* Verified Document Data */}
          {(panData || aadhaarData) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Verified Document Data
                  <Badge className="bg-green-500/10 text-green-600 border-green-500/20">AI Parsed</Badge>
                </CardTitle>
                <CardDescription>Information extracted from uploaded documents</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 md:grid-cols-2">
                  {panData && !panData.parse_error && (
                    <div className="space-y-3 p-4 rounded-lg bg-muted/50">
                      <h4 className="font-medium text-sm flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        PAN Card
                      </h4>
                      <div className="grid gap-2 text-sm">
                        {panData.name && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Name</span>
                            <span className="font-medium">{panData.name}</span>
                          </div>
                        )}
                        {panData.pan_number && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">PAN</span>
                            <span className="font-mono font-medium">{panData.pan_number}</span>
                          </div>
                        )}
                        {panData.father_name && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Father's Name</span>
                            <span className="font-medium">{panData.father_name}</span>
                          </div>
                        )}
                        {panData.dob && !isNaN(new Date(panData.dob).getTime()) && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">DOB</span>
                            <span className="font-medium">{format(new Date(panData.dob), "MMM dd, yyyy")}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {aadhaarData && !aadhaarData.parse_error && (
                    <div className="space-y-3 p-4 rounded-lg bg-muted/50">
                      <h4 className="font-medium text-sm flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Aadhaar Card
                      </h4>
                      <div className="grid gap-2 text-sm">
                        {aadhaarData.name && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Name</span>
                            <span className="font-medium">{aadhaarData.name}</span>
                          </div>
                        )}
                        {aadhaarData.aadhaar_number && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Aadhaar</span>
                            <span className="font-mono font-medium">{aadhaarData.aadhaar_number}</span>
                          </div>
                        )}
                        {aadhaarData.gender && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Gender</span>
                            <span className="font-medium">{aadhaarData.gender}</span>
                          </div>
                        )}
                        {aadhaarData.dob && !isNaN(new Date(aadhaarData.dob).getTime()) && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">DOB</span>
                            <span className="font-medium">{format(new Date(aadhaarData.dob), "MMM dd, yyyy")}</span>
                          </div>
                        )}
                        {aadhaarData.address && (
                          <div className="flex flex-col gap-1">
                            <span className="text-muted-foreground">Address</span>
                            <span className="font-medium text-xs">{aadhaarData.address}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Document Data Verification */}
          <DocumentDataVerification applicationId={application.id} />

          {/* Documents Section */}
          <DocumentUpload applicationId={application.id} orgId={orgId} applicant={primaryApplicant} />

          {/* Approval History */}
          <ApprovalHistory applicationId={id!} />

          {/* Application Summary */}
          <ApplicationSummary applicationId={id!} orgId={orgId!} />

          {/* Sanction Content - Loan Summary & Documents */}
          <DisbursementDashboard applicationId={application.id} />
        </div>
      </div>

      {sanction && (
        <UploadSignedDocumentDialog
          open={uploadDialogOpen}
          onOpenChange={setUploadDialogOpen}
          applicationId={application.id}
          sanctionId={sanction.id}
          orgId={orgId!}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["loan-sanction-detail", id] });
          }}
        />
      )}

      {/* Assignment Dialog */}
      <AssignmentDialog
        open={isAssignmentDialogOpen}
        onOpenChange={setIsAssignmentDialogOpen}
        applicationId={id!}
        currentAssigneeId={(application as any).assigned_to || null}
        currentAssigneeName={
          (application as any).assigned_profile
            ? `${(application as any).assigned_profile.first_name} ${(application as any).assigned_profile.last_name || ""}`.trim()
            : null
        }
        orgId={orgId!}
      />

      {/* Case History Dialog */}
      {primaryApplicant && (
        <CaseHistoryDialog
          open={isCaseHistoryOpen}
          onOpenChange={setIsCaseHistoryOpen}
          applicationId={id!}
          orgId={orgId!}
          applicantName={`${primaryApplicant.first_name} ${primaryApplicant.middle_name || ''} ${primaryApplicant.last_name || ''}`.trim()}
          applicantPhone={primaryApplicant.mobile as string}
          applicantEmail={primaryApplicant.email as string}
        />
      )}
    </DashboardLayout>
  );
}
