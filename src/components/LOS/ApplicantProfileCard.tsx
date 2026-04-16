import { lazy, Suspense, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { User, FileText, CheckCircle, Eye, Loader2, Video, CreditCard, MessageSquare, Mail, Phone } from "lucide-react";
import { cn } from "@/lib/utils";

const CreditBureauDialog = lazy(() => import("@/components/LOS/Verification/CreditBureauDialog"));
const WhatsAppChatDialog = lazy(() => import("@/components/LOS/Relationships/WhatsAppChatDialog").then(m => ({ default: m.WhatsAppChatDialog })));
import { VideoKYCRetryButton } from "@/components/LOS/Verification/VideoKYCRetryButton";
import { VideoKYCViewDialog } from "@/components/LOS/Verification/VideoKYCViewDialog";
import { EmailChatDialog } from "@/components/LOS/Relationships/EmailChatDialog";
import { CallChatDialog } from "@/components/LOS/Relationships/CallChatDialog";
import { useUnreadWhatsApp } from "@/hooks/useUnreadWhatsApp";
interface Document {
  id: string;
  document_type: string;
  document_category: string;
  file_path: string;
  file_name: string;
  verification_status: string;
}

interface Verification {
  id: string;
  verification_type: string;
  status: string;
  verified_at: string | null;
  response_data: any;
  created_at?: string;
}

interface Applicant {
  first_name: string;
  last_name?: string;
  middle_name?: string;
  mobile?: string;
  email?: string;
  pan_number?: string;
}

interface ApplicantProfileCardProps {
  applicationId: string;
  applicantId?: string;
  orgId: string;
  applicant: Applicant;
  applicantName: string;
  panNumber?: string;
  aadhaarNumber?: string;
  mobile?: string;
  dateOfBirth?: string;
  gender?: string;
}

const DocumentCard = ({ 
  document, 
  onView 
}: { 
  document: Document; 
  onView: (url: string, name: string, isPdf: boolean) => void;
}) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const fetchSignedUrl = async () => {
      if (!document.file_path) {
        setLoading(false);
        setError(true);
        return;
      }

      try {
        if (document.file_path.startsWith("https://")) {
          setImageUrl(document.file_path);
        } else {
          const { data, error } = await supabase.storage
            .from('loan-documents')
            .createSignedUrl(document.file_path, 3600);
          if (error || !data) {
            setError(true);
          } else {
            setImageUrl(data.signedUrl);
          }
        }
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchSignedUrl();
  }, [document.file_path]);

  const getDocumentLabel = () => {
    const type = document.document_type?.toLowerCase() || '';
    if (type.includes('pan')) return 'PAN Card';
    if (type.includes('aadhaar') || type.includes('aadhar')) return 'Aadhaar Card';
    if (type.includes('employee') || type.includes('id card')) return 'Employee ID';
    return document.document_type || 'Document';
  };

  const isVerified = document.verification_status === 'verified';
  const isPdf = document.file_name?.toLowerCase().endsWith('.pdf');

  return (
    <div 
      className={cn(
        "relative flex-1 h-32 rounded-lg overflow-hidden cursor-pointer transition-all duration-200 border-2",
        isVerified 
          ? "border-green-500 shadow-[0_0_8px_rgba(34,197,94,0.3)]" 
          : "border-border hover:border-muted-foreground/50"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => imageUrl && onView(imageUrl, getDocumentLabel(), isPdf)}
    >
      {/* Document Content */}
      <div className="w-full h-full bg-muted flex items-center justify-center">
        {loading ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        ) : error || !imageUrl ? (
          <div className="flex flex-col items-center gap-1">
            <FileText className="h-10 w-10 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{getDocumentLabel()}</span>
          </div>
        ) : isPdf ? (
          <div className="flex flex-col items-center gap-1">
            <FileText className="h-10 w-10 text-red-500" />
            <span className="text-xs text-muted-foreground">{getDocumentLabel()}</span>
          </div>
        ) : (
          <img 
            src={imageUrl} 
            alt={getDocumentLabel()}
            className="w-full h-full object-cover"
            onError={() => setError(true)}
          />
        )}
      </div>

      {/* Verified Checkmark */}
      {isVerified && (
        <div className="absolute top-2 right-2 bg-green-500 rounded-full p-1">
          <CheckCircle className="h-4 w-4 text-white" />
        </div>
      )}

      {/* Label Overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
        <span className="text-xs font-medium text-white">{getDocumentLabel()}</span>
      </div>

      {/* Hover View Overlay */}
      {isHovered && imageUrl && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center transition-opacity">
          <div className="flex items-center gap-1.5 text-white bg-white/20 px-3 py-1.5 rounded-full backdrop-blur-sm">
            <Eye className="h-4 w-4" />
            <span className="text-sm font-medium">View</span>
          </div>
        </div>
      )}
    </div>
  );
};

