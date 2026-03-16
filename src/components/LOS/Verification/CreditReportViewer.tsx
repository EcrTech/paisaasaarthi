import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  ChevronDown, 
  ChevronUp, 
  CreditCard, 
  Building2, 
  Calendar, 
  TrendingUp,
  AlertCircle,
  CheckCircle,
  XCircle,
  User,
  FileText,
  Search
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CreditReportViewerProps {
  data: {
    reportOrderNo: string;
    reportDate: string;
    creditScore: number;
    scoreType: string;
    scoreVersion?: string;
    hitCode: string;
    hitDescription: string;
    summary: {
      totalAccounts: number;
      activeAccounts: number;
      closedAccounts: number;
      writeOffAccounts: number;
      totalOutstanding: number;
      totalPastDue: number;
      totalSanctioned: number;
      oldestAccountDate?: string;
      recentAccountDate?: string;
      totalCreditLimit?: number;
      totalMonthlyPayment?: number;
    };
    accounts: Array<{
      institution: string;
      accountType: string;
      ownershipType: string;
      accountNumber: string;
      status: string;
      sanctionAmount: number;
      currentBalance: number;
      pastDueAmount: number;
      emiAmount: number;
      dateOpened: string;
      dateClosed?: string;
      dateReported?: string;
      paymentHistory: Array<{
        month: number;
        status: string;
        label: string;
        severity: "current" | "dpd" | "severe" | "writeoff";
      }>;
      rawHistory?: string;
    }>;
    enquiries: {
      total30Days: number;
      total90Days: number;
      totalAll: number;
      list: Array<{
        date: string;
        institution: string;
        purpose: string;
        amount: number;
      }>;
    };
    personalInfo: {
      name: string;
      dob: string;
      pan: string;
      gender: string;
      addresses?: string[];
      phones?: string[];
    };
    isMock?: boolean;
  };
}

function ScoreGauge({ score, maxScore = 900 }: { score: number; maxScore?: number }) {
  const percentage = (score / maxScore) * 100;
  const getScoreColor = () => {
    if (score >= 750) return "text-green-600";
    if (score >= 650) return "text-yellow-600";
    return "text-red-600";
  };
  
  const getScoreLabel = () => {
    if (score >= 750) return "Excellent";
    if (score >= 700) return "Good";
    if (score >= 650) return "Fair";
    if (score >= 550) return "Poor";
    return "Very Poor";
  };

  const getGradient = () => {
    if (score >= 750) return "from-green-500 to-green-600";
    if (score >= 650) return "from-yellow-500 to-yellow-600";
    return "from-red-500 to-red-600";
  };

  return (
    <div className="flex flex-col items-center space-y-2">
      <div className="relative w-40 h-20">
        {/* Background arc */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="w-40 h-40 rounded-full border-8 border-muted" 
               style={{ clipPath: "polygon(0 0, 100% 0, 100% 50%, 0 50%)" }} />
        </div>
        {/* Score arc */}
        <div className="absolute inset-0 overflow-hidden">
          <div 
            className={cn("w-40 h-40 rounded-full border-8 bg-gradient-to-r", getGradient())}
            style={{ 
              clipPath: "polygon(0 0, 100% 0, 100% 50%, 0 50%)",
              transform: `rotate(${-90 + (percentage * 1.8)}deg)`,
              transformOrigin: "center center"
            }} 
          />
        </div>
        {/* Score value */}
        <div className="absolute inset-0 flex items-end justify-center pb-1">
          <span className={cn("text-4xl font-bold", getScoreColor())}>{score}</span>
        </div>
      </div>
      <div className="text-center">
        <Badge variant="outline" className={cn("text-sm", getScoreColor())}>
          {getScoreLabel()}
        </Badge>
        <p className="text-xs text-muted-foreground mt-1">out of {maxScore}</p>
      </div>
    </div>
  );
}

function PaymentHistoryBar({ history }: { history: Array<{ month: number; status: string; severity: string; label?: string }> }) {
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "current": return "bg-green-500";
      case "dpd": return "bg-yellow-500";
      case "severe": return "bg-orange-500";
      case "writeoff": return "bg-red-600";
      default: return "bg-muted";
    }
  };

  // Show last 24 months
  const displayHistory = history.slice(0, 24);

  return (
    <div className="space-y-2">
      <div className="flex gap-0.5 flex-wrap">
        {displayHistory.map((item, idx) => (
          <div
            key={idx}
            className={cn("w-3 h-4 rounded-sm", getSeverityColor(item.severity))}
            title={`Month ${item.month}: ${item.label || item.status}`}
          />
        ))}
      </div>
      <div className="flex gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-sm bg-green-500" />
          <span>Current</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-sm bg-yellow-500" />
          <span>1-30 DPD</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-sm bg-orange-500" />
          <span>30-90 DPD</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-sm bg-red-600" />
          <span>Write-off</span>
        </div>
      </div>
    </div>
  );
}

