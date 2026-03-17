import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Edit2, Save, X, Plus, Pencil } from "lucide-react";
import { toast } from "sonner";
import { ReferralDialog } from "@/components/LOS/ReferralDialog";

interface ReferralsSectionProps {
  primaryApplicant: any;
  applicationId: string;
  orgId: string;
  isEditingReferrals: boolean;
  setIsEditingReferrals: (value: boolean) => void;
  referralData: {
    professional_ref_name: string;
    professional_ref_mobile: string;
    professional_ref_email: string;
    professional_ref_address: string;
    personal_ref_name: string;
    personal_ref_mobile: string;
    personal_ref_email: string;
    personal_ref_address: string;
  };
  setReferralData: (data: any) => void;
  queryClient: any;
}

export function ReferralsSection({
  primaryApplicant,
  applicationId,
  orgId,
  isEditingReferrals,
  setIsEditingReferrals,
  referralData,
  setReferralData,
  queryClient,
}: ReferralsSectionProps) {
  useEffect(() => {
    if (primaryApplicant) {
      setReferralData({
        professional_ref_name: primaryApplicant.professional_ref_name || "",
        professional_ref_mobile: primaryApplicant.professional_ref_mobile || "",
        professional_ref_email: primaryApplicant.professional_ref_email || "",
        professional_ref_address: primaryApplicant.professional_ref_address || "",
        personal_ref_name: primaryApplicant.personal_ref_name || "",
        personal_ref_mobile: primaryApplicant.personal_ref_mobile || "",
        personal_ref_email: primaryApplicant.personal_ref_email || "",
        personal_ref_address: primaryApplicant.personal_ref_address || "",
      });
    }
  }, [
    primaryApplicant?.id,
    primaryApplicant?.professional_ref_name,
    primaryApplicant?.professional_ref_mobile,
    primaryApplicant?.professional_ref_email,
    primaryApplicant?.professional_ref_address,
    primaryApplicant?.personal_ref_name,
    primaryApplicant?.personal_ref_mobile,
    primaryApplicant?.personal_ref_email,
    primaryApplicant?.personal_ref_address,
    setReferralData,
  ]);

  const saveReferralsMutation = useMutation({
    mutationFn: async (data: typeof referralData) => {
      if (!primaryApplicant?.id) {
        throw new Error("No applicant record found");
      }
      const { error } = await supabase
        .from("loan_applicants")
        .update(data)
        .eq("id", primaryApplicant.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Referral information saved successfully");
      setIsEditingReferrals(false);
      queryClient.invalidateQueries({ queryKey: ["loan-application"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to save referral information");
    },
  });

  const handleSave = () => {
    saveReferralsMutation.mutate(referralData);
  };

  const handleCancel = () => {
    if (primaryApplicant) {
      setReferralData({
        professional_ref_name: primaryApplicant.professional_ref_name || "",
        professional_ref_mobile: primaryApplicant.professional_ref_mobile || "",
        professional_ref_email: primaryApplicant.professional_ref_email || "",
        professional_ref_address: primaryApplicant.professional_ref_address || "",
        personal_ref_name: primaryApplicant.personal_ref_name || "",
        personal_ref_mobile: primaryApplicant.personal_ref_mobile || "",
        personal_ref_email: primaryApplicant.personal_ref_email || "",
        personal_ref_address: primaryApplicant.personal_ref_address || "",
      });
    }
    setIsEditingReferrals(false);
  };

  const { data: additionalReferrals = [] } = useQuery({
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

  const [showReferralDialog, setShowReferralDialog] = useState(false);
  const [editingReferral, setEditingReferral] = useState<any>(null);

  const handleEditReferral = (ref: any) => {
    setEditingReferral(ref);
    setShowReferralDialog(true);
  };

  const handleAddReferral = () => {
    setEditingReferral(null);
    setShowReferralDialog(true);
  };

  const handleCloseReferralDialog = () => {
    setShowReferralDialog(false);
    setEditingReferral(null);
  };

  return (
    <div className="border-t pt-4 mt-4">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-medium text-muted-foreground">Referrals</h4>
        <div className="flex gap-2">
          {primaryApplicant && (
            <Button variant="outline" size="sm" onClick={handleAddReferral}>
              <Plus className="h-4 w-4 mr-1" />
              Add Referral
            </Button>
          )}
          {primaryApplicant && !isEditingReferrals && (
            <Button variant="ghost" size="sm" onClick={() => setIsEditingReferrals(true)}>
              <Edit2 className="h-4 w-4 mr-1" />
              Edit
            </Button>
          )}
          {isEditingReferrals && (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={handleCancel}>
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saveReferralsMutation.isPending}>
                <Save className="h-4 w-4 mr-1" />
                {saveReferralsMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          )}
        </div>
      </div>

      {primaryApplicant && (
        <ReferralDialog
          open={showReferralDialog}
          onClose={handleCloseReferralDialog}
          applicationId={applicationId}
          applicantId={primaryApplicant.id}
          orgId={orgId}
          referral={editingReferral}
        />
      )}

      {!primaryApplicant && (
        <p className="text-sm text-muted-foreground">No applicant record found. Referral information cannot be added.</p>
      )}

      {primaryApplicant && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Professional Reference */}
          <div className="p-4 rounded-lg border bg-muted/30">
            <h5 className="text-sm font-medium mb-3">Professional Reference</h5>
            <div className="space-y-2">
              {isEditingReferrals ? (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs">Name</Label>
                      <Input
                        value={referralData.professional_ref_name}
                        onChange={(e) => setReferralData({ ...referralData, professional_ref_name: e.target.value })}
                        placeholder="Enter name"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Mobile</Label>
                      <Input
                        value={referralData.professional_ref_mobile}
                        onChange={(e) => setReferralData({ ...referralData, professional_ref_mobile: e.target.value })}
                        placeholder="Enter mobile"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Email</Label>
                      <Input
                        type="email"
                        value={referralData.professional_ref_email}
                        onChange={(e) => setReferralData({ ...referralData, professional_ref_email: e.target.value })}
                        placeholder="Enter email"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Address</Label>
                    <Input
                      value={referralData.professional_ref_address}
                      onChange={(e) => setReferralData({ ...referralData, professional_ref_address: e.target.value })}
                      placeholder="Enter address"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs text-muted-foreground">Name</label>
                      <p className="text-sm">{primaryApplicant.professional_ref_name || "N/A"}</p>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Mobile</label>
                      <p className="text-sm">{primaryApplicant.professional_ref_mobile || "N/A"}</p>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Email</label>
                      <p className="text-sm">{primaryApplicant.professional_ref_email || "N/A"}</p>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Address</label>
                    <p className="text-sm">{primaryApplicant.professional_ref_address || "N/A"}</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Personal Reference */}
          <div className="p-4 rounded-lg border bg-muted/30">
            <h5 className="text-sm font-medium mb-3">Personal Reference</h5>
            <div className="space-y-2">
              {isEditingReferrals ? (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs">Name</Label>
                      <Input
                        value={referralData.personal_ref_name}
                        onChange={(e) => setReferralData({ ...referralData, personal_ref_name: e.target.value })}
                        placeholder="Enter name"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Mobile</Label>
                      <Input
                        value={referralData.personal_ref_mobile}
                        onChange={(e) => setReferralData({ ...referralData, personal_ref_mobile: e.target.value })}
                        placeholder="Enter mobile"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Email</Label>
                      <Input
                        type="email"
                        value={referralData.personal_ref_email}
                        onChange={(e) => setReferralData({ ...referralData, personal_ref_email: e.target.value })}
                        placeholder="Enter email"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Address</Label>
                    <Input
                      value={referralData.personal_ref_address}
                      onChange={(e) => setReferralData({ ...referralData, personal_ref_address: e.target.value })}
                      placeholder="Enter address"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs text-muted-foreground">Name</label>
                      <p className="text-sm">{primaryApplicant.personal_ref_name || "N/A"}</p>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Mobile</label>
                      <p className="text-sm">{primaryApplicant.personal_ref_mobile || "N/A"}</p>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Email</label>
                      <p className="text-sm">{primaryApplicant.personal_ref_email || "N/A"}</p>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Address</label>
                    <p className="text-sm">{primaryApplicant.personal_ref_address || "N/A"}</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Additional Referrals */}
          {additionalReferrals.length > 0 && (
            <div className="md:col-span-2 mt-4 pt-4 border-t">
              <h5 className="text-sm font-medium mb-3">Additional Referrals</h5>
              <div className="grid gap-3 md:grid-cols-2">
                {additionalReferrals.map((ref: any) => (
                  <div key={ref.id} className="p-3 rounded-lg border bg-muted/30">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="capitalize text-xs">{ref.referral_type}</Badge>
                        {ref.relationship && <span className="text-xs text-muted-foreground">({ref.relationship})</span>}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleEditReferral(ref)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm font-medium">{ref.name}</p>
                    {ref.mobile && <p className="text-xs text-muted-foreground">{ref.mobile}</p>}
                    {ref.email && <p className="text-xs text-muted-foreground">{ref.email}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
