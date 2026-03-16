import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { 
  FileText, Download, Printer, Loader2, Send, Check, 
  TrendingUp, Banknote, Calculator, Calendar, Upload, FileCheck,
  Package, Eye
} from "lucide-react";
import { addDays } from "date-fns";
import html2pdf from "html2pdf.js";

// Document template imports
import SanctionLetterDocument from "../Sanction/templates/SanctionLetterDocument";
import LoanAgreementDocument from "../Sanction/templates/LoanAgreementDocument";
import DailyRepaymentScheduleDocument from "../Sanction/templates/DailyRepaymentScheduleDocument";
import CombinedLoanDocuments from "../Sanction/templates/CombinedLoanDocuments";
import UploadSignedDocumentDialog from "../Sanction/UploadSignedDocumentDialog";
import ESignDocumentButton from "../Sanction/ESignDocumentButton";
import EMandateSection from "./EMandateSection";
import CombinedLoanPackCard from "./CombinedLoanPackCard";


interface DisbursementDashboardProps {
  applicationId: string;
}

type DocumentType = "sanction_letter" | "loan_agreement" | "daily_schedule" | "combined_loan_pack";

const documentTypes: { key: DocumentType; label: string; shortLabel: string }[] = [
  { key: "sanction_letter", label: "Sanction Letter", shortLabel: "Sanction" },
  { key: "loan_agreement", label: "Loan Agreement", shortLabel: "Agreement" },
  { key: "daily_schedule", label: "Daily Repayment Schedule", shortLabel: "Repayment" },
];

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatAddress = (addressJson: unknown): string => {
  if (!addressJson) return "";
  const addr = addressJson as Record<string, string>;
  return [
    addr.line1 || addr.address_line1,
    addr.line2 || addr.address_line2,
    addr.city,
    addr.state,
    addr.pincode || addr.postal_code,
  ].filter(Boolean).join(", ");
};

