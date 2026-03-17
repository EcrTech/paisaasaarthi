import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

const WIDGET_SCRIPT_ID = "help-widget-script";
const WIDGET_SRC = "https://crm.in-sync.co.in/help-widget.js";

export function HelpWidget() {
  const { isAdmin, isLoading, userName, orgName } = useAuth();
  const [userEmail, setUserEmail] = useState<string>("");
  const queryClient = useQueryClient();

  // Fetch user email once
  useEffect(() => {
    if (isLoading || !isAdmin) return;
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.email) setUserEmail(data.user.email);
    });
  }, [isAdmin, isLoading]);

  useEffect(() => {
    if (isLoading) return;

    if (!isAdmin) {
      document.getElementById(WIDGET_SCRIPT_ID)?.remove();
      document.querySelectorAll('[id*="help-widget"], [class*="help-widget"]').forEach((el) => el.remove());
      return;
    }

    if (document.getElementById(WIDGET_SCRIPT_ID)) return;

    const script = document.createElement("script");
    script.id = WIDGET_SCRIPT_ID;
    script.src = WIDGET_SRC;
    script.setAttribute("data-source", "paisaa_saarthi");
    document.body.appendChild(script);

    return () => {
      document.getElementById(WIDGET_SCRIPT_ID)?.remove();
      document.querySelectorAll('[id*="help-widget"], [class*="help-widget"]').forEach((el) => el.remove());
    };
  }, [isAdmin, isLoading]);

  // Intercept fetch calls to detect ticket creation from the help widget
  useEffect(() => {
    if (isLoading || !isAdmin) return;

    const originalFetch = window.fetch;

    window.fetch = async function (...args) {
      const response = await originalFetch.apply(this, args);

      try {
        const url = typeof args[0] === "string" ? args[0] : (args[0] as Request)?.url;

        // Detect the widget's ticket submission endpoint
        if (url && url.includes("submit-help-ticket") && response.ok) {
          // Clone the response so we can read it without consuming it
          const cloned = response.clone();
          const data = await cloned.json();

          if (data?.ticket_number && data?.subject) {
            // Sync ticket to local crm_tickets table
            syncTicketLocally(data);
          }
        }
      } catch {
        // Silently ignore interception errors
      }

      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [isAdmin, isLoading, userName, userEmail, orgName]);

  // Sync ticket to local database via edge function
  const syncTicketLocally = async (ticketData: Record<string, unknown>) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) return;

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const url = `https://${projectId}.supabase.co/functions/v1/sync-help-ticket`;

      await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          ticket_number: ticketData.ticket_number,
          subject: ticketData.subject,
          description: ticketData.description || null,
          category: ticketData.category || "general",
          priority: ticketData.priority || "medium",
          contact_name: userName || null,
          contact_email: userEmail || null,
          contact_phone: null,
          source: "paisaa_saarthi",
        }),
      });

      // Invalidate support tickets query so the list refreshes
      queryClient.invalidateQueries({ queryKey: ["crm-tickets"] });
    } catch (err) {
      console.error("Failed to sync ticket locally:", err);
    }
  };

  // Auto-fill form fields when the widget overlay opens
  useEffect(() => {
    if (isLoading || !isAdmin) return;

    const fillFields = () => {
      const form = document.getElementById("insync-form") as HTMLFormElement | null;
      if (!form) return;

      const nameInput = form.querySelector('input[name="name"]') as HTMLInputElement | null;
      const emailInput = form.querySelector('input[name="email"]') as HTMLInputElement | null;
      const companyInput = form.querySelector('input[name="company_name"]') as HTMLInputElement | null;

      if (nameInput && !nameInput.value && userName) {
        nameInput.value = userName;
      }
      if (emailInput && !emailInput.value && userEmail) {
        emailInput.value = userEmail;
      }
      if (companyInput && !companyInput.value && orgName) {
        companyInput.value = orgName;
      }
    };

    const observer = new MutationObserver(() => {
      const overlay = document.getElementById("insync-help-overlay");
      if (overlay && overlay.classList.contains("open")) {
        setTimeout(fillFields, 50);
      }
    });

    const handleFabClick = () => {
      setTimeout(fillFields, 150);
    };

    const startObserving = () => {
      const overlay = document.getElementById("insync-help-overlay");
      if (overlay) {
        observer.observe(overlay, { attributes: true, attributeFilter: ["class"] });
      }
      const fab = document.getElementById("insync-help-fab");
      if (fab) {
        fab.addEventListener("click", handleFabClick);
      }
    };

    const interval = setInterval(() => {
      if (document.getElementById("insync-help-overlay")) {
        startObserving();
        clearInterval(interval);
      }
    }, 500);

    return () => {
      clearInterval(interval);
      observer.disconnect();
      const fab = document.getElementById("insync-help-fab");
      if (fab) {
        fab.removeEventListener("click", handleFabClick);
      }
    };
  }, [isAdmin, isLoading, userName, userEmail, orgName]);

  return null;
}
