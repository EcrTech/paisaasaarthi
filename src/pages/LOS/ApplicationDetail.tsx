import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrgContext } from "@/hooks/useOrgContext";
import { useDecryptedApplicant } from "@/hooks/useDecryptedApplicant";
import DashboardLayout from "@/components/Layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, User, FileText, Calculator, FileCheck, XCircle, CreditCard, CheckCircle, MapPin, Edit2, Save, X, RefreshCw, Loader2, Sparkles, Plus, Pencil, Trash2, History, Lock, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { extractAadhaarAddress, extractAddressString } from "@/lib/addressUtils";
import { LoadingState } from "@/components/common/LoadingState";
import { format } from "date-fns";
import DocumentUpload from "@/components/LOS/DocumentUpload";
import DocumentDataVerification from "@/components/LOS/DocumentDataVerification";
import IncomeSummary from "@/components/LOS/IncomeSummary";
import AssessmentDashboard from "@/components/LOS/Assessment/AssessmentDashboard";
import ApprovalActionDialog from "@/components/LOS/Approval/ApprovalActionDialog";
import ApprovalHistory from "@/components/LOS/Approval/ApprovalHistory";
import DisbursementForm from "@/components/LOS/Disbursement/DisbursementForm";
import DisbursementStatus from "@/components/LOS/Disbursement/DisbursementStatus";
import { ApplicantProfileCard } from "@/components/LOS/ApplicantProfileCard";
import { BankDetailsSection } from "@/components/LOS/BankDetailsSection";
import { ReferralsSection } from "@/components/LOS/ReferralsSection";
import { ApplicationSummary } from "@/components/LOS/ApplicationSummary";
import { AssignmentDialog } from "@/components/LOS/AssignmentDialog";
import { CaseHistoryDialog } from "@/components/LOS/CaseHistoryDialog";
import { MandateStatusCard } from "@/components/LOS/Mandate/MandateStatusCard";
import { RepeatLoanDialog } from "@/components/LOS/RepeatLoanDialog";
import VerificationDashboard from "@/components/LOS/VerificationDashboard";

import { STAGE_LABELS, STATUS_COLORS } from "@/constants/loanStages";


