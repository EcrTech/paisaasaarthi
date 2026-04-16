import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Package, FileText, Download, Printer, Loader2, FileCheck, Eye, Upload } from "lucide-react";
import html2pdf from "html2pdf.js";
import { supabase } from "@/integrations/supabase/client";
import { uploadFileToR2 } from "@/lib/uploadToR2";
import CombinedLoanDocuments from "../Sanction/templates/CombinedLoanDocuments";
import ESignDocumentButton from "../Sanction/ESignDocumentButton";

interface CombinedLoanPackCardProps {
  applicationId: string;
  application: {
    org_id: string;
    application_number?: string;
  };
  sanction: {
    id: string;
    validity_date: string;
  };
  generatedDocs: Array<{
    id: string;
    document_type: string;
    document_number: string;
    file_path?: string | null;
    customer_signed?: boolean;
    signed_document_path?: string;
  }>;
  applicant: {
    first_name: string;
    last_name?: string;
    mobile?: string;
    email?: string;
    pan_number?: string;
    aadhaar_number?: string;
    current_address?: unknown;
  } | null;
  orgSettings: {
    company_name?: string;
    company_address?: string;
    company_cin?: string;
    company_phone?: string;
    jurisdiction?: string;
    gst_on_processing_fee?: number;
    foreclosure_rate?: number;
    grievance_email?: string;
    grievance_phone?: string;
  } | null;
  bankDetails: {
    bank_name?: string;
    account_number?: string;
    ifsc_code?: string;
  } | null;
  loanAmount: number;
  tenureDays: number;
  interestRate: number;
  totalInterest: number;
  totalRepayment: number;
  processingFee: number;
  gstOnProcessingFee: number;
  netDisbursal: number;
  dueDate: Date;
  borrowerName: string;
  borrowerAddress: string;
  borrowerPhone: string;
  printRef: (el: HTMLDivElement | null) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  onRefetch: () => void;
  conditionsArray: string[] | null;
  defaultTerms: string[];
  onUploadSigned?: () => void;
}

