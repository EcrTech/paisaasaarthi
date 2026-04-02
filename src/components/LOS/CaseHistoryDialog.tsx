import { useState, useEffect } from "react";
import { format } from "date-fns";
import { STAGE_LABELS } from "@/constants/loanStages";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Phone, 
  Mail, 
  MessageSquare, 
  GitBranch,
  Clock,
  User,
  CheckCheck,
  Check,
  Eye,
  AlertCircle,
  PhoneCall,
  PhoneMissed,
  PhoneOff,
  Loader2,
  History,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { CallRecordingPlayer } from "@/components/Contact/CallRecordingPlayer";

interface CaseHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicationId: string;
  orgId: string;
  applicantName: string;
  applicantPhone?: string;
  applicantEmail?: string;
}

interface TimelineItem {
  id: string;
  type: 'call' | 'email' | 'whatsapp' | 'stage';
  timestamp: string;
  data: any;
}

export function CaseHistoryDialog({
  open,
  onOpenChange,
  applicationId,
  orgId,
  applicantName,
  applicantPhone,
  applicantEmail,
}: CaseHistoryDialogProps) {
  const [activeTab, setActiveTab] = useState("all");

  // Format phone number for queries
  const formatPhoneForQuery = (phone: string) => {
    let digits = phone.replace(/[^\d]/g, '');
    if (digits.length === 10) {
      digits = '91' + digits;
    }
    return '+' + digits;
  };

  const formattedPhone = applicantPhone ? formatPhoneForQuery(applicantPhone) : null;

  // Fetch call logs
  const { data: callLogs = [], isLoading: callsLoading } = useQuery({
    queryKey: ["case-history-calls", applicationId, formattedPhone],
    queryFn: async () => {
      if (!formattedPhone) return [];
      
      const { data, error } = await supabase
        .from('call_logs')
        .select(`
          id, exotel_call_sid, call_type, direction, from_number, to_number, 
          status, call_duration, recording_url, notes, started_at, ended_at, created_at,
          agent:profiles!call_logs_agent_id_fkey(first_name, last_name),
          call_disposition:call_dispositions!call_logs_disposition_id_fkey(name)
        `)
        .eq('org_id', orgId)
        .or(`to_number.eq.${formattedPhone},from_number.eq.${formattedPhone},loan_application_id.eq.${applicationId}`)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Error fetching call logs:', error);
        return [];
      }
      return data || [];
    },
    enabled: open && !!formattedPhone,
  });

  // Fetch email conversations
  const { data: emails = [], isLoading: emailsLoading } = useQuery({
    queryKey: ["case-history-emails", applicationId, applicantEmail],
    queryFn: async () => {
      if (!applicantEmail) return [];
      
      const { data, error } = await supabase
        .from('email_conversations')
        .select('id, direction, subject, email_content, from_email, to_email, status, sent_at, received_at, created_at, opened_at')
        .eq('org_id', orgId)
        .or(`to_email.eq.${applicantEmail},from_email.eq.${applicantEmail}`)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Error fetching emails:', error);
        return [];
      }
      return data || [];
    },
    enabled: open && !!applicantEmail,
  });

  // Fetch WhatsApp messages
  const { data: whatsappMessages = [], isLoading: whatsappLoading } = useQuery({
    queryKey: ["case-history-whatsapp", formattedPhone],
    queryFn: async () => {
      if (!formattedPhone) return [];
      
      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('id, direction, message_content, sent_at, status, phone_number, created_at')
        .eq('phone_number', formattedPhone)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Error fetching WhatsApp messages:', error);
        return [];
      }
      return data || [];
    },
    enabled: open && !!formattedPhone,
  });

  // Fetch stage history
  const { data: stageHistory = [], isLoading: stageLoading } = useQuery({
    queryKey: ["case-history-stages", applicationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loan_stage_history')
        .select(`
          id, from_stage, to_stage, changed_at, notes,
          changed_by:profiles!loan_stage_history_changed_by_fkey(first_name, last_name)
        `)
        .eq('loan_application_id', applicationId)
        .order('changed_at', { ascending: false });

      if (error) {
        console.error('Error fetching stage history:', error);
        return [];
      }
      return data || [];
    },
    enabled: open,
  });

  // Combine all items into a timeline
  const timelineItems: TimelineItem[] = [
    ...callLogs.map((call: any) => ({
      id: `call-${call.id}`,
      type: 'call' as const,
      timestamp: call.started_at || call.created_at,
      data: call,
    })),
    ...emails.map((email: any) => ({
      id: `email-${email.id}`,
      type: 'email' as const,
      timestamp: email.sent_at || email.received_at || email.created_at,
      data: email,
    })),
    ...whatsappMessages.map((msg: any) => ({
      id: `whatsapp-${msg.id}`,
      type: 'whatsapp' as const,
      timestamp: msg.sent_at || msg.created_at,
      data: msg,
    })),
    ...stageHistory.map((stage: any) => ({
      id: `stage-${stage.id}`,
      type: 'stage' as const,
      timestamp: stage.changed_at,
      data: stage,
    })),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const filteredItems = activeTab === 'all' 
    ? timelineItems 
    : timelineItems.filter(item => item.type === activeTab);

  const isLoading = callsLoading || emailsLoading || whatsappLoading || stageLoading;

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const stripHtml = (html: string) => {
    const temp = document.createElement('div');
    temp.innerHTML = html;
    return temp.textContent || temp.innerText || '';
  };

  // STAGE_LABELS imported from @/constants/loanStages

  const renderTimelineItem = (item: TimelineItem) => {
    switch (item.type) {
      case 'call':
        return (
          <div className="flex gap-3">
            <div className={`p-2 rounded-full ${
              item.data.status === 'completed' ? 'bg-green-100 dark:bg-green-900' : 'bg-yellow-100 dark:bg-yellow-900'
            }`}>
              {item.data.status === 'completed' ? (
                <PhoneCall className="h-4 w-4 text-green-600" />
              ) : item.data.status === 'busy' || item.data.status === 'no-answer' ? (
                <PhoneMissed className="h-4 w-4 text-yellow-600" />
              ) : (
                <PhoneOff className="h-4 w-4 text-red-600" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <p className="font-medium text-sm">
                  {item.data.direction === 'outgoing-api' ? 'Outgoing' : 'Incoming'} Call
                </p>
                <Badge variant={item.data.status === 'completed' ? 'default' : 'secondary'} className="text-xs">
                  {item.data.status}
                </Badge>
              </div>
              {item.data.agent && (
                <p className="text-xs text-muted-foreground">
                  By {item.data.agent.first_name} {item.data.agent.last_name || ''}
                </p>
              )}
              <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                {item.data.call_duration && (
                  <span>Duration: {formatDuration(item.data.call_duration)}</span>
                )}
                {item.data.call_disposition && (
                  <Badge variant="outline" className="text-xs">{item.data.call_disposition.name}</Badge>
                )}
              </div>
              {item.data.notes && (
                <p className="text-xs text-muted-foreground mt-1 italic">"{item.data.notes}"</p>
              )}
              {item.data.recording_url && (
                <div className="mt-2">
                  <CallRecordingPlayer callLogId={item.data.id} variant="outline" />
                </div>
              )}
            </div>
          </div>
        );

      case 'email':
        return (
          <div className="flex gap-3">
            <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900">
              <Mail className="h-4 w-4 text-blue-600" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <p className="font-medium text-sm">
                  {item.data.direction === 'outbound' ? 'Sent Email' : 'Received Email'}
                </p>
                <div className="flex items-center gap-1">
                  {item.data.opened_at && (
                    <Eye className="h-3 w-3 text-blue-500" />
                  )}
                  {item.data.status === 'delivered' && !item.data.opened_at && (
                    <CheckCheck className="h-3 w-3 text-muted-foreground" />
                  )}
                  {item.data.status === 'sent' && (
                    <Check className="h-3 w-3 text-muted-foreground" />
                  )}
                  {item.data.status === 'failed' && (
                    <AlertCircle className="h-3 w-3 text-red-500" />
                  )}
                </div>
              </div>
              <p className="text-sm font-medium text-blue-600">{item.data.subject}</p>
              <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                {stripHtml(item.data.email_content || '')}
              </p>
            </div>
          </div>
        );

      case 'whatsapp':
        return (
          <div className="flex gap-3">
            <div className="p-2 rounded-full bg-green-100 dark:bg-green-900">
              <MessageSquare className="h-4 w-4 text-green-600" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <p className="font-medium text-sm">
                  {item.data.direction === 'outbound' ? 'Sent WhatsApp' : 'Received WhatsApp'}
                </p>
                {item.data.status === 'read' && <CheckCheck className="h-3 w-3 text-blue-500" />}
                {item.data.status === 'delivered' && <CheckCheck className="h-3 w-3 text-muted-foreground" />}
                {item.data.status === 'sent' && <Check className="h-3 w-3 text-muted-foreground" />}
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                {item.data.message_content}
              </p>
            </div>
          </div>
        );

      case 'stage':
        return (
          <div className="flex gap-3">
            <div className="p-2 rounded-full bg-purple-100 dark:bg-purple-900">
              <GitBranch className="h-4 w-4 text-purple-600" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-sm">Stage Changed</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs">
                  {STAGE_LABELS[item.data.from_stage] || item.data.from_stage || 'New'}
                </Badge>
                <span className="text-xs text-muted-foreground">→</span>
                <Badge variant="default" className="text-xs">
                  {STAGE_LABELS[item.data.to_stage] || item.data.to_stage}
                </Badge>
              </div>
              {item.data.changed_by && (
                <p className="text-xs text-muted-foreground mt-1">
                  By {item.data.changed_by.first_name} {item.data.changed_by.last_name || ''}
                </p>
              )}
              {item.data.notes && (
                <p className="text-xs text-muted-foreground italic mt-1">"{item.data.notes}"</p>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[80vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-4 py-3 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-primary/10">
              <History className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle>Case History</DialogTitle>
              <p className="text-sm text-muted-foreground">{applicantName}</p>
            </div>
            <Badge variant="outline" className="ml-auto">
              {timelineItems.length} interactions
            </Badge>
          </div>
        </DialogHeader>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="w-full justify-start rounded-none border-b px-4 h-auto py-2">
            <TabsTrigger value="all" className="text-xs">
              All ({timelineItems.length})
            </TabsTrigger>
            <TabsTrigger value="call" className="text-xs">
              <Phone className="h-3 w-3 mr-1" />
              Calls ({callLogs.length})
            </TabsTrigger>
            <TabsTrigger value="email" className="text-xs">
              <Mail className="h-3 w-3 mr-1" />
              Emails ({emails.length})
            </TabsTrigger>
            <TabsTrigger value="whatsapp" className="text-xs">
              <MessageSquare className="h-3 w-3 mr-1" />
              WhatsApp ({whatsappMessages.length})
            </TabsTrigger>
            <TabsTrigger value="stage" className="text-xs">
              <GitBranch className="h-3 w-3 mr-1" />
              Stages ({stageHistory.length})
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1">
            <TabsContent value={activeTab} className="m-0 p-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                  <History className="h-10 w-10 mb-2 opacity-50" />
                  <p>No interactions found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredItems.map((item) => (
                    <div key={item.id} className="relative pl-4 border-l-2 border-border">
                      <div className="absolute -left-[5px] top-2 w-2 h-2 rounded-full bg-border" />
                      <div className="bg-card rounded-lg p-3 shadow-sm border">
                        <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {item.timestamp && format(new Date(item.timestamp), "MMM d, yyyy 'at' HH:mm")}
                        </div>
                        {renderTimelineItem(item)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
