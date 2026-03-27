import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useDecryptedApplicant(applicantId: string | undefined) {
  return useQuery({
    queryKey: ["applicant-decrypted", applicantId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_applicant_decrypted", {
        p_applicant_id: applicantId!,
      });
      if (error) {
        console.error("Error fetching decrypted applicant:", error);
        return null;
      }
      return data as Record<string, any> | null;
    },
    enabled: !!applicantId,
  });
}
