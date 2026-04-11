import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrgContext } from "@/hooks/useOrgContext";
import DashboardLayout from "@/components/Layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/common/LoadingState";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Check, Link2 } from "lucide-react";
import { toast } from "sonner";

const REFERRAL_BASE_URL = "https://paisaasaarthi.com/apply/ref";

export default function MyReferrals() {
  const { orgId } = useOrgContext();
  const [copied, setCopied] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id || null);
    });
  }, []);

  // Fetch or create referral code
  const { data: referralData, isLoading: referralLoading } = useQuery({
    queryKey: ["my-referral-code", userId, orgId],
    queryFn: async () => {
      // First try to get existing active code
      const { data: existing } = await supabase
        .from("user_referral_codes")
        .select("*")
        .eq("user_id", userId)
        .eq("org_id", orgId)
        .eq("is_active", true)
        .maybeSingle();

      if (existing) return existing;

      // Generate new code using database function
      const { data: codeResult } = await supabase.rpc("generate_referral_code", {
        p_user_id: userId,
      });

      // Create new referral code record
      const { data: newCode, error } = await supabase
        .from("user_referral_codes")
        .insert({
          user_id: userId,
          org_id: orgId,
          referral_code: codeResult || `REF-${Date.now().toString(36).toUpperCase()}`,
        })
        .select()
        .single();

      if (error) throw error;
      return newCode;
    },
    enabled: !!userId && !!orgId,
  });

  const referralLink = referralData?.referral_code
    ? `${REFERRAL_BASE_URL}/${referralData.referral_code}`
    : "";

  const handleCopyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success("Referral link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  if (referralLoading) {
    return (
      <DashboardLayout>
        <LoadingState message="Loading your referral info..." />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">My Referrals</h1>
          <p className="text-muted-foreground mt-1">
            Share your referral link to onboard loan applicants
          </p>
        </div>

        {/* Compact Referral Card */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-white rounded-lg border shrink-0">
                <QRCodeSVG value={referralLink} size={64} level="H" />
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium truncate">{referralLink}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Code:</span>
                  <span className="font-mono text-xs font-bold">{referralData?.referral_code}</span>
                </div>
              </div>
              <Button onClick={handleCopyLink} variant="outline" size="sm">
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                <span className="ml-2 hidden sm:inline">{copied ? "Copied" : "Copy"}</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}