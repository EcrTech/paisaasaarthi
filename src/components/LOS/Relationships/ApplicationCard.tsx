import { lazy, Suspense, useState } from "react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  Banknote,
  ArrowRight,
  MessageSquare,
} from "lucide-react";
import { ApplicationListItem } from "@/hooks/useApplicationsList";
const WhatsAppChatDialog = lazy(() => import("./WhatsAppChatDialog").then(m => ({ default: m.WhatsAppChatDialog })));

interface ApplicationCardProps {
  application: ApplicationListItem;
  onViewDetails: (application: ApplicationListItem) => void;
}

import { LOAN_STAGES, STAGE_LABELS, STAGE_COLORS, STAGE_ORDER, PROGRESS_STAGES } from "@/constants/loanStages";

const stageConfig: Record<string, { label: string; color: string; order: number }> = Object.fromEntries(
  LOAN_STAGES.map((s) => [s.value, { label: s.label, color: s.color, order: s.order }]),
);

const stages = [...PROGRESS_STAGES];

export function ApplicationCard({ application, onViewDetails }: ApplicationCardProps) {
  const [showWhatsAppChat, setShowWhatsAppChat] = useState(false);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const currentStageConfig = stageConfig[application.currentStage] || stageConfig.application;
  const currentStageOrder = currentStageConfig.order;
  const progressPercent = application.currentStage === "rejected" 
    ? 0 
    : Math.round((currentStageOrder / 7) * 100);

  const getStatusIcon = (isComplete: boolean, isCurrent: boolean) => {
    if (application.status === "rejected") return <XCircle className="h-4 w-4 text-red-500" />;
    if (isComplete) return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (isCurrent) return <Clock className="h-4 w-4 text-amber-500" />;
    return <Clock className="h-4 w-4 text-muted-foreground/40" />;
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          {/* Left: Application Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <span className="font-mono font-semibold text-foreground">
                  {application.applicationNumber}
                </span>
              </div>
              <Badge className={`${currentStageConfig.color} text-white`}>
                {currentStageConfig.label}
              </Badge>
            </div>

            {/* Applicant Info */}
            <div className="text-sm text-muted-foreground mb-3">
              <span className="font-medium text-foreground">{application.applicantName}</span>
              <span className="mx-2">•</span>
              <span className="font-mono">{application.panNumber}</span>
              <span className="mx-2">•</span>
              <span>{application.mobile}</span>
            </div>

            {/* Stage Progress */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Progress</span>
                <span>{progressPercent}%</span>
              </div>
              <Progress value={progressPercent} className="h-2" />
              
              {/* Stage Steps */}
              <div className="flex items-center gap-1 mt-2">
                {stages.map((stage, index) => {
                  const stageOrder = stageConfig[stage].order;
                  const isComplete = currentStageOrder > stageOrder;
                  const isCurrent = application.currentStage === stage;
                  
                  return (
                    <div key={stage} className="flex items-center">
                      <div 
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs
                          ${isComplete ? 'bg-green-100' : isCurrent ? 'bg-amber-100' : 'bg-muted'}
                        `}
                        title={stageConfig[stage].label}
                      >
                        {getStatusIcon(isComplete, isCurrent)}
                      </div>
                      {index < stages.length - 1 && (
                        <ArrowRight className={`h-3 w-3 mx-0.5 ${
                          isComplete ? 'text-green-500' : 'text-muted-foreground/30'
                        }`} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right: Amounts & Status */}
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Requested</p>
              <p className="font-semibold">{formatCurrency(application.requestedAmount)}</p>
            </div>
            
            {application.approvedAmount && (
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Approved</p>
                <p className="font-semibold text-green-600">
                  {formatCurrency(application.approvedAmount)}
                </p>
              </div>
            )}

            {application.disbursedAmount && (
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Disbursed</p>
                <p className="font-semibold text-primary">
                  {formatCurrency(application.disbursedAmount)}
                </p>
              </div>
            )}

            <div className="flex gap-1 mt-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowWhatsAppChat(true)}
                title="WhatsApp Chat"
                className="text-green-600 hover:text-green-700 hover:bg-green-50"
              >
                <MessageSquare className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onViewDetails(application)}
              >
                <Eye className="h-4 w-4 mr-1" />
                View
              </Button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              {application.isApproved ? (
                <CheckCircle className="h-3 w-3 text-green-500" />
              ) : (
                <Clock className="h-3 w-3" />
              )}
              Approved
            </span>
            <span className="flex items-center gap-1">
              {application.isSanctioned ? (
                <CheckCircle className="h-3 w-3 text-green-500" />
              ) : (
                <Clock className="h-3 w-3" />
              )}
              Sanctioned
            </span>
            <span className="flex items-center gap-1">
              {application.isDisbursed ? (
                <CheckCircle className="h-3 w-3 text-green-500" />
              ) : (
                <Clock className="h-3 w-3" />
              )}
              Disbursed
            </span>
          </div>
          <span>
            {format(new Date(application.createdAt), "dd MMM yyyy")}
          </span>
        </div>
      </CardContent>

      {/* WhatsApp Chat Dialog */}
      <Suspense fallback={null}>
        <WhatsAppChatDialog
          open={showWhatsAppChat}
          onOpenChange={setShowWhatsAppChat}
          contactId={application.id}
          contactName={application.applicantName}
          phoneNumber={application.mobile}
        />
      </Suspense>
    </Card>
  );
}