function AccountCard({ account }: { account: CreditReportViewerProps["data"]["accounts"][0] }) {
  const [isOpen, setIsOpen] = useState(false);

  const getStatusColor = (status: string) => {
    const normalized = status.toLowerCase();
    if (normalized === "current" || normalized === "active") return "bg-green-500";
    if (normalized === "closed") return "bg-muted";
    if (normalized.includes("past due") || normalized.includes("dpd")) return "bg-yellow-500";
    if (normalized.includes("write") || normalized.includes("loss")) return "bg-red-500";
    return "bg-blue-500";
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <div className="p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">{account.institution}</p>
                <p className="text-sm text-muted-foreground">
                  {account.accountType} ({account.ownershipType})
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge className={cn("text-xs", getStatusColor(account.status))}>
                {account.status}
              </Badge>
              {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          </div>
          
          {/* Quick summary row */}
          <div className="flex gap-4 mt-2 text-sm">
            <div>
              <span className="text-muted-foreground">Balance: </span>
              <span className="font-medium">₹{account.currentBalance.toLocaleString()}</span>
            </div>
            {account.pastDueAmount > 0 && (
              <div className="text-red-600">
                <span>Past Due: </span>
                <span className="font-medium">₹{account.pastDueAmount.toLocaleString()}</span>
              </div>
            )}
            {account.emiAmount > 0 && (
              <div>
                <span className="text-muted-foreground">EMI: </span>
                <span className="font-medium">₹{account.emiAmount.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
      </CollapsibleTrigger>
      
      <CollapsibleContent>
        <div className="p-4 border border-t-0 rounded-b-lg bg-muted/30 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Account Number</p>
              <p className="font-medium">{account.accountNumber}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Sanctioned</p>
              <p className="font-medium">₹{account.sanctionAmount.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Date Opened</p>
              <p className="font-medium">{account.dateOpened || "N/A"}</p>
            </div>
            {account.dateClosed && (
              <div>
                <p className="text-muted-foreground">Date Closed</p>
                <p className="font-medium">{account.dateClosed}</p>
              </div>
            )}
          </div>

          {account.paymentHistory && account.paymentHistory.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">Payment History (Last 24 Months)</p>
              <PaymentHistoryBar history={account.paymentHistory} />
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function CreditReportViewer({ data }: CreditReportViewerProps) {
  const [showAllEnquiries, setShowAllEnquiries] = useState(false);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "N/A";
    try {
      return new Date(dateStr).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <ScrollArea className="h-[600px] pr-4">
      <div className="space-y-6">
        {/* Mock data warning */}
        {data.isMock && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-600" />
            <p className="text-sm text-amber-800">
              This is simulated data. Configure Equifax API credentials for live reports.
            </p>
          </div>
        )}

        {/* Personal Info & Score */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="h-5 w-5" />
                Applicant Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Name</span>
                <span className="font-medium">{data.personalInfo.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">PAN</span>
                <span className="font-medium">{data.personalInfo.pan || "N/A"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">DOB</span>
                <span className="font-medium">{formatDate(data.personalInfo.dob)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Report Date</span>
                <span className="font-medium">{formatDate(data.reportDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Report No</span>
                <span className="font-mono text-xs">{data.reportOrderNo}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Credit Score
              </CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center">
              <ScoreGauge score={data.creditScore} />
            </CardContent>
            <div className="px-6 pb-4 text-center">
              <p className="text-xs text-muted-foreground">
                {data.scoreType} {data.scoreVersion || "4.0"}
              </p>
            </div>
          </Card>
        </div>

        {/* Account Summary */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Account Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <p className="text-2xl font-bold">{data.summary.totalAccounts}</p>
                <p className="text-sm text-muted-foreground">Total Accounts</p>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <p className="text-2xl font-bold text-green-600">{data.summary.activeAccounts}</p>
                <p className="text-sm text-muted-foreground">Active</p>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <p className="text-2xl font-bold">{data.summary.closedAccounts}</p>
                <p className="text-sm text-muted-foreground">Closed</p>
              </div>
              {data.summary.writeOffAccounts > 0 && (
                <div className="text-center p-3 bg-red-50 rounded-lg">
                  <p className="text-2xl font-bold text-red-600">{data.summary.writeOffAccounts}</p>
                  <p className="text-sm text-muted-foreground">Write-offs</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
              <div className="p-3 border rounded-lg">
                <p className="text-sm text-muted-foreground">Total Outstanding</p>
                <p className="text-lg font-bold">₹{data.summary.totalOutstanding.toLocaleString()}</p>
              </div>
              <div className="p-3 border rounded-lg">
                <p className="text-sm text-muted-foreground">Total Past Due</p>
                <p className={cn("text-lg font-bold", data.summary.totalPastDue > 0 ? "text-red-600" : "")}>
                  ₹{data.summary.totalPastDue.toLocaleString()}
                </p>
              </div>
              <div className="p-3 border rounded-lg">
                <p className="text-sm text-muted-foreground">Total Sanctioned</p>
                <p className="text-lg font-bold">₹{data.summary.totalSanctioned.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Account Details */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Account Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.accounts.map((account, idx) => (
              <AccountCard key={idx} account={account} />
            ))}
          </CardContent>
        </Card>

        {/* Enquiries */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Search className="h-5 w-5" />
              Credit Enquiries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <p className="text-xl font-bold">{data.enquiries.total30Days}</p>
                <p className="text-xs text-muted-foreground">Last 30 Days</p>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <p className="text-xl font-bold">{data.enquiries.total90Days}</p>
                <p className="text-xs text-muted-foreground">Last 90 Days</p>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <p className="text-xl font-bold">{data.enquiries.totalAll}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>

            {data.enquiries.list.length > 0 && (
              <div className="space-y-2">
                {(showAllEnquiries ? data.enquiries.list : data.enquiries.list.slice(0, 5)).map((enq, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 border rounded-lg text-sm">
                    <div className="flex items-center gap-3">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{enq.institution}</p>
                        <p className="text-muted-foreground">{enq.purpose}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-muted-foreground">{formatDate(enq.date)}</p>
                      {enq.amount > 0 && (
                        <p className="font-medium">₹{enq.amount.toLocaleString()}</p>
                      )}
                    </div>
                  </div>
                ))}
                
                {data.enquiries.list.length > 5 && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full"
                    onClick={() => setShowAllEnquiries(!showAllEnquiries)}
                  >
                    {showAllEnquiries ? "Show Less" : `Show ${data.enquiries.list.length - 5} More`}
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}
