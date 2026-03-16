import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/Layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Phone, MessageCircle, Mail, User, Building, MapPin, Calendar, Tag, Loader2, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useOrgContext } from "@/hooks/useOrgContext";
import { useNotification } from "@/hooks/useNotification";
import { WhatsAppChatDialog } from "@/components/LOS/Relationships/WhatsAppChatDialog";
import { useUnreadWhatsApp } from "@/hooks/useUnreadWhatsApp";
import { format } from "date-fns";

export default function CallingLeadDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { orgId } = useOrgContext();
  const notify = useNotification();
  const queryClient = useQueryClient();

  const [notes, setNotes] = useState("");
  const [notesLoaded, setNotesLoaded] = useState(false);
  const [whatsappOpen, setWhatsappOpen] = useState(false);

  // Fetch contact
  const { data: contact, isLoading } = useQuery({
    queryKey: ["calling-lead", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      if (!notesLoaded) {
        setNotes(data.notes || "");
        setNotesLoaded(true);
      }
      return data;
    },
    enabled: !!id,
  });

  const { data: unreadWhatsApp = 0 } = useUnreadWhatsApp(contact?.phone);

  // Fetch call logs
  const { data: callLogs = [] } = useQuery({
    queryKey: ["lead-calls", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("call_logs")
        .select("id, created_at, status, direction, call_duration, from_number, to_number, notes")
        .eq("contact_id", id!)
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
    enabled: !!id,
  });

  // Fetch whatsapp messages
  const { data: whatsappMsgs = [] } = useQuery({
    queryKey: ["lead-whatsapp", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("whatsapp_messages")
        .select("id, created_at, direction, media_type, message_content, status")
        .eq("contact_id", id!)
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
    enabled: !!id,
  });

  // Fetch email conversations
  const { data: emails = [] } = useQuery({
    queryKey: ["lead-emails", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("email_conversations")
        .select("id, created_at, subject, status, direction")
        .eq("contact_id", id!)
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
    enabled: !!id,
  });

  // Save notes
  const saveNotes = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("contacts").update({ notes }).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      notify.success("Saved", "Notes updated");
      queryClient.invalidateQueries({ queryKey: ["calling-lead", id] });
    },
    onError: (err: any) => notify.error("Error", err.message),
  });

  // Build timeline
  const timeline = [
    ...callLogs.map((c) => ({
      type: "call" as const,
      timestamp: c.created_at,
      icon: Phone,
      title: `${c.direction === "inbound" ? "Incoming" : "Outgoing"} Call`,
      detail: `${c.status}${c.call_duration ? ` · ${c.call_duration}s` : ""}`,
      note: c.notes,
    })),
    ...whatsappMsgs.map((w) => ({
      type: "whatsapp" as const,
      timestamp: w.created_at,
      icon: MessageCircle,
      title: `WhatsApp ${w.direction === "inbound" ? "Received" : "Sent"}`,
      detail: w.message_content?.slice(0, 80) || w.media_type || "",
      note: null,
    })),
    ...emails.map((e) => ({
      type: "email" as const,
      timestamp: e.created_at,
      icon: Mail,
      title: `Email ${e.direction === "inbound" ? "Received" : "Sent"}`,
      detail: e.subject || "",
      note: null,
    })),
  ].sort((a, b) => new Date(b.timestamp!).getTime() - new Date(a.timestamp!).getTime());

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!contact) {
    return (
      <DashboardLayout>
        <div className="text-center py-20 text-muted-foreground">Lead not found</div>
      </DashboardLayout>
    );
  }

  const displayName = `${contact.first_name} ${contact.last_name || ""}`.trim();

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold">{displayName}</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href={`tel:${contact.phone}`}>
                <Phone className="h-4 w-4 mr-1" /> Call
              </a>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-green-600 relative"
              onClick={() => setWhatsappOpen(true)}
            >
              <MessageCircle className="h-4 w-4 mr-1" /> WhatsApp
              {unreadWhatsApp > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center">
                  {unreadWhatsApp > 9 ? '9+' : unreadWhatsApp}
                </span>
              )}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left: Contact Info */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-base">Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <InfoRow icon={Phone} label="Phone" value={contact.phone} />
              {contact.email && <InfoRow icon={Mail} label="Email" value={contact.email} />}
              {contact.company && <InfoRow icon={Building} label="Company" value={contact.company} />}
              {contact.city && <InfoRow icon={MapPin} label="City" value={contact.city} />}
              <InfoRow icon={Tag} label="Source" value={contact.source || "—"} />
              <InfoRow
                icon={Calendar}
                label="Created"
                value={contact.created_at ? format(new Date(contact.created_at), "dd MMM yyyy") : "—"}
              />
              {contact.assigned_to && <InfoRow icon={User} label="Assigned" value={contact.assigned_to} />}
            </CardContent>
          </Card>

          {/* Right: Activities & Notes */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="journey">
              <TabsList>
                <TabsTrigger value="journey">Journey</TabsTrigger>
                <TabsTrigger value="notes">Notes</TabsTrigger>
              </TabsList>

              <TabsContent value="journey" className="mt-3">
                {timeline.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground text-sm">
                    No communication history yet
                  </div>
                ) : (
                  <div className="space-y-0 relative">
                    <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
                    {timeline.map((item, idx) => (
                      <div key={idx} className="relative pl-10 pb-4">
                        <div
                          className={`absolute left-2.5 top-1 h-3 w-3 rounded-full border-2 border-background ${
                            item.type === "call"
                              ? "bg-blue-500"
                              : item.type === "whatsapp"
                              ? "bg-green-500"
                              : "bg-orange-500"
                          }`}
                        />
                        <div className="text-sm">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{item.title}</span>
                            <span className="text-xs text-muted-foreground">
                              {item.timestamp ? format(new Date(item.timestamp), "dd MMM yyyy, HH:mm") : ""}
                            </span>
                          </div>
                          {item.detail && (
                            <p className="text-muted-foreground text-xs mt-0.5">{item.detail}</p>
                          )}
                          {item.note && (
                            <p className="text-xs mt-1 italic text-muted-foreground">{item.note}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="notes" className="mt-3 space-y-3">
                <Textarea
                  placeholder="Add notes about this lead..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={6}
                />
                <Button
                  size="sm"
                  onClick={() => saveNotes.mutate()}
                  disabled={saveNotes.isPending}
                >
                  {saveNotes.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Save className="h-4 w-4 mr-1" />
                  )}
                  Save Notes
                </Button>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {/* WhatsApp Dialog */}
      <WhatsAppChatDialog
        open={whatsappOpen}
        onOpenChange={setWhatsappOpen}
        contactId={contact.id}
        contactName={displayName}
        phoneNumber={contact.phone}
      />
    </DashboardLayout>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div>
        <div className="text-muted-foreground text-xs">{label}</div>
        <div>{value}</div>
      </div>
    </div>
  );
}
