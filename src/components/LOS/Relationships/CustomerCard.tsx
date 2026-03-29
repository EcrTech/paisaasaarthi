import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Eye,
  RefreshCw,
  MessageSquare,
  AlertCircle,
} from "lucide-react";
import { CustomerRelationship } from "@/hooks/useCustomerRelationships";
import { lazy, Suspense, useState } from "react";
const WhatsAppChatDialog = lazy(() => import("./WhatsAppChatDialog").then(m => ({ default: m.WhatsAppChatDialog })));

interface CustomerCardProps {
  customer: CustomerRelationship;
  onViewDetails: (customer: CustomerRelationship) => void;
  onShareReferralLink: () => void;
}

export function CustomerCard({ customer, onViewDetails, onShareReferralLink }: CustomerCardProps) {
  const [showWhatsAppChat, setShowWhatsAppChat] = useState(false);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const initials = customer.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex gap-4">
          <div className="flex-shrink-0">
            <Avatar className="h-16 w-16 border-2 border-border">
              <AvatarFallback className="text-lg bg-primary/10 text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-foreground truncate">{customer.name}</h3>
                <p className="text-sm text-muted-foreground">{customer.mobile}</p>
              </div>
              {customer.overdueLoans > 0 && (
                <div className="flex items-center gap-1 text-red-600 text-xs font-medium">
                  <AlertCircle className="h-3 w-3" />
                  {customer.overdueLoans} overdue
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-sm">
              <div>
                <span className="text-muted-foreground">Applications:</span>
                <p className="font-medium">{customer.totalApplications}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Loans:</span>
                <p className="font-medium">{customer.totalLoans}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Disbursed:</span>
                <p className="font-medium">{formatCurrency(customer.disbursedAmount)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Outstanding:</span>
                <p className={`font-medium ${customer.outstandingAmount > 0 ? 'text-orange-600' : ''}`}>
                  {formatCurrency(customer.outstandingAmount)}
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-1 flex-shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onViewDetails(customer)}
              title="View Details"
            >
              <Eye className="h-4 w-4" />
            </Button>
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
              size="icon"
              onClick={onShareReferralLink}
              title="Share Referral Link"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
          <span>ID: {customer.customerId}</span>
          <span>
            Last: {customer.lastActivityDate
              ? format(new Date(customer.lastActivityDate), "dd MMM yyyy")
              : "—"}
          </span>
        </div>
      </CardContent>

      <Suspense fallback={null}>
        <WhatsAppChatDialog
          open={showWhatsAppChat}
          onOpenChange={setShowWhatsAppChat}
          contactId={customer.customerId}
          contactName={customer.name}
          phoneNumber={customer.mobile}
        />
      </Suspense>
    </Card>
  );
}
