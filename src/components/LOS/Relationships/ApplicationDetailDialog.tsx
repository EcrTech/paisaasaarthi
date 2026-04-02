import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { 
  FileText, 
  CheckCircle, 
  Clock, 
  XCircle,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ApplicationListItem } from "@/hooks/useApplicationsList";

interface ApplicationDetailDialogProps {
  application: ApplicationListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

import { LOAN_STAGES, PROGRESS_STAGES } from "@/constants/loanStages";

const stageConfig: Record<string, { label: string; color: string; order: number }> = Object.fromEntries(
  LOAN_STAGES.map((s) => [s.value, { label: s.label, color: s.color, order: s.order }]),
);

const stages = [...PROGRESS_STAGES];

export function ApplicationDetailDialog({ 
  application, 
  open, 
  onOpenChange 
}: ApplicationDetailDialogProps) {
  const navigate = useNavigate();

  if (!application) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const currentStageConfig = stageConfig[application.currentStage] || stageConfig.application;
  const currentStageOrder = currentStageConfig.order;
  const progressPercent = application.currentStage === "rejected" ? 0 : Math.round((currentStageOrder / 7) * 100);

  const handleViewApplication = () => {
    navigate(`/los/applications/${application.id}`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Application {application.applicationNumber}
            </span>
            <Button onClick={handleViewApplication} size="sm">
              <ExternalLink className="h-4 w-4 mr-1" />
              Open Application
            </Button>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh]">
          <div className="space-y-6 pr-4">
            {/* Status Badge */}
            <div className="flex items-center gap-3">
              <Badge className={`${currentStageConfig.color} text-white`}>
                {currentStageConfig.label}
              </Badge>
              {application.status === "rejected" && (
                <Badge variant="destructive">Rejected</Badge>
              )}
            </div>

            {/* Progress */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Stage Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <Progress value={progressPercent} className="h-3 mb-4" />
                <div className="flex items-center justify-between">
                  {stages.map((stage, index) => {
                    const stageOrder = stageConfig[stage].order;
                    const isComplete = currentStageOrder > stageOrder;
                    const isCurrent = application.currentStage === stage;
                    
                    return (
                      <div key={stage} className="flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center
                          ${isComplete ? 'bg-green-100' : isCurrent ? 'bg-amber-100' : 'bg-muted'}
                        `}>
                          {isComplete ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : isCurrent ? (
                            <Clock className="h-4 w-4 text-amber-600" />
                          ) : (
                            <Clock className="h-4 w-4 text-muted-foreground/40" />
                          )}
                        </div>
                        <span className="text-[10px] mt-1 text-muted-foreground">
                          {stageConfig[stage].label.slice(0, 4)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Applicant Info */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Applicant Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Name</p>
                    <p className="font-medium">{application.applicantName}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">PAN</p>
                    <p className="font-medium font-mono">{application.panNumber}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Mobile</p>
                    <p className="font-medium">{application.mobile}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Email</p>
                    <p className="font-medium">{application.email || "—"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Loan Details */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Loan Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Requested Amount</p>
                    <p className="font-semibold">{formatCurrency(application.requestedAmount)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Tenure</p>
                    <p className="font-medium">{application.tenureDays} days</p>
                  </div>
                  {application.approvedAmount && (
                    <div>
                      <p className="text-muted-foreground">Approved Amount</p>
                      <p className="font-semibold text-green-600">{formatCurrency(application.approvedAmount)}</p>
                    </div>
                  )}
                  {application.sanctionedAmount && (
                    <div>
                      <p className="text-muted-foreground">Sanctioned Amount</p>
                      <p className="font-semibold text-cyan-600">{formatCurrency(application.sanctionedAmount)}</p>
                    </div>
                  )}
                  {application.disbursedAmount && (
                    <div>
                      <p className="text-muted-foreground">Disbursed Amount</p>
                      <p className="font-semibold text-primary">{formatCurrency(application.disbursedAmount)}</p>
                    </div>
                  )}
                  {application.loanId && (
                    <div>
                      <p className="text-muted-foreground">Loan ID</p>
                      <p className="font-medium font-mono">{application.loanId}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Timeline */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Application Date</span>
                    <span className="font-medium">{format(new Date(application.createdAt), "dd MMM yyyy, hh:mm a")}</span>
                  </div>
                  {application.sanctionDate && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Sanction Date</span>
                      <span className="font-medium">{format(new Date(application.sanctionDate), "dd MMM yyyy")}</span>
                    </div>
                  )}
                  {application.disbursementDate && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Disbursement Date</span>
                      <span className="font-medium">{format(new Date(application.disbursementDate), "dd MMM yyyy")}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
