import { useState, useRef, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, X, Loader2, Sparkles, CheckCircle, Zap, AlertCircle, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { CreditReportViewer } from "./CreditReportViewer";
import { QuickCreditAnalysisView } from "./QuickCreditAnalysisView";

interface CreditBureauDialogProps {
  open: boolean;
  onClose: () => void;
  applicationId: string;
  orgId: string;
  applicant: any;
  existingVerification?: any;
}

export default function CreditBureauDialog({
  open,
  onClose,
  applicationId,
  orgId,
  applicant,
  existingVerification,
}: CreditBureauDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<string>(
    existingVerification?.response_data?.is_live_fetch ? "live" : "upload"
  );
  const [consentChecked, setConsentChecked] = useState(false);
  const [isFetchingLive, setIsFetchingLive] = useState(false);
  const [liveReportData, setLiveReportData] = useState<any>(
    existingVerification?.response_data?.is_live_fetch ? existingVerification?.response_data : null
  );

  const [formData, setFormData] = useState({
    bureau_type: existingVerification?.response_data?.bureau_type || "cibil",
    credit_score: existingVerification?.response_data?.credit_score || "",
    active_accounts: existingVerification?.response_data?.active_accounts || "0",
    total_outstanding: existingVerification?.response_data?.total_outstanding || "",
    total_overdue: existingVerification?.response_data?.total_overdue || "",
    enquiry_count_30d: existingVerification?.response_data?.enquiry_count_30d || "0",
    enquiry_count_90d: existingVerification?.response_data?.enquiry_count_90d || "0",
    dpd_history: existingVerification?.response_data?.dpd_history || "",
    status: existingVerification?.status || "success",
    remarks: existingVerification?.remarks || "",
    report_file_path: existingVerification?.response_data?.report_file_path || "",
    name_on_report: existingVerification?.response_data?.name_on_report || "",
    pan_on_report: existingVerification?.response_data?.pan_on_report || "",
  });

  // Sync form data when existingVerification changes (async data load)
  useEffect(() => {
    if (existingVerification?.response_data) {
      const rd = existingVerification.response_data;
      setFormData({
        bureau_type: rd.bureau_type || "cibil",
        credit_score: rd.credit_score?.toString() || "",
        active_accounts: rd.active_accounts?.toString() || "0",
        total_outstanding: rd.total_outstanding?.toString() || "",
        total_overdue: rd.total_overdue?.toString() || "",
        enquiry_count_30d: rd.enquiry_count_30d?.toString() || "0",
        enquiry_count_90d: rd.enquiry_count_90d?.toString() || "0",
        dpd_history: rd.dpd_history || "",
        status: existingVerification.status || "success",
        remarks: existingVerification.remarks || "",
        report_file_path: rd.report_file_path || "",
        name_on_report: rd.name_on_report || "",
        pan_on_report: rd.pan_on_report || "",
      });
      if (rd.quick_analysis) {
        setQuickAnalysisData(rd.quick_analysis);
      }
      if (rd.is_live_fetch) {
        setLiveReportData(rd);
        setActiveTab("live");
      }
    }
  }, [existingVerification]);

  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parsedSuccessfully, setParsedSuccessfully] = useState(false);
  const [isQuickAnalyzing, setIsQuickAnalyzing] = useState(false);
  const [quickAnalysisData, setQuickAnalysisData] = useState<any>(
    existingVerification?.response_data?.quick_analysis || null
  );

  const applicantName = applicant ? 
    `${applicant.first_name || ''} ${applicant.middle_name || ''} ${applicant.last_name || ''}`.trim() : 
    'Unknown';
  const applicantPAN = applicant?.pan_number || '';
  // Use 'dob' field (the actual column name) - fall back to date_of_birth for compatibility
  const applicantDOB = applicant?.dob || applicant?.date_of_birth || '';
  const applicantMobile = applicant?.mobile || '';
  
  // Handle current_address as JSONB object with line1, city, state, pincode fields
  const addressObj = applicant?.current_address;
  const applicantAddress = typeof addressObj === 'object' && addressObj !== null
    ? (addressObj as any).line1 || ''
    : (addressObj || applicant?.address_line1 || '');
  const applicantCity = (typeof addressObj === 'object' && addressObj !== null ? (addressObj as any).city : '') || applicant?.city || '';
  const applicantState = (typeof addressObj === 'object' && addressObj !== null ? (addressObj as any).state : '') || applicant?.state || '';
  const applicantPincode = (typeof addressObj === 'object' && addressObj !== null ? (addressObj as any).pincode : '') || applicant?.pincode || applicant?.postal_code || '';

  const handleFetchLiveReport = async () => {
    if (!consentChecked) {
      toast({
        title: "Consent required",
        description: "Please confirm consent has been obtained from the applicant",
        variant: "destructive",
      });
      return;
    }

    if (!applicant?.id) {
      toast({
        title: "Missing applicant data",
        description: "Applicant information is required to fetch credit report",
        variant: "destructive",
      });
      return;
    }

    setIsFetchingLive(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const { data, error } = await supabase.functions.invoke("equifax-credit-report", {
        body: {
          applicantId: applicant.id,
          applicationId,
          orgId,
        },
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || "Failed to fetch credit report");
      }

      setLiveReportData(data.data);
      
      // Update form data with live report results
      const reportData = data.data;
      setFormData(prev => ({
        ...prev,
        bureau_type: "equifax",
        credit_score: reportData.creditScore?.toString() || "",
        active_accounts: reportData.summary?.activeAccounts?.toString() || "0",
        total_outstanding: reportData.summary?.totalOutstanding?.toString() || "",
        total_overdue: reportData.summary?.totalPastDue?.toString() || "",
        enquiry_count_30d: reportData.enquiries?.total30Days?.toString() || "0",
        enquiry_count_90d: reportData.enquiries?.total90Days?.toString() || "0",
        name_on_report: reportData.personalInfo?.name || "",
        pan_on_report: reportData.personalInfo?.pan || "",
        status: "success",
        remarks: `Live fetch from Equifax. Score: ${reportData.creditScore} (${reportData.scoreType} ${reportData.scoreVersion || "4.0"})`,
      }));

      toast({
        title: "Credit report fetched successfully",
        description: `Credit score: ${reportData.creditScore}`,
      });

      // Invalidate queries to refresh verification status
      queryClient.invalidateQueries({ queryKey: ["loan-verifications", applicationId] });
    } catch (error: any) {
      console.error("Error fetching live report:", error);
      toast({
        title: "Failed to fetch credit report",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsFetchingLive(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please upload a file smaller than 10MB",
          variant: "destructive",
        });
        return;
      }
      setUploadedFile(file);
      setParsedSuccessfully(false);
    }
  };

  const uploadAndParseFile = async () => {
    if (!uploadedFile) return null;

    setIsUploading(true);
    try {
      const fileExt = uploadedFile.name.split('.').pop();
      const fileName = `${orgId}/${applicationId}/cibil_report_${Date.now()}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("loan-documents")
        .upload(fileName, uploadedFile, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) throw uploadError;
      
      setIsUploading(false);
      setIsParsing(true);

      const { data: parseResult, error: parseError } = await supabase.functions
        .invoke("parse-cibil-report", {
          body: { 
            filePath: uploadData.path,
            applicationId 
          }
        });

      if (parseError) {
        console.error("Parse error:", parseError);
        throw new Error("Failed to parse CIBIL report");
      }

      if (!parseResult.success) {
        throw new Error(parseResult.error || "Failed to parse report");
      }

      // Handle both immediate and chunked processing responses
      const parsed = parseResult.data;
      
      // If processing in background (large PDF), show appropriate message
      if (parseResult.status === "processing") {
        toast({
          title: "Report parsing started",
          description: parseResult.message || "Large document being processed in background...",
        });
        // Set partial data if available
        if (parsed) {
          setFormData(prev => ({
            ...prev,
            bureau_type: parsed.bureau_type || prev.bureau_type,
            credit_score: parsed.credit_score?.toString() || prev.credit_score,
            report_file_path: uploadData.path,
          }));
        }
        return uploadData.path;
      }

      setFormData(prev => ({
        ...prev,
        bureau_type: parsed.bureau_type || prev.bureau_type,
        credit_score: parsed.credit_score?.toString() || prev.credit_score,
        active_accounts: parsed.active_accounts?.toString() || prev.active_accounts,
        total_outstanding: parsed.total_outstanding?.toString() || prev.total_outstanding,
        total_overdue: parsed.total_overdue?.toString() || prev.total_overdue,
        enquiry_count_30d: parsed.enquiry_count_30d?.toString() || prev.enquiry_count_30d,
        enquiry_count_90d: parsed.enquiry_count_90d?.toString() || prev.enquiry_count_90d,
        dpd_history: parsed.dpd_history || prev.dpd_history,
        remarks: parsed.remarks || prev.remarks,
        report_file_path: uploadData.path,
        name_on_report: parsed.name_on_report || prev.name_on_report,
        pan_on_report: parsed.pan_on_report || prev.pan_on_report,
        status: "success",
      }));

      setParsedSuccessfully(true);
      toast({
        title: "Report parsed successfully",
        description: `Credit score: ${parsed.credit_score || "Not found"}`,
      });

      return uploadData.path;
    } catch (error: any) {
      toast({
        title: "Error processing report",
        description: error.message,
        variant: "destructive",
      });
      return null;
    } finally {
      setIsUploading(false);
      setIsParsing(false);
    }
  };

  const uploadAndQuickAnalyze = async () => {
    if (!uploadedFile) return null;

    setIsUploading(true);
    try {
      const fileExt = uploadedFile.name.split('.').pop();
      const fileName = `${orgId}/${applicationId}/cibil_report_${Date.now()}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("loan-documents")
        .upload(fileName, uploadedFile, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) throw uploadError;
      
      setIsUploading(false);
      setIsQuickAnalyzing(true);

      const { data: analysisResult, error: analysisError } = await supabase.functions
        .invoke("quick-credit-analysis", {
          body: { 
            filePath: uploadData.path,
            applicationId 
          }
        });

      if (analysisError) {
        console.error("Analysis error:", analysisError);
        throw new Error("Failed to analyze credit report");
      }

      if (!analysisResult.success) {
        throw new Error(analysisResult.error || "Failed to analyze report");
      }

      const analysis = analysisResult.data;
      setQuickAnalysisData(analysis);
      
      // Auto-fill form fields from analysis
      setFormData(prev => ({
        ...prev,
        bureau_type: analysis.bureau_type || prev.bureau_type,
        credit_score: analysis.credit_score?.toString() || prev.credit_score,
        active_accounts: analysis.summary_stats?.active_accounts?.toString() || prev.active_accounts,
        total_outstanding: analysis.summary_stats?.total_outstanding?.toString() || prev.total_outstanding,
        total_overdue: analysis.summary_stats?.total_overdue?.toString() || prev.total_overdue,
        enquiry_count_30d: analysis.summary_stats?.enquiries_30d?.toString() || prev.enquiry_count_30d,
        enquiry_count_90d: analysis.summary_stats?.enquiries_90d?.toString() || prev.enquiry_count_90d,
        report_file_path: uploadData.path,
        name_on_report: analysis.applicant_name || prev.name_on_report,
        pan_on_report: analysis.pan || prev.pan_on_report,
        status: "success",
        remarks: analysis.recommendation || prev.remarks,
      }));

      setParsedSuccessfully(true);

      // Auto-save verification so data persists when dialog closes
      const updatedFormData = {
        bureau_type: analysis.bureau_type || formData.bureau_type,
        credit_score: analysis.credit_score?.toString() || formData.credit_score,
        active_accounts: analysis.summary_stats?.active_accounts?.toString() || formData.active_accounts,
        total_outstanding: analysis.summary_stats?.total_outstanding?.toString() || formData.total_outstanding,
        total_overdue: analysis.summary_stats?.total_overdue?.toString() || formData.total_overdue,
        enquiry_count_30d: analysis.summary_stats?.enquiries_30d?.toString() || formData.enquiry_count_30d,
        enquiry_count_90d: analysis.summary_stats?.enquiries_90d?.toString() || formData.enquiry_count_90d,
        report_file_path: uploadData.path,
        name_on_report: analysis.applicant_name || formData.name_on_report,
        pan_on_report: analysis.pan || formData.pan_on_report,
        status: "success",
        remarks: analysis.recommendation || formData.remarks,
        dpd_history: formData.dpd_history,
      };

      const verificationData = {
        loan_application_id: applicationId,
        applicant_id: applicant?.id,
        verification_type: "credit_bureau",
        verification_source: updatedFormData.bureau_type,
        status: updatedFormData.status,
        request_data: { bureau_type: updatedFormData.bureau_type },
        response_data: {
          bureau_type: updatedFormData.bureau_type,
          credit_score: parseInt(updatedFormData.credit_score) || 0,
          active_accounts: parseInt(updatedFormData.active_accounts) || 0,
          total_outstanding: parseFloat(updatedFormData.total_outstanding) || 0,
          total_overdue: parseFloat(updatedFormData.total_overdue) || 0,
          enquiry_count_30d: parseInt(updatedFormData.enquiry_count_30d) || 0,
          enquiry_count_90d: parseInt(updatedFormData.enquiry_count_90d) || 0,
          dpd_history: updatedFormData.dpd_history,
          report_file_path: updatedFormData.report_file_path,
          name_on_report: updatedFormData.name_on_report,
          pan_on_report: updatedFormData.pan_on_report,
          is_live_fetch: false,
          quick_analysis: analysis,
        },
        remarks: updatedFormData.remarks,
        verified_at: new Date().toISOString(),
      };

      if (existingVerification) {
        await supabase.from("loan_verifications").update(verificationData).eq("id", existingVerification.id);
      } else {
        await supabase.from("loan_verifications").insert(verificationData);
      }
      queryClient.invalidateQueries({ queryKey: ["loan-verifications", applicationId] });

      toast({
        title: "Credit analysis saved",
        description: `Credit score: ${analysis.credit_score || "Not found"} (${analysis.score_rating || ""})`,
      });

      return uploadData.path;
    } catch (error: any) {
      toast({
        title: "Error analyzing report",
        description: error.message,
        variant: "destructive",
      });
      return null;
    } finally {
      setIsUploading(false);
      setIsQuickAnalyzing(false);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const verificationData = {
        loan_application_id: applicationId,
        applicant_id: applicant?.id,
        verification_type: "credit_bureau",
        verification_source: formData.bureau_type,
        status: formData.status,
        request_data: { bureau_type: formData.bureau_type },
        response_data: {
          bureau_type: formData.bureau_type,
          credit_score: parseInt(formData.credit_score) || 0,
          active_accounts: parseInt(formData.active_accounts) || 0,
          total_outstanding: parseFloat(formData.total_outstanding) || 0,
          total_overdue: parseFloat(formData.total_overdue) || 0,
          enquiry_count_30d: parseInt(formData.enquiry_count_30d) || 0,
          enquiry_count_90d: parseInt(formData.enquiry_count_90d) || 0,
          dpd_history: formData.dpd_history,
          report_file_path: formData.report_file_path,
          name_on_report: formData.name_on_report,
          pan_on_report: formData.pan_on_report,
          is_live_fetch: activeTab === "live",
          ...(quickAnalysisData ? { quick_analysis: quickAnalysisData } : {}),
          ...(liveReportData && activeTab === "live" ? {
            summary: liveReportData.summary,
            accounts: liveReportData.accounts,
            enquiries: liveReportData.enquiries,
            personal_info: liveReportData.personalInfo,
          } : {}),
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
      toast({ title: "Credit bureau verification saved successfully" });
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

  const removeFile = () => {
    setUploadedFile(null);
    setParsedSuccessfully(false);
    setQuickAnalysisData(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Credit Bureau Check</DialogTitle>
          <DialogDescription>
            Fetch credit report from Equifax or upload report for AI parsing
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="live" className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Fetch from Bureau
            </TabsTrigger>
            <TabsTrigger value="upload" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Upload Report
            </TabsTrigger>
          </TabsList>

          <TabsContent value="live" className="space-y-4 mt-4">
            {/* Applicant Details Preview */}
            <div className="p-4 bg-muted/50 rounded-lg border">
              <p className="text-sm font-medium mb-3">Applicant Details for Bureau Check</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Name: </span>
                  <span className="font-medium">{applicantName || "Not available"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">PAN: </span>
                  <span className="font-medium">{applicantPAN || "Not available"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">DOB: </span>
                  <span className="font-medium">{applicantDOB || "Not available"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Mobile: </span>
                  <span className="font-medium">{applicantMobile || "Not available"}</span>
                </div>
                {applicantAddress && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Address: </span>
                    <span className="font-medium">
                      {[applicantAddress, applicantCity, applicantState, applicantPincode]
                        .filter(Boolean)
                        .join(", ")}
                    </span>
                  </div>
                )}
              </div>

              {(!applicantPAN && !applicant?.aadhaar_number) && (
                <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <span className="text-sm text-amber-800">
                    PAN or Aadhaar number required for bureau check
                  </span>
                </div>
              )}
            </div>

            {/* Consent Checkbox */}
            <div className="flex items-start space-x-3 p-4 border rounded-lg">
              <Checkbox 
                id="consent" 
                checked={consentChecked} 
                onCheckedChange={(checked) => setConsentChecked(checked === true)}
              />
              <label htmlFor="consent" className="text-sm leading-tight cursor-pointer">
                I confirm that consent has been obtained from the applicant to fetch their credit report from Equifax Credit Bureau.
              </label>
            </div>

            {/* Fetch Button */}
            <Button 
              onClick={handleFetchLiveReport}
              disabled={isFetchingLive || !consentChecked || (!applicantPAN && !applicant?.aadhaar_number)}
              className="w-full"
              size="lg"
            >
              {isFetchingLive ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Fetching Credit Report...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  Fetch Credit Report from Equifax
                </>
              )}
            </Button>

            {/* Live Report Viewer */}
            {liveReportData && (
              <div className="mt-4 border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="font-medium">Credit Report Fetched Successfully</span>
                  <Badge variant="outline" className="ml-auto">
                    Score: {liveReportData.creditScore}
                  </Badge>
                </div>
                <CreditReportViewer data={liveReportData} />
              </div>
            )}
          </TabsContent>

          <TabsContent value="upload" className="space-y-4 mt-4">
            {/* File Upload Section */}
            <div className="border-2 border-dashed border-primary/30 rounded-lg p-4 bg-primary/5">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <Label className="text-base font-medium">Upload Credit Bureau Report (AI Parsed)</Label>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                Supports CIBIL, Experian, Equifax, and CRIF report formats (PDF, Image, HTML, Excel)
              </p>
              
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.html,.htm,.xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
                id="cibil-file-upload"
              />
              
              {!uploadedFile && !formData.report_file_path ? (
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-primary/30 hover:bg-primary/10"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Choose Credit Report File
                </Button>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-background rounded-md border">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-primary" />
                      <span className="text-sm font-medium">
                        {uploadedFile ? uploadedFile.name : "Credit Report Uploaded"}
                      </span>
                      {parsedSuccessfully && (
                        <Badge variant="default" className="bg-green-500">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Parsed
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {formData.report_file_path && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            const { data } = await supabase.storage
                              .from("loan-documents")
                              .createSignedUrl(formData.report_file_path, 300);
                            if (data?.signedUrl) {
                              window.open(data.signedUrl, "_blank");
                            }
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={removeFile}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  {uploadedFile && !parsedSuccessfully && (
                    <Button
                      onClick={uploadAndQuickAnalyze}
                      disabled={isUploading || isQuickAnalyzing}
                      className="w-full"
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : isQuickAnalyzing ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-2" />
                          Upload & Analyze Report
                        </>
                      )}
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Quick Analysis View */}
            {quickAnalysisData && (
              <div className="border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="font-medium">Credit Analysis Summary</span>
                </div>
                <QuickCreditAnalysisView data={quickAnalysisData} />
              </div>
            )}

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Report Details {parsedSuccessfully && "(Auto-filled from report)"}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Bureau Type</Label>
                <Select value={formData.bureau_type} onValueChange={(value) => setFormData({ ...formData, bureau_type: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cibil">CIBIL</SelectItem>
                    <SelectItem value="experian">Experian</SelectItem>
                    <SelectItem value="equifax">Equifax</SelectItem>
                    <SelectItem value="crif">CRIF</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Credit Score</Label>
                <Input
                  type="number"
                  value={formData.credit_score}
                  onChange={(e) => setFormData({ ...formData, credit_score: e.target.value })}
                  placeholder="750"
                  min="300"
                  max="900"
                />
              </div>
            </div>

            {formData.name_on_report && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Name on Report</Label>
                  <Input
                    value={formData.name_on_report}
                    onChange={(e) => setFormData({ ...formData, name_on_report: e.target.value })}
                    placeholder="Name as per report"
                  />
                </div>
                <div>
                  <Label>PAN on Report</Label>
                  <Input
                    value={formData.pan_on_report}
                    onChange={(e) => setFormData({ ...formData, pan_on_report: e.target.value })}
                    placeholder="PAN number"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Active Accounts</Label>
                <Input
                  type="number"
                  value={formData.active_accounts}
                  onChange={(e) => setFormData({ ...formData, active_accounts: e.target.value })}
                  placeholder="5"
                />
              </div>
              <div>
                <Label>Total Outstanding (₹)</Label>
                <Input
                  type="number"
                  value={formData.total_outstanding}
                  onChange={(e) => setFormData({ ...formData, total_outstanding: e.target.value })}
                  placeholder="500000"
                />
              </div>
            </div>

            <div>
              <Label>Total Overdue (₹)</Label>
              <Input
                type="number"
                value={formData.total_overdue}
                onChange={(e) => setFormData({ ...formData, total_overdue: e.target.value })}
                placeholder="0"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Enquiries (30 days)</Label>
                <Input
                  type="number"
                  value={formData.enquiry_count_30d}
                  onChange={(e) => setFormData({ ...formData, enquiry_count_30d: e.target.value })}
                  placeholder="2"
                />
              </div>
              <div>
                <Label>Enquiries (90 days)</Label>
                <Input
                  type="number"
                  value={formData.enquiry_count_90d}
                  onChange={(e) => setFormData({ ...formData, enquiry_count_90d: e.target.value })}
                  placeholder="4"
                />
              </div>
            </div>

            <div>
              <Label>DPD History Summary</Label>
              <Textarea
                value={formData.dpd_history}
                onChange={(e) => setFormData({ ...formData, dpd_history: e.target.value })}
                placeholder="e.g., No DPD in last 12 months, or 30+ DPD twice in last 24 months"
                rows={2}
              />
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
                placeholder="Additional observations from the credit report"
                rows={3}
              />
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={() => saveMutation.mutate()} 
            disabled={saveMutation.isPending || isUploading || isParsing || isQuickAnalyzing || isFetchingLive}
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Verification"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
