import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useDecryptedApplicant(applicationId: string | undefined) {
  return useQuery({
    queryKey: ["applicant-decrypted", applicationId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_decrypted_applicant", {
        p_application_id: applicationId!,
      });
      if (error) {
        console.error("Error fetching decrypted applicant:", error);
        return null;
      }
      const row = Array.isArray(data) ? data[0] : data;
      return (row as Record<string, any>) || null;
    },
    enabled: !!applicationId,
  });
}
