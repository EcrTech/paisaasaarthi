import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrgContext } from "./useOrgContext";

export function useEMIStats() {
  const { orgId } = useOrgContext();

  return useQuery({
    queryKey: ["emi-stats", orgId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_emi_stats", { p_org_id: orgId });
      if (error) throw error;
      return data as {
        pendingEMIs: number;
        overdueEMIs: number;
        paidEMIs: number;
        totalExpected: number;
        totalCollected: number;
        collectionRate: number;
        upcomingEMIs: any[];
      };
    },
    enabled: !!orgId,
    refetchInterval: 60000,
  });
}