// Verification Card for Video KYC and CIBIL
const VerificationCard = ({ 
  type,
  label,
  icon: Icon,
  verification,
  onClick
}: { 
  type: string;
  label: string;
  icon: React.ElementType;
  verification?: Verification;
  onClick: () => void;
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const isVerified = verification?.status === 'success';
  const hasRecording = !!(verification?.response_data as any)?.recording_url;
  const isViewable = isVerified || hasRecording;

  return (
    <div 
      className={cn(
        "relative flex-1 h-32 rounded-lg overflow-hidden cursor-pointer transition-all duration-200 border-2",
        isViewable 
          ? "border-green-500 shadow-[0_0_8px_rgba(34,197,94,0.3)]" 
          : "border-border hover:border-muted-foreground/50"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      {/* Card Content */}
      <div className="w-full h-full bg-muted flex flex-col items-center justify-center gap-2">
        <Icon className={cn("h-10 w-10", isViewable ? "text-green-500" : "text-muted-foreground")} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>

      {/* Verified Checkmark */}
      {isViewable && (
        <div className="absolute top-2 right-2 bg-green-500 rounded-full p-1">
          <CheckCircle className="h-4 w-4 text-white" />
        </div>
      )}

      {/* Label Overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
        <span className="text-xs font-medium text-white">{label}</span>
      </div>

      {/* Hover View Overlay */}
      {isHovered && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center transition-opacity">
          <div className="flex items-center gap-1.5 text-white bg-white/20 px-3 py-1.5 rounded-full backdrop-blur-sm">
            <Eye className="h-4 w-4" />
            <span className="text-sm font-medium">{isViewable ? 'View' : 'Start'}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export function ApplicantProfileCard({
  applicationId,
  applicantId,
  orgId,
  applicant,
  applicantName,
  panNumber,
  aadhaarNumber,
  mobile,
  dateOfBirth,
  gender,
}: ApplicantProfileCardProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerImage, setViewerImage] = useState<{ url: string; name: string; isPdf: boolean } | null>(null);
  
  const [cibilDialogOpen, setCibilDialogOpen] = useState(false);
  const [showRetryLinkDialog, setShowRetryLinkDialog] = useState(false);
  const [videoKYCViewOpen, setVideoKYCViewOpen] = useState(false);
  const [videoKYCRecordingUrl, setVideoKYCRecordingUrl] = useState<string | null>(null);
  const [whatsappDialogOpen, setWhatsappDialogOpen] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [callDialogOpen, setCallDialogOpen] = useState(false);

  const { data: unreadWhatsApp = 0 } = useUnreadWhatsApp(mobile);

  // Fetch verifications using React Query for proper cache invalidation
  const { data: verifications = [], isLoading: verificationsLoading } = useQuery({
    queryKey: ["loan-verifications", applicationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loan_verifications')
        .select('id, verification_type, status, verified_at, response_data, created_at')
        .eq('loan_application_id', applicationId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as Verification[];
    },
    enabled: !!applicationId,
    staleTime: 0, // Always fetch fresh data
    refetchOnWindowFocus: true, // Refetch when user returns to the tab
  });

  useEffect(() => {
    const fetchDocuments = async () => {
      // Fetch documents
      const { data: docData, error: docError } = await supabase
        .from('loan_documents')
        .select('id, document_type, document_category, file_path, file_name, verification_status')
        .eq('loan_application_id', applicationId)
        .in('document_category', ['identity', 'photo'])
        .order('created_at', { ascending: false });

      if (!docError && docData) {
        setDocuments(docData);
        
        // Find photo document
        const photoDoc = docData.find(d => 
          d.document_type?.toLowerCase().includes('photo') ||
          d.document_category?.toLowerCase().includes('photo')
        );
        
        if (photoDoc?.file_path) {
          if (photoDoc.file_path.startsWith("https://")) {
            setPhotoUrl(photoDoc.file_path);
          } else {
            const { data: signedData } = await supabase.storage
              .from('loan-documents')
              .createSignedUrl(photoDoc.file_path, 3600);
            if (signedData) {
              setPhotoUrl(signedData.signedUrl);
            }
          }
        }
      }

      setLoading(false);
    };

    fetchDocuments();
  }, [applicationId]);

  const handleViewDocument = async (url: string, name: string, isPdf: boolean = false) => {
    setViewerImage({ url, name, isPdf });
    setViewerOpen(true);
  };

  const getVerification = (type: string) => {
    // Filter all verifications of this type
    const typeVerifications = verifications.filter(v => v.verification_type === type);
    // Prioritize "success" status over other statuses
    const successVerification = typeVerifications.find(v => v.status === 'success');
    if (successVerification) return successVerification;
    // Fallback to the first (most recent due to ordering)
    return typeVerifications[0];
  };

  // Filter key documents (PAN and Aadhaar only)
  const panDoc = documents.find(d => d.document_type?.toLowerCase().includes('pan'));
  const aadhaarDoc = documents.find(d => 
    d.document_type?.toLowerCase().includes('aadhaar') || 
    d.document_type?.toLowerCase().includes('aadhar')
  );

  const keyDocs = [panDoc, aadhaarDoc].filter(Boolean) as Document[];
  const videoKycVerification = getVerification('video_kyc');
  const cibilVerification = getVerification('credit_bureau');

  // Handle Video KYC card click - show view dialog if completed, otherwise show retry link dialog
  const handleVideoKYCClick = async () => {
    // First try to find any completed recording URL
    let recordingUrl = (videoKycVerification?.response_data as any)?.recording_url;
    
    // If not in loan_verifications response_data, fetch from videokyc_recordings table
    if (!recordingUrl) {
      const { data: completedRecording } = await supabase
        .from('videokyc_recordings')
        .select('recording_url')
        .eq('application_id', applicationId)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      recordingUrl = completedRecording?.recording_url;
    }
    
    // If we have a recording URL, show the video viewer
    if (recordingUrl) {
      setVideoKYCRecordingUrl(recordingUrl);
      setVideoKYCViewOpen(true);
    } else {
      // No completed recording exists — show retry link dialog
      setShowRetryLinkDialog(true);
    }
  };

  return (
    <>
      <Card className="mb-3">
        <CardContent className="p-4">
          <div className="flex gap-6">
            {/* Left Side - Photo and Name */}
            <div className="flex-shrink-0 flex flex-col items-center gap-2">
              {/* Profile Photo - Circular */}
              <div className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center border-2 border-primary/20 bg-muted">
                {photoUrl ? (
                  <img 
                    src={photoUrl} 
                    alt={applicantName}
                    className="w-full h-full object-cover cursor-pointer"
                    onClick={() => photoUrl && handleViewDocument(photoUrl, 'Applicant Photo')}
                  />
                ) : (
                  <User className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              {/* Name and details below photo */}
              <div className="text-center max-w-[160px]">
                <h3 className="text-sm font-semibold leading-tight">{applicantName}</h3>
                {mobile && (
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center justify-center gap-1">
                    <Phone className="h-3 w-3" />
                    {mobile}
                  </p>
                )}
                {applicant.email && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center justify-center gap-1 truncate max-w-full cursor-default">
                        <Mail className="h-3 w-3 shrink-0" />
                        <span className="truncate">{applicant.email}</span>
                      </p>
                    </TooltipTrigger>
                    <TooltipContent>{applicant.email}</TooltipContent>
                  </Tooltip>
                )}
                {(applicant as any).office_email && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center justify-center gap-1 truncate max-w-full cursor-default">
                        <Mail className="h-3 w-3 shrink-0" />
                        <span className="truncate">{(applicant as any).office_email}</span>
                      </p>
                    </TooltipTrigger>
                    <TooltipContent>{(applicant as any).office_email} (Office)</TooltipContent>
                  </Tooltip>
                )}
                {panNumber && (
                  <p className="text-xs text-muted-foreground mt-0.5">{panNumber}</p>
                )}
              </div>
              
              {/* Communication Icons */}
              <div className="flex gap-2 mt-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="default" 
                      size="icon" 
                      className="h-9 w-9 bg-green-500 hover:bg-green-600 shadow-md relative"
                      onClick={() => setWhatsappDialogOpen(true)}
                      disabled={!mobile}
                    >
                      <MessageSquare className="h-5 w-5 text-white" />
                      {unreadWhatsApp > 0 && (
                        <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center">
                          {unreadWhatsApp > 9 ? '9+' : unreadWhatsApp}
                        </span>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {mobile ? "Send WhatsApp" : "No phone number available"}
                  </TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="default" 
                      size="icon" 
                      className="h-9 w-9 bg-blue-500 hover:bg-blue-600 shadow-md"
                      onClick={() => setEmailDialogOpen(true)}
                      disabled={!applicant.email}
                    >
                      <Mail className="h-5 w-5 text-white" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {applicant.email ? "Send Email" : "No email available"}
                  </TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="default" 
                      size="icon" 
                      className="h-9 w-9 bg-emerald-600 hover:bg-emerald-700 shadow-md"
                      onClick={() => setCallDialogOpen(true)}
                      disabled={!mobile}
                    >
                      <Phone className="h-5 w-5 text-white" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {mobile ? "Make a Call" : "No phone number available"}
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>

            {/* Right Side - Document Cards */}
            <div className="flex-1 flex gap-3">
              {loading ? (
                <div className="flex-1 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  {/* PAN Card */}
                  {panDoc ? (
                    <DocumentCard 
                      document={panDoc} 
                      onView={handleViewDocument}
                    />
                  ) : (
                    <div className="flex-1 h-32 flex flex-col items-center justify-center text-sm text-muted-foreground border-2 border-dashed rounded-lg">
                      <FileText className="h-8 w-8 mb-1" />
                      PAN Card
                    </div>
                  )}

                  {/* Aadhaar Card */}
                  {aadhaarDoc ? (
                    <DocumentCard 
                      document={aadhaarDoc} 
                      onView={handleViewDocument}
                    />
                  ) : (
                    <div className="flex-1 h-32 flex flex-col items-center justify-center text-sm text-muted-foreground border-2 border-dashed rounded-lg">
                      <FileText className="h-8 w-8 mb-1" />
                      Aadhaar Card
                    </div>
                  )}

                  {/* Video KYC - View Recording or Generate Retry Link */}
                  <VerificationCard
                    type="video_kyc"
                    label="Video KYC"
                    icon={Video}
                    verification={videoKycVerification}
                    onClick={handleVideoKYCClick}
                  />

                  {/* CIBIL Report */}
                  <VerificationCard
                    type="credit_bureau"
                    label="CIBIL Report"
                    icon={CreditCard}
                    verification={cibilVerification}
                    onClick={() => setCibilDialogOpen(true)}
                  />
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Document Viewer Dialog */}
      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{viewerImage?.name}</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center h-[75vh] overflow-auto">
            {viewerImage && (
              viewerImage.isPdf ? (
                <embed
                  src={viewerImage.url + "#toolbar=1&navpanes=0"}
                  type="application/pdf"
                  className="w-full h-full"
                />
              ) : (
                <img 
                  src={viewerImage.url} 
                  alt={viewerImage.name}
                  className="max-w-full max-h-[70vh] object-contain"
                />
              )
            )}
          </div>
        </DialogContent>
      </Dialog>


      {/* Video KYC View Dialog */}
      <VideoKYCViewDialog
        open={videoKYCViewOpen}
        onOpenChange={setVideoKYCViewOpen}
        recordingUrl={videoKYCRecordingUrl || ''}
        applicantName={applicantName}
        completedAt={videoKycVerification?.verified_at || undefined}
        applicationId={applicationId}
        orgId={orgId}
        applicantPhone={mobile}
        applicantEmail={applicant.email}
      />

      {/* Video KYC Retry Link Dialog (controlled mode) */}
      <VideoKYCRetryButton
        open={showRetryLinkDialog}
        onOpenChange={setShowRetryLinkDialog}
        showTrigger={false}
        applicationId={applicationId}
        orgId={orgId}
        applicantName={applicantName}
        applicantPhone={mobile}
      />

      {/* CIBIL Dialog */}
      <Suspense fallback={null}>
        <CreditBureauDialog
          open={cibilDialogOpen}
          onClose={() => setCibilDialogOpen(false)}
          applicationId={applicationId}
          orgId={orgId}
          applicant={applicant}
          existingVerification={verifications.find(v => v.verification_type === 'credit_bureau')}
        />
      </Suspense>

      {/* WhatsApp Chat Dialog */}
      {mobile && (
        <Suspense fallback={null}>
          <WhatsAppChatDialog
            open={whatsappDialogOpen}
            onOpenChange={setWhatsappDialogOpen}
            contactId={applicationId}
            contactName={applicantName}
            phoneNumber={mobile}
          />
        </Suspense>
      )}

      {/* Email Chat Dialog */}
      {applicant.email && (
        <EmailChatDialog
          open={emailDialogOpen}
          onOpenChange={setEmailDialogOpen}
          contactId={applicationId}
          contactName={applicantName}
          email={applicant.email}
        />
      )}

      {/* Call Chat Dialog */}
      {mobile && (
        <CallChatDialog
          open={callDialogOpen}
          onOpenChange={setCallDialogOpen}
          applicantId={applicantId || applicationId}
          applicationId={applicationId}
          applicantName={applicantName}
          phoneNumber={mobile}
        />
      )}
    </>
  );
}