export default function CombinedLoanPackCard({
  applicationId,
  application,
  sanction,
  generatedDocs,
  applicant,
  orgSettings,
  bankDetails,
  loanAmount,
  tenureDays,
  interestRate,
  totalInterest,
  totalRepayment,
  processingFee,
  gstOnProcessingFee,
  netDisbursal,
  dueDate,
  borrowerName,
  borrowerAddress,
  borrowerPhone,
  printRef,
  onGenerate,
  isGenerating,
  onRefetch,
  conditionsArray,
  defaultTerms,
  onUploadSigned,
}: CombinedLoanPackCardProps) {
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);

  // Check if all individual documents are generated
  const sanctionDoc = generatedDocs.find(d => d.document_type === "sanction_letter");
  const agreementDoc = generatedDocs.find(d => d.document_type === "loan_agreement");
  const scheduleDoc = generatedDocs.find(d => d.document_type === "daily_schedule");
  const kfsDoc = generatedDocs.find(d => d.document_type === "kfs");
  const combinedDoc = generatedDocs.find(d => d.document_type === "combined_loan_pack");

  const isCombinedGenerated = !!combinedDoc;
  const isCombinedSigned = combinedDoc?.customer_signed;
  const needsRegeneration = combinedDoc && !combinedDoc.file_path;

  // Auto-generate individual document records if missing
  const ensureIndividualDocs = async () => {
    const missingTypes: string[] = [];
    if (!sanctionDoc) missingTypes.push("sanction_letter");
    if (!agreementDoc) missingTypes.push("loan_agreement");
    if (!scheduleDoc) missingTypes.push("daily_schedule");
    if (!kfsDoc) missingTypes.push("kfs");

    if (missingTypes.length > 0) {
      const inserts = missingTypes.map(docType => ({
        loan_application_id: applicationId,
        sanction_id: sanction.id,
        org_id: application.org_id,
        document_type: docType,
        document_number: `${docType.toUpperCase().replace(/_/g, "")}-${Date.now().toString(36).toUpperCase()}`,
        status: "generated",
      }));

      const { error } = await supabase
        .from("loan_generated_documents")
        .insert(inserts);

      if (error) {
        console.error("Error auto-generating individual docs:", error);
        throw new Error("Failed to create individual document records");
      }

      await onRefetch();
    }
  };

  // Generate PDF, upload to storage, and create DB record
  const handleGenerateCombined = async () => {
    const printElement = document.getElementById("combined-loan-pack-template");
    if (!printElement) {
      toast.error("Combined document template not available");
      return;
    }

    setIsUploadingPdf(true);
    try {
      await ensureIndividualDocs();
      const worker = html2pdf()
        .set({
          margin: 10,
          image: { type: 'jpeg' as const, quality: 0.98 },
          html2canvas: { scale: 2 },
          jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const },
          pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
        } as any)
        .from(printElement);
      
      const pdfBlob = await worker.outputPdf('blob');

      const docNumber = `COMBINEDLOANPACK-${Date.now().toString(36).toUpperCase()}`;
      const pdfFile = new File([pdfBlob], `${docNumber}.pdf`, { type: 'application/pdf' });
      const fileUrl = await uploadFileToR2(pdfFile, application.org_id, applicationId, "combined_loan_pack");

      if (combinedDoc) {
        const { error: updateError } = await supabase
          .from("loan_generated_documents")
          .update({
            file_path: fileUrl,
            document_number: docNumber,
            status: "generated",
          })
          .eq("id", combinedDoc.id);

        if (updateError) throw new Error(`Failed to update document record: ${updateError.message}`);
      } else {
        const { error: insertError } = await supabase
          .from("loan_generated_documents")
          .insert({
            loan_application_id: applicationId,
            sanction_id: sanction.id,
            org_id: application.org_id,
            document_type: "combined_loan_pack",
            document_number: docNumber,
            file_path: fileUrl,
            status: "generated",
          });

        if (insertError) throw new Error(`Failed to save document record: ${insertError.message}`);
      }

      toast.success("Combined Loan Pack generated and uploaded successfully");
      onRefetch();
    } catch (error) {
      console.error("Generate combined pack error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to generate combined pack");
    } finally {
      setIsUploadingPdf(false);
    }
  };

  const handleDownloadCombined = () => {
    const printElement = document.getElementById("combined-loan-pack-template");
    if (!printElement) {
      toast.error("Combined document template not available");
      return;
    }

    const opt = {
      margin: 10,
      filename: `Combined-Loan-Pack-${applicationId}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };

    html2pdf().set(opt).from(printElement).save();
  };

  const handlePrintCombined = () => {
    const printElement = document.getElementById("combined-loan-pack-template");
    if (!printElement) {
      toast.error("Combined document template not available");
      return;
    }

    const printContent = printElement.innerHTML;
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Print Combined Loan Pack</title>
            <style>
              @media print {
                body { margin: 0; padding: 20px; font-family: system-ui, sans-serif; }
                .no-print { display: none; }
                .break-before-page { page-break-before: always; }
                h2, h3, h4 { page-break-after: avoid; break-after: avoid; }
                table, .mb-6 { page-break-inside: avoid; break-inside: avoid; }
              }
              body { margin: 0; padding: 20px; font-family: system-ui, sans-serif; }
              h2, h3, h4 { page-break-after: avoid; break-after: avoid; }
              table, .mb-6 { page-break-inside: avoid; break-inside: avoid; }
            </style>
          </head>
          <body>${printContent}</body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const handleViewSignedDocument = async () => {
    if (combinedDoc?.signed_document_path) {
      const path = combinedDoc.signed_document_path;
      if (path.startsWith("https://")) {
        window.open(path, "_blank");
        return;
      }
      const { data } = await supabase.storage
        .from("loan-documents")
        .createSignedUrl(path, 60);
      if (data?.signedUrl) {
        window.open(data.signedUrl, "_blank");
      } else {
        toast.error("Failed to get document URL");
      }
    }
  };

  return (
    <>
      <Card className="border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-lg">Combined Loan Pack</CardTitle>
                <CardDescription>All loan documents in one file for easy signing</CardDescription>
              </div>
            </div>
            {isCombinedSigned && (
              <Badge className="gap-1 bg-green-500">
                <FileCheck className="h-3 w-3" />
                E-Signed
              </Badge>
            )}
            {isCombinedGenerated && !isCombinedSigned && (
              <Badge variant="outline" className="gap-1">
                <FileText className="h-3 w-3" />
                Generated
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              variant={isCombinedGenerated && !needsRegeneration ? "outline" : "default"}
              onClick={handleGenerateCombined}
              disabled={isGenerating || isUploadingPdf}
              className="gap-2"
            >
              {(isGenerating || isUploadingPdf) ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Package className="h-4 w-4" />
              )}
              {isUploadingPdf ? "Uploading..." : needsRegeneration ? "Regenerate" : isCombinedGenerated ? "Regenerate" : "Generate Combined Pack"}
            </Button>

            <Button
              variant="outline"
              onClick={handleDownloadCombined}
              disabled={!isCombinedGenerated}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Download
            </Button>

            <Button
              variant="outline"
              onClick={handlePrintCombined}
              disabled={!isCombinedGenerated}
              className="gap-2"
            >
              <Printer className="h-4 w-4" />
              Print
            </Button>

            {isCombinedGenerated && !isCombinedSigned && combinedDoc && (
              <ESignDocumentButton
                orgId={application.org_id}
                applicationId={applicationId}
                documentId={combinedDoc.id}
                documentType="combined_loan_pack"
                documentLabel="Combined Loan Pack"
                signerName={borrowerName}
                signerEmail={applicant?.email || ""}
                signerMobile={applicant?.mobile || ""}
                onSuccess={onRefetch}
              />
            )}

            {isCombinedGenerated && (!isCombinedSigned || (isCombinedSigned && !combinedDoc?.signed_document_path)) && onUploadSigned && (
              <Button
                variant="outline"
                onClick={onUploadSigned}
                className="gap-2"
              >
                <Upload className="h-4 w-4" />
                {isCombinedSigned ? "Re-upload Signed" : "Upload Signed"}
              </Button>
            )}

            {isCombinedSigned && combinedDoc?.signed_document_path && (
              <Button
                variant="outline"
                onClick={handleViewSignedDocument}
                className="gap-2 text-green-600 border-green-200 hover:bg-green-50"
              >
                <Eye className="h-4 w-4" />
                View Signed Document
              </Button>
            )}
          </div>

          {/* Document Status Badges */}
          <div className="flex flex-wrap gap-2 pt-2 border-t">
            <span className="text-xs text-muted-foreground">Includes:</span>
            <Badge variant={sanctionDoc ? "default" : "outline"} className="text-xs">
              {sanctionDoc ? "✓" : "○"} Sanction Letter
            </Badge>
            <Badge variant={agreementDoc ? "default" : "outline"} className="text-xs">
              {agreementDoc ? "✓" : "○"} Loan Agreement
            </Badge>
            <Badge variant={scheduleDoc ? "default" : "outline"} className="text-xs">
              {scheduleDoc ? "✓" : "○"} Daily Schedule
            </Badge>
            <Badge variant={kfsDoc ? "default" : "outline"} className="text-xs">
              {kfsDoc ? "✓" : "○"} Key Fact Statement
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Hidden Combined Template for PDF Generation */}
      <div className="hidden">
        <div id="combined-loan-pack-template" ref={printRef}>
          <CombinedLoanDocuments
            companyName={orgSettings?.company_name || "Paisaa Saarthi"}
            companyAddress={orgSettings?.company_address}
            companyCIN={orgSettings?.company_cin}
            companyPhone={orgSettings?.company_phone}
            jurisdiction={orgSettings?.jurisdiction}
            sanctionDocNumber={sanctionDoc?.document_number || "SL-DRAFT"}
            agreementDocNumber={agreementDoc?.document_number || "LA-DRAFT"}
            scheduleDocNumber={scheduleDoc?.document_number || "DRS-DRAFT"}
            kfsDocNumber={kfsDoc?.document_number || "KFS-DRAFT"}
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
            dailyInterestRate={interestRate}
            totalInterest={totalInterest}
            totalRepayment={totalRepayment}
            processingFee={processingFee}
            gstOnProcessingFee={gstOnProcessingFee}
            netDisbursal={netDisbursal}
            validUntil={new Date(sanction.validity_date)}
            dueDate={dueDate}
            disbursementDate={new Date()}
            bankName={bankDetails?.bank_name}
            accountNumber={bankDetails?.account_number}
            ifscCode={bankDetails?.ifsc_code}
            foreclosureRate={orgSettings?.foreclosure_rate || 4}
            bounceCharges={(orgSettings as any)?.bounce_charges || 500}
            penalInterest={(orgSettings as any)?.penal_interest_rate || 24}
            grievanceEmail={orgSettings?.grievance_email}
            grievancePhone={orgSettings?.grievance_phone}
            termsAndConditions={conditionsArray || defaultTerms}
          />
        </div>
      </div>
    </>
  );
}