export default function DisbursementDashboard({ applicationId }: DisbursementDashboardProps) {
  const printRefs = useRef<Record<DocumentType, HTMLDivElement | null>>({
    sanction_letter: null,
    loan_agreement: null,
    daily_schedule: null,
    combined_loan_pack: null,
  });
  const queryClient = useQueryClient();
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState<DocumentType | null>(null);

  // Fetch application data
  const { data: application, isLoading: loadingApp } = useQuery({
    queryKey: ["loan-application", applicationId],
    queryFn: async () => {
      const { data } = await supabase
        .from("loan_applications")
        .select("*")
        .eq("id", applicationId)
        .maybeSingle();
      return data;
    },
  });

  // Fetch sanction data
  const { data: sanction, isLoading: loadingSanction } = useQuery({
    queryKey: ["loan-sanction", applicationId],
    queryFn: async () => {
      const { data } = await supabase
        .from("loan_sanctions")
        .select("*")
        .eq("loan_application_id", applicationId)
        .maybeSingle();
      return data;
    },
  });

  // Fetch primary applicant
  interface ApplicantData {
    first_name: string;
    last_name?: string;
    mobile?: string;
    alternate_mobile?: string;
    email?: string;
    current_address?: unknown;
    pan_number?: string;
    aadhaar_number?: string;
  }
  
  const { data: applicant, isLoading: loadingApplicant } = useQuery<ApplicantData | null>({
    queryKey: ["primary-applicant", applicationId],
    queryFn: async () => {
      try {
        // Use RPC function that auto-decrypts encrypted PII fields
        const { data, error } = await supabase.rpc("get_decrypted_applicant", {
          p_application_id: applicationId,
        });
        if (error) {
          console.error("Error fetching decrypted applicant:", error);
          return null;
        }
        return data?.[0] || null;
      } catch (error) {
        console.error("Error fetching applicant:", error);
        return null;
      }
    },
  });

  // Bank details derived from decrypted applicant data
  const bankDetails = applicant ? {
    bank_name: (applicant as any).bank_name ?? undefined,
    account_number: (applicant as any).bank_account_number ?? undefined,
    ifsc_code: (applicant as any).bank_ifsc_code ?? undefined,
  } : null;

  // Fetch org settings
  const { data: orgSettings } = useQuery({
    queryKey: ["org-loan-settings", application?.org_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("organization_loan_settings")
        .select("*")
        .eq("org_id", application!.org_id)
        .maybeSingle();
      
      return data || {
        company_name: "Paisaa Saarthi",
        company_address: "",
        company_cin: "",
        company_phone: "",
        grievance_email: "",
        grievance_phone: "",
        jurisdiction: "Mumbai",
        gst_on_processing_fee: 18,
        foreclosure_rate: 4,
        insurance_charges: 0,
      };
    },
    enabled: !!application?.org_id,
  });

  // Fetch loan eligibility data (single source of truth for calculated values)
  const { data: eligibility } = useQuery({
    queryKey: ["loan-eligibility", applicationId],
    queryFn: async () => {
      const { data } = await supabase
        .from("loan_eligibility")
        .select("*")
        .eq("loan_application_id", applicationId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  // Fetch existing generated documents
  const { data: generatedDocs, refetch: refetchDocs } = useQuery({
    queryKey: ["generated-documents", applicationId, sanction?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("loan_generated_documents")
        .select("*")
        .eq("loan_application_id", applicationId);
      
      return data || [];
    },
  });

  // Generate document mutation
  const generateMutation = useMutation({
    mutationFn: async (docType: DocumentType) => {
      const docNumber = `${docType.toUpperCase().replace("_", "")}-${Date.now().toString(36).toUpperCase()}`;
      
      const { data, error } = await supabase
        .from("loan_generated_documents")
        .insert({
          loan_application_id: applicationId,
          sanction_id: sanction?.id || null,
          org_id: application!.org_id,
          document_type: docType,
          document_number: docNumber,
          status: "generated",
        })
        .select()
        .single();

      if (error) throw error;
      return { data, docType };
    },
    onSuccess: ({ docType }) => {
      queryClient.invalidateQueries({ queryKey: ["generated-documents", applicationId, sanction?.id] });
      toast.success(`${documentTypes.find(d => d.key === docType)?.label} generated successfully`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleDownload = (docType: DocumentType) => {
    const printRef = printRefs.current[docType];
    if (!printRef) {
      toast.error("Document template not available. Please ensure applicant and sanction data are loaded.");
      return;
    }
    
    const docLabel = documentTypes.find(d => d.key === docType)?.label || docType;
    const opt = {
      margin: 10,
      filename: `${docLabel.replace(/\s+/g, '-')}-${applicationId}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const }
    };
    
    html2pdf().set(opt).from(printRef).save();
  };

  const handlePrint = (docType: DocumentType) => {
    const printRef = printRefs.current[docType];
    if (printRef) {
      const printContent = printRef.innerHTML;
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Print Document</title>
              <style>
                @media print {
                  body { margin: 0; padding: 20px; font-family: system-ui, sans-serif; }
                  .no-print { display: none; }
                }
                body { margin: 0; padding: 20px; font-family: system-ui, sans-serif; }
              </style>
            </head>
            <body>${printContent}</body>
          </html>
        `);
        printWindow.document.close();
        printWindow.print();
      }
    }
  };

  const isDocGenerated = (docType: DocumentType) => {
    return generatedDocs?.some((d) => d.document_type === docType);
  };

  if (loadingApp || loadingSanction) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-48">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!application) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-48">
          <p className="text-muted-foreground">Application not found</p>
        </CardContent>
      </Card>
    );
  }

  // Calculate loan summary values
  const loanAmount = sanction?.sanctioned_amount || application.approved_amount || eligibility?.eligible_loan_amount || application.requested_amount || 0;
  const interestRate = sanction?.sanctioned_rate || application.interest_rate || eligibility?.recommended_interest_rate || 0;
  const tenureDays = sanction?.sanctioned_tenure_days || application.tenure_days || eligibility?.recommended_tenure_days || 30;
  
  // Always recalculate from principal + rate + tenure to avoid stale stored values
  const calculatedInterest = loanAmount * (interestRate / 100) * tenureDays;
  const calculatedRepayment = loanAmount + calculatedInterest;
  
  const interestAmount = Math.round(calculatedInterest * 100) / 100;
  const totalRepayment = Math.round(calculatedRepayment * 100) / 100;
  
  // Processing fee is 10% of loan amount (standard)
  const processingFeeRate = 10;
  const gstRate = orgSettings?.gst_on_processing_fee || 18;
  const processingFee = sanction?.processing_fee || Math.round(loanAmount * (processingFeeRate / 100));
  const gstOnProcessingFee = Math.round(processingFee * (gstRate / 100));
  const netDisbursal = loanAmount - processingFee - gstOnProcessingFee;
  const dueDate = addDays(new Date(), tenureDays);

  const borrowerName = applicant ? `${applicant.first_name} ${applicant.last_name || ""}`.trim() : "";
  const borrowerAddress = applicant ? formatAddress(applicant.current_address) : "";
  const borrowerPhone = applicant?.mobile || applicant?.alternate_mobile || "";

  // Parse conditions
  const parseConditions = (): string[] | null => {
    if (!sanction?.conditions) return null;
    
    if (typeof sanction.conditions === 'string') {
      const lines = sanction.conditions.split("\n").filter(Boolean);
      return lines.length > 0 ? lines : null;
    }
    
    if (Array.isArray(sanction.conditions)) {
      const stringArray = sanction.conditions.map(item => String(item)).filter(Boolean);
      return stringArray.length > 0 ? stringArray : null;
    }
    
    if (typeof sanction.conditions === 'object') {
      const keys = Object.keys(sanction.conditions);
      if (keys.length === 0) return null;
    }
    
    return null;
  };
  
  const conditionsArray = parseConditions();

  const defaultTerms = [
    "The loan is granted subject to satisfactory completion of all documentation.",
    "The borrower must repay the full amount on the due date.",
    "Any change in contact details must be immediately informed to the lender.",
    "The lender reserves the right to recall the loan in case of default.",
    "All terms and conditions of the loan agreement shall apply.",
  ];

  return (
    <div className="space-y-6">
      {/* Loan Summary Card */}
      <Card className="overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5 border-b">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Loan Summary</CardTitle>
              <CardDescription>Final loan amount and repayment details</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="p-4 rounded-lg bg-muted/50 space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Banknote className="h-4 w-4" />
                <span className="text-sm">Approved Loan Amount</span>
              </div>
              <p className="text-2xl font-bold">{formatCurrency(loanAmount)}</p>
              <p className="text-xs text-muted-foreground">Based on eligibility</p>
            </div>
            
            <div className="p-4 rounded-lg bg-muted/50 space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calculator className="h-4 w-4" />
                <span className="text-sm">Interest Amount</span>
              </div>
              <p className="text-2xl font-bold">{formatCurrency(interestAmount)}</p>
              <p className="text-xs text-muted-foreground">@ {interestRate}% × {tenureDays} days</p>
            </div>
            
            <div className="p-4 rounded-lg bg-muted/50 space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calculator className="h-4 w-4" />
                <span className="text-sm">Processing Fee + GST</span>
              </div>
              <p className="text-2xl font-bold">{formatCurrency(processingFee + gstOnProcessingFee)}</p>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(processingFee)} + {gstRate}% GST ({formatCurrency(gstOnProcessingFee)})
              </p>
            </div>
            
            <div className="p-4 rounded-lg bg-primary/10 space-y-1 border border-primary/20">
              <div className="flex items-center gap-2 text-primary">
                <Banknote className="h-4 w-4" />
                <span className="text-sm font-medium">Net Disbursal</span>
              </div>
              <p className="text-2xl font-bold text-primary">{formatCurrency(netDisbursal)}</p>
              <p className="text-xs text-muted-foreground">After fee + GST deduction</p>
            </div>
            
            <div className="p-4 rounded-lg bg-muted/50 space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <TrendingUp className="h-4 w-4" />
                <span className="text-sm">Total Repayment</span>
              </div>
              <p className="text-2xl font-bold">{formatCurrency(totalRepayment)}</p>
              <p className="text-xs text-muted-foreground">Principal + Interest</p>
            </div>
            
          </div>
        </CardContent>
      </Card>

      {/* Combined Loan Pack Card */}
      {sanction && (
        <CombinedLoanPackCard
          applicationId={applicationId}
          application={application}
          sanction={sanction}
          generatedDocs={generatedDocs || []}
          applicant={applicant}
          orgSettings={orgSettings}
          bankDetails={bankDetails}
          loanAmount={loanAmount}
          tenureDays={tenureDays}
          interestRate={interestRate}
          totalInterest={interestAmount}
          totalRepayment={totalRepayment}
          processingFee={processingFee}
          gstOnProcessingFee={gstOnProcessingFee}
          netDisbursal={netDisbursal}
          dueDate={dueDate}
          borrowerName={borrowerName}
          borrowerAddress={borrowerAddress}
          borrowerPhone={borrowerPhone}
          printRef={(el) => { printRefs.current.combined_loan_pack = el; }}
          onGenerate={() => generateMutation.mutate("combined_loan_pack")}
          isGenerating={generateMutation.isPending}
          onRefetch={refetchDocs}
          conditionsArray={conditionsArray}
          defaultTerms={defaultTerms}
          onUploadSigned={() => {
            setSelectedDocType("combined_loan_pack");
            setUploadDialogOpen(true);
          }}
        />
      )}

      {/* eMandate Registration Section */}
      <EMandateSection
        applicationId={applicationId}
        orgId={application.org_id}
        borrowerName={borrowerName}
        borrowerPhone={borrowerPhone}
        borrowerEmail={applicant?.email}
        totalRepayment={totalRepayment}
        loanAmount={loanAmount}
        tenureDays={tenureDays}
        loanNo={application.application_number || `LOAN-${applicationId.slice(0, 8)}`}
        bankDetails={bankDetails}
      />

      {/* Hidden document templates for printing */}
      <div className="hidden">
        {sanction && (
          <>
            <div ref={(el) => { printRefs.current.sanction_letter = el; }}>
              <SanctionLetterDocument
                companyName={orgSettings?.company_name || "Paisaa Saarthi"}
                companyAddress={orgSettings?.company_address}
                companyCIN={orgSettings?.company_cin}
                documentNumber={generatedDocs?.find(d => d.document_type === "sanction_letter")?.document_number || "SL-DRAFT"}
                documentDate={new Date()}
                borrowerName={borrowerName || "N/A"}
                borrowerAddress={borrowerAddress || "N/A"}
                loanAmount={loanAmount}
                tenureDays={tenureDays}
                interestRate={interestRate}
                totalInterest={interestAmount}
                totalRepayment={totalRepayment}
                processingFee={processingFee}
                gstOnProcessingFee={gstOnProcessingFee}
                netDisbursal={netDisbursal}
                dueDate={dueDate}
                validUntil={new Date(sanction.validity_date)}
                termsAndConditions={conditionsArray || defaultTerms}
              />
            </div>

            <div ref={(el) => { printRefs.current.loan_agreement = el; }}>
              <LoanAgreementDocument
                companyName={orgSettings?.company_name || "Paisaa Saarthi"}
                companyAddress={orgSettings?.company_address}
                companyCIN={orgSettings?.company_cin}
                companyPhone={orgSettings?.company_phone}
                jurisdiction={orgSettings?.jurisdiction}
                documentNumber={generatedDocs?.find(d => d.document_type === "loan_agreement")?.document_number || "LA-DRAFT"}
                documentDate={new Date()}
                borrowerName={borrowerName || "N/A"}
                borrowerAddress={borrowerAddress || "N/A"}
                borrowerPhone={borrowerPhone || "N/A"}
                borrowerPAN={applicant?.pan_number}
                borrowerAadhaar={applicant?.aadhaar_number}
                borrowerEmail={applicant?.email}
                loanAmount={loanAmount}
                tenureDays={tenureDays}
                interestRate={interestRate}
                totalInterest={interestAmount}
                totalRepayment={totalRepayment}
                processingFee={processingFee}
                gstOnProcessingFee={gstOnProcessingFee}
                netDisbursal={netDisbursal}
                dueDate={dueDate}
                foreclosureRate={orgSettings?.foreclosure_rate || 4}
                bounceCharges={(orgSettings as any)?.bounce_charges || 500}
                penalInterest={(orgSettings as any)?.penal_interest_rate || 24}
                bankName={bankDetails?.bank_name}
                accountNumber={bankDetails?.account_number}
                ifscCode={bankDetails?.ifsc_code}
              />
            </div>

            <div ref={(el) => { printRefs.current.daily_schedule = el; }}>
              <DailyRepaymentScheduleDocument
                companyName={orgSettings?.company_name || "Paisaa Saarthi"}
                companyAddress={orgSettings?.company_address}
                companyCIN={orgSettings?.company_cin}
                documentNumber={generatedDocs?.find(d => d.document_type === "daily_schedule")?.document_number || "DRS-DRAFT"}
                documentDate={new Date()}
                borrowerName={borrowerName || "N/A"}
                borrowerAddress={borrowerAddress || "N/A"}
                borrowerPhone={borrowerPhone || "N/A"}
                loanAmount={loanAmount}
                dailyInterestRate={interestRate}
                tenureDays={tenureDays}
                disbursementDate={new Date()}
                bankName={bankDetails?.bank_name}
                accountNumber={bankDetails?.account_number}
                grievanceEmail={orgSettings?.grievance_email}
                grievancePhone={orgSettings?.grievance_phone}
              />
            </div>
          </>
        )}
      </div>

      {/* Upload Signed Document Dialog */}
      {sanction && selectedDocType && (
        <UploadSignedDocumentDialog
          open={uploadDialogOpen}
          onOpenChange={(open) => {
            setUploadDialogOpen(open);
            if (!open) setSelectedDocType(null);
          }}
          applicationId={applicationId}
          sanctionId={sanction.id}
          orgId={application.org_id}
          documentType={selectedDocType}
          onSuccess={() => {
            refetchDocs();
            queryClient.invalidateQueries({ queryKey: ["loan-sanction", applicationId] });
          }}
        />
      )}
    </div>
  );
}
