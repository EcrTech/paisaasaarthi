import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import {
  User,
  CreditCard,
  Landmark,
  FileText,
  Users,
  CheckCircle,
  Clock,
  IndianRupee,
  Calendar,
  Phone,
  Mail,
  MapPin,
} from "lucide-react";

interface ApplicationSummaryProps {
  applicationId: string;
  orgId: string;
}

export function ApplicationSummary({ applicationId, orgId }: ApplicationSummaryProps) {
  const { data: application } = useQuery({
    queryKey: ["application-summary", applicationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_applications")
        .select(`
          *,
          loan_applicants(*),
          loan_sanctions(*)
        `)
        .eq("id", applicationId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!applicationId,
  });

  const { data: verifications } = useQuery({
    queryKey: ["verifications-summary", applicationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_verifications")
        .select("*")
        .eq("loan_application_id", applicationId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!applicationId,
  });

  const { data: referrals } = useQuery({
    queryKey: ["loan-referrals", applicationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_referrals")
        .select("*")
        .eq("loan_application_id", applicationId);
      if (error) throw error;
      return data;
    },
    enabled: !!applicationId,
  });

  if (!application) return null;

  const primaryApplicant = application.loan_applicants?.[0];
  const sanction = application.loan_sanctions?.[0];
  const formatCurrency = (amount: number | null) => {
    if (!amount) return "N/A";
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatAddress = (address: any) => {
    if (!address) return "N/A";
    if (typeof address === "string") return address;
    return [address.line1, address.line2, address.city, address.state, address.pincode]
      .filter(Boolean)
      .join(", ") || "N/A";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Complete Application Summary
        </CardTitle>
        <CardDescription>
          Full details of the loan application for review
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Loan Details */}
        <div>
          <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <IndianRupee className="h-4 w-4" />
            Loan Details
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
            <div>
              <label className="text-xs text-muted-foreground">Application Number</label>
              <p className="text-sm font-mono">{application.application_number}</p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Requested Amount</label>
              <p className="text-sm font-semibold">{formatCurrency(application.requested_amount)}</p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Tenure</label>
              <p className="text-sm">{application.tenure_days} days</p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Status</label>
              <Badge variant="outline" className="capitalize">{application.status}</Badge>
            </div>
          </div>
        </div>

        <Separator />

        {/* Applicant Details */}
        {primaryApplicant && (
          <div>
            <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
              <User className="h-4 w-4" />
              Applicant Details
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
              <div>
                <label className="text-xs text-muted-foreground">Full Name</label>
                <p className="text-sm">
                  {primaryApplicant.first_name} {primaryApplicant.middle_name || ""} {primaryApplicant.last_name || ""}
                </p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Date of Birth</label>
                <p className="text-sm">
                  {primaryApplicant.dob
                    ? format(new Date(primaryApplicant.dob), "MMM dd, yyyy")
                    : "N/A"
                  }
                </p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Gender</label>
                <p className="text-sm capitalize">{primaryApplicant.gender || "N/A"}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Marital Status</label>
                <p className="text-sm capitalize">{primaryApplicant.marital_status || "N/A"}</p>
              </div>
              <div className="flex items-start gap-2">
                <CreditCard className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <label className="text-xs text-muted-foreground">PAN</label>
                  <p className="text-sm font-mono">{primaryApplicant.pan_number || "N/A"}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Phone className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <label className="text-xs text-muted-foreground">Mobile</label>
                  <p className="text-sm">{primaryApplicant.mobile || "N/A"}</p>
                </div>
              </div>
              <div className="flex items-start gap-2 md:col-span-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <label className="text-xs text-muted-foreground">Address</label>
                  <p className="text-sm">{formatAddress(primaryApplicant.current_address)}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        <Separator />

        {/* Bank Details */}
        {primaryApplicant?.bank_account_number && (
          <>
            <div>
              <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
                <Landmark className="h-4 w-4" />
                Bank Details
                {primaryApplicant.bank_verified && (
                  <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Verified
                  </Badge>
                )}
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <label className="text-xs text-muted-foreground">Account Holder</label>
                  <p className="text-sm">{primaryApplicant.bank_account_holder_name || "N/A"}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Account Number</label>
                  <p className="text-sm font-mono">****{primaryApplicant.bank_account_number?.slice(-4)}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">IFSC Code</label>
                  <p className="text-sm font-mono">{primaryApplicant.bank_ifsc_code || "N/A"}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Bank</label>
                  <p className="text-sm">{primaryApplicant.bank_name || "N/A"}</p>
                </div>
              </div>
            </div>
            <Separator />
          </>
        )}

        {/* Sanction Details */}
        {sanction && (
          <>
            <div>
              <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
                <CheckCircle className="h-4 w-4 text-green-600" />
                Sanction Details
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                <div>
                  <label className="text-xs text-muted-foreground">Sanctioned Amount</label>
                  <p className="text-sm font-semibold text-green-700 dark:text-green-400">
                    {formatCurrency(sanction.sanctioned_amount)}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Processing Fee</label>
                  <p className="text-sm">{formatCurrency(sanction.processing_fee || Math.round(sanction.sanctioned_amount * 0.10))}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">GST on Processing Fee (18%)</label>
                  <p className="text-sm">{formatCurrency(Math.round((sanction.processing_fee || Math.round(sanction.sanctioned_amount * 0.10)) * 0.18))}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Valid Until</label>
                  <p className="text-sm">
                    {sanction.validity_date ? format(new Date(sanction.validity_date), "MMM dd, yyyy") : "N/A"}
                  </p>
                </div>
              </div>
            </div>
            <Separator />
          </>
        )}

        {/* Referrals */}
        {(primaryApplicant?.professional_ref_name || primaryApplicant?.personal_ref_name || (referrals && referrals.length > 0)) && (
          <div>
            <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
              <Users className="h-4 w-4" />
              Referrals
            </h4>
            <div className="grid gap-3 md:grid-cols-2">
              {primaryApplicant?.professional_ref_name && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <Badge variant="outline" className="mb-2">Professional</Badge>
                  <p className="text-sm font-medium">{primaryApplicant.professional_ref_name}</p>
                  {primaryApplicant.professional_ref_mobile && (
                    <p className="text-xs text-muted-foreground">{primaryApplicant.professional_ref_mobile}</p>
                  )}
                </div>
              )}
              {primaryApplicant?.personal_ref_name && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <Badge variant="outline" className="mb-2">Personal</Badge>
                  <p className="text-sm font-medium">{primaryApplicant.personal_ref_name}</p>
                  {primaryApplicant.personal_ref_mobile && (
                    <p className="text-xs text-muted-foreground">{primaryApplicant.personal_ref_mobile}</p>
                  )}
                </div>
              )}
              {referrals?.map((ref: any) => (
                <div key={ref.id} className="p-3 bg-muted/50 rounded-lg">
                  <Badge variant="outline" className="mb-2 capitalize">{ref.referral_type}</Badge>
                  <p className="text-sm font-medium">{ref.name}</p>
                  {ref.relationship && <p className="text-xs text-muted-foreground">{ref.relationship}</p>}
                  {ref.mobile && <p className="text-xs text-muted-foreground">{ref.mobile}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