export default function ApplicationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isReviewMode = searchParams.get("mode") === "review";
  const { orgId, isLoading: isOrgLoading } = useOrgContext();
  const [approvalAction, setApprovalAction] = useState<"approve" | "reject" | null>(null);
  const [isAssignmentDialogOpen, setIsAssignmentDialogOpen] = useState(false);
  const [isCaseHistoryOpen, setIsCaseHistoryOpen] = useState(false);
  const [isEditingReferrals, setIsEditingReferrals] = useState(false);
  const [isEditingApplicant, setIsEditingApplicant] = useState(false);
  const [showRepeatLoanDialog, setShowRepeatLoanDialog] = useState(false);
  const [applicantData, setApplicantData] = useState({
    gender: "",
    marital_status: "",
    religion: "",
    pan_number: "",
    mobile: "",
    email: "",
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
  const queryClient = useQueryClient();

  const { data: userData } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const response = await supabase.auth.getUser();
      return response.data;
    },
  });
  
  const user = userData?.user;

  const { data: application, isLoading } = useQuery({
    queryKey: ["loan-application", id, orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_applications")
        .select(`
          *,
          assigned_to,
          contacts(first_name, last_name, email, phone),
          assigned_profile:profiles!loan_applications_assigned_to_fkey(first_name, last_name),
          loan_applicants(*),
          loan_verifications(*)
        `)
        .eq("id", id)
        .eq("org_id", orgId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!id && !!orgId,
  });

  // Fetch decrypted applicant PII (mobile, email, pan, aadhaar, bank details)
  const { data: decryptedApplicant } = useDecryptedApplicant(id);

  // Fetch parsed document data
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
    enabled: !!id && !!orgId,
  });

  // Extract applicant data from OCR documents
  const extractApplicantFromOCR = () => {
    const allDocs = documents || [];
    
    // Get data from different document types
    const salarySlip = allDocs.find(d => d.document_type?.includes('salary_slip') && d.ocr_data);
    const form16 = allDocs.find(d => d.document_type?.includes('form_16') && d.ocr_data);
    const itr = allDocs.find(d => d.document_type?.includes('itr') && d.ocr_data);
    const bankStatement = allDocs.find(d => d.document_type === 'bank_statement' && d.ocr_data);
    const employeeId = allDocs.find(d => d.document_type === 'employee_id' && d.ocr_data);
    const panCard = allDocs.find(d => d.document_type === 'pan_card' && d.ocr_data);
    const aadhaarCard = allDocs.find(d => (d.document_type === 'aadhaar_card' || d.document_type === 'aadhar_card') && d.ocr_data);
    
    // Extract name from various sources (prioritize verified documents)
    const extractedName = 
      (panCard?.ocr_data as any)?.name ||
      (aadhaarCard?.ocr_data as any)?.name ||
      (salarySlip?.ocr_data as any)?.employee_name ||
      (form16?.ocr_data as any)?.employee_name ||
      (itr?.ocr_data as any)?.name ||
      (bankStatement?.ocr_data as any)?.account_holder_name ||
      (employeeId?.ocr_data as any)?.employee_name;
    
    // Parse name into parts
    const nameStr = typeof extractedName === 'string' ? extractedName : '';
    const nameParts = nameStr.trim().split(/\s+/).filter(Boolean);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
    const middleName = nameParts.length > 2 ? nameParts.slice(1, -1).join(' ') : '';
    
    // Extract PAN number
    const panNumber = (panCard?.ocr_data as any)?.pan_number || (panCard?.ocr_data as any)?.pan;
    
    // Extract DOB
    const dob = (panCard?.ocr_data as any)?.dob || (aadhaarCard?.ocr_data as any)?.dob;
    
    // Extract gender
    const gender = (aadhaarCard?.ocr_data as any)?.gender;
    
    // Extract father's name
    const fatherName = (panCard?.ocr_data as any)?.father_name || (aadhaarCard?.ocr_data as any)?.father_name;
    
    // Extract mobile from employeeId or other sources
    const mobile = (employeeId?.ocr_data as any)?.phone?.replace(/[^0-9]/g, '').slice(-10) || '';
    
    // Extract email
    const email = (employeeId?.ocr_data as any)?.email;
    
    // Extract address from Aadhaar
    const address = extractAddressString((aadhaarCard?.ocr_data as any)?.address);
    
    return {
      firstName,
      middleName,
      lastName,
      panNumber,
      dob,
      gender,
      fatherName,
      mobile,
      email,
      address,
      hasData: !!firstName
    };
  };

  // Mutation to create applicant from OCR data
  const createApplicantFromOCRMutation = useMutation({
    mutationFn: async () => {
      const ocrData = extractApplicantFromOCR();
      
      if (!ocrData.firstName) {
        throw new Error("No name found in parsed documents");
      }
      
      // Parse and validate DOB
      let parsedDob: string | null = null;
      if (ocrData.dob) {
        const dobDate = new Date(ocrData.dob);
        if (!isNaN(dobDate.getTime())) {
          parsedDob = dobDate.toISOString().split('T')[0];
        }
      }
      
      // Use a placeholder DOB if not found (required field)
      const finalDob = parsedDob || '1990-01-01';
      
      // Mobile is required - use placeholder if not found
      const finalMobile = ocrData.mobile || '0000000000';
      
      const applicantData = {
        loan_application_id: id,
        applicant_type: 'primary',
        first_name: ocrData.firstName,
        middle_name: ocrData.middleName || null,
        last_name: ocrData.lastName || null,
        father_name: ocrData.fatherName || null,
        pan_number: ocrData.panNumber || null,
        dob: finalDob,
        gender: ocrData.gender || null,
        mobile: finalMobile,
        email: ocrData.email || null,
        current_address: ocrData.address ? { line1: ocrData.address } : null,
      };
      
      const { data, error } = await supabase
        .from("loan_applicants")
        .insert(applicantData)
        .select()
        .single();
        
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Applicant profile created from document data");
      queryClient.invalidateQueries({ queryKey: ["loan-application", id, orgId] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create applicant profile");
    },
  });

  // Mutation to create applicant from contact data (fallback when no applicant record exists)
  const createApplicantFromContactMutation = useMutation({
    mutationFn: async () => {
      if (!application?.contacts) {
        throw new Error("No contact data available");
      }
      
      const contactData = application.contacts as any;
      const applicantData = {
        loan_application_id: id,
        applicant_type: 'primary',
        first_name: contactData.first_name || 'Unknown',
        last_name: contactData.last_name || null,
        mobile: contactData.phone || '0000000000',
        email: contactData.email || null,
        dob: '1990-01-01', // Placeholder - required field
      };
      
      const { data, error } = await supabase
        .from("loan_applicants")
        .insert(applicantData)
        .select()
        .single();
        
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Applicant profile created from contact data");
      queryClient.invalidateQueries({ queryKey: ["loan-application", id, orgId] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create applicant profile");
    },
  });

  // Mutation to save applicant details
  const saveApplicantMutation = useMutation({
    mutationFn: async (data: typeof applicantData) => {
      if (!primaryApplicant?.id) {
        throw new Error("No applicant to update");
      }

      const updateData: Record<string, any> = {};
      if (data.gender) updateData.gender = data.gender;
      if (data.marital_status) updateData.marital_status = data.marital_status;
      if (data.religion) updateData.religion = data.religion;
      if (data.pan_number) updateData.pan_number = data.pan_number;
      if (data.mobile) updateData.mobile = data.mobile;
      if (data.email) updateData.email = data.email;
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
      queryClient.invalidateQueries({ queryKey: ["loan-application", id, orgId] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update applicant details");
    },
  });


  // Mutation to start assessment (advance from application_login to credit_assessment)
  const startAssessmentMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("transition_loan_stage", {
        p_application_id: application?.id,
        p_expected_current_stage: "application",
        p_new_stage: "evaluation",
      });
      if (error) throw error;
      if (!data) throw new Error("Stage has already changed. Please refresh the page.");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loan-application", id, orgId] });
      toast.success("Application moved to Credit Assessment");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to start assessment");
    },
  });

  // Mutation to convert lead to application (override credit check rejection)
  const convertLeadMutation = useMutation({
    mutationFn: async () => {
      // Generate a proper application number using the DB sequence
      const now = new Date();
      const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
      const { data: seqVal, error: seqError } = await supabase.rpc("nextval_text", {
        seq_name: "loan_application_number_seq",
      });
      if (seqError) throw seqError;
      const applicationNumber = `LA-${yearMonth}-${String(seqVal).padStart(5, "0")}`;

      // Update application: set proper number and stage (status auto-synced via trigger)
      const { error: updateError } = await supabase
        .from("loan_applications")
        .update({
          application_number: applicationNumber,
          current_stage: "application",
          updated_at: new Date().toISOString(),
        })
        .eq("id", application?.id)
        .eq("current_stage", "lead"); // guard against race conditions

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loan-application", id, orgId] });
      queryClient.invalidateQueries({ queryKey: ["loan-applications"] });
      toast.success("Lead converted to application successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to convert lead to application");
    },
  });

  // Mutation to convert a draft application to active
  const convertDraftMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-convert-application", {
        body: { applicationId: application?.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["loan-application", id, orgId] });
      toast.success(`Application converted: ${data.applicationNumber}`);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to convert application");
    },
  });

  const ocrApplicantData = extractApplicantFromOCR();


  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatAddress = (address: any) => {
    if (!address) return "N/A";
    if (typeof address === "string") return address;
    
    const parts = [
      address.line1,
      address.line2,
      address.city,
      address.state,
      address.pincode
    ].filter(Boolean);
    
    return parts.length > 0 ? parts.join(", ") : "N/A";
  };

  // Get parsed data from documents
  const getParsedData = (docType: string) => {
    const doc = documents.find((d) => d.document_type === docType);
    return doc?.ocr_data as Record<string, any> | null;
  };

  // Get verification data from application (loaded with loan_verifications relation)
  const verifications = (application as any)?.loan_verifications || [];
  const getVerificationData = (verType: string) => {
    const ver = verifications.find((v: any) => v.verification_type === verType);
    return ver?.response_data as Record<string, any> | null;
  };

  // Merge document OCR data with verification data
  const panDocData = getParsedData("pan_card");
  const panVerData = getVerificationData("pan");
  const panData: Record<string, any> | null = panDocData || panVerData
    ? {
        ...panVerData,
        ...panDocData,
        // Normalize common PAN fields from different sources
        name: panDocData?.name || panVerData?.name_on_pan || panVerData?.name,
        pan_number:
          panDocData?.pan_number ||
          (panVerData as any)?.pan_number ||
          (panVerData as any)?.pan,
        father_name: panDocData?.father_name || panVerData?.father_name,
        dob: panDocData?.dob || panVerData?.dob,
        status:
          panDocData?.status ||
          (panVerData as any)?.pan_status ||
          (panVerData as any)?.status,
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
  const aadhaarData: Record<string, any> | null = aadhaarDocData || aadhaarVerData ? { 
    ...aadhaarVerData, 
    ...aadhaarDocData,
    address:
      extractAddressString(aadhaarDocData?.address) ||
      aadhaarVerData?.verified_address ||
      extractAddressString(aadhaarVerData?.address)
  } : null;

  const rawApplicant = application?.loan_applicants?.[0];
  // Overlay decrypted PII fields on applicant data
  const primaryApplicant = rawApplicant && decryptedApplicant ? {
    ...rawApplicant,
    mobile: decryptedApplicant.mobile || rawApplicant.mobile,
    email: decryptedApplicant.email || rawApplicant.email,
    pan_number: decryptedApplicant.pan_number || rawApplicant.pan_number,
    aadhaar_number: decryptedApplicant.aadhaar_number || rawApplicant.aadhaar_number,
    bank_account_number: decryptedApplicant.bank_account_number || rawApplicant.bank_account_number,
    bank_ifsc_code: decryptedApplicant.bank_ifsc_code || rawApplicant.bank_ifsc_code,
  } : rawApplicant;
  const tenureDays = application?.tenure_days;

  // Initialize applicant data when primaryApplicant changes
  // Use specific field dependencies to ensure state updates on refetch after document re-parse
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
        email: (primaryApplicant.email as string) || "",
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
    primaryApplicant?.mobile,
    primaryApplicant?.email
  ]);

  // Determine if application is locked (disbursed without active repeat loan)
  const isLocked = ["disbursed", "closed"].includes(application?.current_stage);

  if (isLoading || isOrgLoading) {
    return (
      <DashboardLayout>
        <LoadingState message="Loading application..." />
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold text-foreground">
                  {application.loan_id || application.application_number}
                </h1>
                <Badge className={STATUS_COLORS[application.status]}>
                  {application.status.replace("_", " ").toUpperCase()}
                </Badge>
                <Badge variant="outline">
                  {STAGE_LABELS[application.current_stage] || application.current_stage}
                </Badge>
                {isLocked && (
                  <Badge variant="secondary" className="gap-1">
                    <Lock className="h-3 w-3" />
                    Locked
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground mt-1">
                {application.loan_id && (
                  <span className="mr-2">Application: {application.application_number} •</span>
                )}
                Created {format(new Date(application.created_at), "MMM dd, yyyy")}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {/* Convert Draft Button - visible only for draft/new applications */}
            {(application.status === "draft" || application.status === "new") && (
              <Button onClick={() => convertDraftMutation.mutate()} disabled={convertDraftMutation.isPending}>
                {convertDraftMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-2" />
                )}
                Start Processing
              </Button>
            )}
            {/* Repeat Loan Button - visible only for disbursed applications */}
            {application.current_stage === "disbursed" && application.contact_id && (
              <Button variant="outline" onClick={() => setShowRepeatLoanDialog(true)}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Repeat Loan
              </Button>
            )}
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
                ? `${application.contacts.first_name} ${application.contacts.last_name || ""}`.trim()
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
        {primaryApplicant && (
          <ApplicantProfileCard
            applicationId={id!}
            applicantId={primaryApplicant.id as string}
            orgId={orgId!}
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
          {/* Applicant Details Card */}
          <Card>
            <CardHeader className="py-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <User className="h-4 w-4" />
                  Applicant Details
                </CardTitle>
                {primaryApplicant && !isLocked && (
                  <div className="flex gap-2">
                    {isEditingApplicant ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setIsEditingApplicant(false)}
                        >
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
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsEditingApplicant(true)}
                      >
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
                    <div>
                      <Label className="text-xs">Email</Label>
                      <Input
                        value={applicantData.email}
                        onChange={(e) => setApplicantData({ ...applicantData, email: e.target.value })}
                        placeholder="email@example.com"
                        className="mt-1"
                        type="email"
                      />
                    </div>
                    <div className="md:col-span-3">
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
                    <div>
                      <label className="text-xs text-muted-foreground">Email</label>
                      <p className="text-sm truncate">{(primaryApplicant.email as string) || "N/A"}</p>
                    </div>
                    <div className="md:col-span-3">
                      <label className="text-xs text-muted-foreground">Current Address</label>
                      <p className="text-sm">{formatAddress(primaryApplicant.current_address)}</p>
                    </div>
                  </div>
                )
              ) : ocrApplicantData.hasData ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg border border-dashed">
                    <Sparkles className="h-5 w-5 text-primary" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Applicant data found in documents</p>
                      <p className="text-xs text-muted-foreground">
                        Name: {ocrApplicantData.firstName} {ocrApplicantData.middleName} {ocrApplicantData.lastName}
                        {ocrApplicantData.panNumber && ` • PAN: ${ocrApplicantData.panNumber}`}
                      </p>
                    </div>
                    <Button 
                      onClick={() => createApplicantFromOCRMutation.mutate()}
                      disabled={createApplicantFromOCRMutation.isPending}
                      size="sm"
                    >
                      {createApplicantFromOCRMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Create Applicant Profile
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ) : application?.contacts ? (
                // Fallback: Show contact data with option to create applicant
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                    <User className="h-5 w-5 text-amber-600" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Contact data available</p>
                      <p className="text-xs text-muted-foreground">
                        Name: {(application.contacts as any).first_name} {(application.contacts as any).last_name || ''}
                        {(application.contacts as any).phone && ` • Phone: ${(application.contacts as any).phone}`}
                        {(application.contacts as any).email && ` • Email: ${(application.contacts as any).email}`}
                      </p>
                    </div>
                    <Button 
                      onClick={() => createApplicantFromContactMutation.mutate()}
                      disabled={createApplicantFromContactMutation.isPending}
                      size="sm"
                    >
                      {createApplicantFromContactMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4 mr-2" />
                          Create Applicant Profile
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No applicant details available. Upload documents to auto-fill applicant information.</p>
              )}

              {/* Referrals Section - Always visible with edit capability */}
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

          {/* Parsed Document Data Card */}
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
                  {/* PAN Card Data */}
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
                            <span className="font-medium">
                              {format(new Date(panData.dob), "MMM dd, yyyy")}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Aadhaar Card Data */}
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
                            <span className="font-medium">
                              {format(new Date(aadhaarData.dob), "MMM dd, yyyy")}
                            </span>
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

          {/* Convert Lead to Application - visible for lead stage */}
          {application.current_stage === "lead" && (
            <Card className="border-amber-200 bg-amber-50/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-amber-600" />
                  Convert Lead to Application
                </CardTitle>
                <CardDescription>
                  This lead was created from the referral form but did not pass the automated credit check.
                  Convert it to a full application to manually evaluate the credit profile.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => convertLeadMutation.mutate()}
                  disabled={convertLeadMutation.isPending}
                  className="bg-amber-600 hover:bg-amber-700"
                >
                  {convertLeadMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <UserPlus className="h-4 w-4 mr-2" />
                  )}
                  Convert to Application
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Start Assessment - shown when at application stage */}
          {application.current_stage === "application" && (
            <Card>
              <CardHeader>
                <CardTitle>Start Assessment</CardTitle>
                <CardDescription>
                  Move this application to Evaluation to begin the review process
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => startAssessmentMutation.mutate()}
                  disabled={startAssessmentMutation.isPending}
                >
                  {startAssessmentMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Calculator className="h-4 w-4 mr-2" />
                  )}
                  Start Evaluation
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Income & Assessment - shown until approval */}
          {!["approved", "disbursement", "disbursed", "closed"].includes(application.current_stage) && (
            <>
              <IncomeSummary applicationId={application.id} orgId={orgId} />
              <AssessmentDashboard applicationId={application.id} orgId={orgId} />
            </>
          )}

          {/* Approval Actions - Only shown when stage is evaluation (pending approval) */}
          {application.current_stage === "evaluation" && (
            <Card>
              <CardHeader>
                <CardTitle>Approval Actions</CardTitle>
                <CardDescription>
                  Review and take action on this loan application
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4">
                  <Button
                    variant="default"
                    onClick={() => setApprovalAction("approve")}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approve Application
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => setApprovalAction("reject")}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject Application
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Approval History - shown for evaluation stage and beyond */}
          {["evaluation", "approved", "disbursement", "disbursed", "closed"].includes(application.current_stage) && (
            <ApprovalHistory applicationId={id!} />
          )}

          {/* Full Application Summary for approved stages */}
          {["approved", "disbursement", "disbursed"].includes(application.current_stage) && (
            <ApplicationSummary applicationId={id!} orgId={orgId!} />
          )}

          {/* Disbursement Section */}
          {application.current_stage === "disbursement" && (
            <DisbursementForm applicationId={id!} />
          )}

          {/* Disbursement Status - always visible for disbursed applications */}
          {application.current_stage === "disbursed" && (
            <DisbursementStatus applicationId={id!} />
          )}

          {/* NACH / eMandate Status - visible for disbursement and disbursed */}
          {["disbursement", "disbursed"].includes(application.current_stage) && (
            <MandateStatusCard applicationId={id!} />
          )}
        </div>
      </div>

      {approvalAction && orgId && user && (
        <ApprovalActionDialog
          open={!!approvalAction}
          onOpenChange={() => setApprovalAction(null)}
          applicationId={id!}
          action={approvalAction}
          orgId={orgId}
          userId={user.id}
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

      {/* Repeat Loan Dialog */}
      {application.contact_id && (
        <RepeatLoanDialog
          open={showRepeatLoanDialog}
          onOpenChange={setShowRepeatLoanDialog}
          applicationId={id!}
          orgId={orgId!}
          contactId={application.contact_id}
          previousAmount={application.requested_amount || 0}
          previousTenure={application.tenure_days || 30}
        />
      )}
    </DashboardLayout>
  );
}
