import { useState, useEffect, useRef, useCallback } from "react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Send, 
  CheckCheck, 
  Check, 
  Clock, 
  AlertCircle,
  Loader2,
  Phone,
  FileText,
  Video,
  Volume2,
  ImageIcon,
  Paperclip,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface WhatsAppMessage {
  id: string;
  direction: string;
  message_content: string;
  sent_at: string | null;
  status: string;
  phone_number: string;
  created_at: string | null;
  media_url: string | null;
  media_type: string | null;
}

interface WhatsAppChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string;
  contactName: string;
  phoneNumber: string;
}

const CONVERSATION_TEMPLATE = {
  name: "conversation",
  language: "en",
  content: `Hello

I have a few clarifications to seek about your application. Are you available now?

team PaisaaSaarthi`,
  buttons: [
    { type: "quick_reply", text: "Yes, I am available" }
  ]
};

export function WhatsAppChatDialog({
  open,
  onOpenChange,
  contactId,
  contactName,
  phoneNumber,
}: WhatsAppChatDialogProps) {
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [autoSendTriggered, setAutoSendTriggered] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Format phone number for queries - ensure country code is present
  const formatPhoneForQuery = (phone: string) => {
    let digits = phone.replace(/[^\d]/g, '');
    // If 10 digits (Indian local), prepend 91
    if (digits.length === 10) {
      digits = '91' + digits;
    }
    return '+' + digits;
  };
  
  const formattedPhone = formatPhoneForQuery(phoneNumber);

  // Scroll to bottom when messages change
  const scrollToBottom = useCallback(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Fetch existing messages
  const fetchMessages = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('id, direction, message_content, sent_at, status, phone_number, created_at, media_url, media_type')
        .eq('phone_number', formattedPhone)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching messages:', error);
        return;
      }

      setMessages(data || []);

      // Mark all inbound messages as read
      const unreadIds = (data || [])
        .filter(m => m.direction === 'inbound')
        .map(m => m.id);
      if (unreadIds.length > 0) {
        await supabase
          .from('whatsapp_messages')
          .update({ is_read: true } as any)
          .in('id', unreadIds);
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching messages:', error);
      return [];
    } finally {
      setLoading(false);
    }
  }, [formattedPhone]);

  // Send the conversation template
  const sendConversationTemplate = useCallback(async () => {
    if (sending || autoSendTriggered) return;
    
    setAutoSendTriggered(true);
    setSending(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session?.access_token) {
        throw new Error('Not authenticated');
      }

      const response = await supabase.functions.invoke('send-whatsapp-message', {
        body: {
          contactId,
          phoneNumber: formattedPhone,
          templateName: CONVERSATION_TEMPLATE.name,
          message: CONVERSATION_TEMPLATE.content,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to send message');
      }

      toast({
        title: "Message sent",
        description: "Conversation template sent successfully",
      });

      // Refresh messages to show the sent one
      await fetchMessages();
    } catch (error) {
      console.error('Error sending template:', error);
      toast({
        title: "Failed to send",
        description: error instanceof Error ? error.message : "Could not send message",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  }, [contactId, formattedPhone, sending, autoSendTriggered, toast, fetchMessages]);

  // Check if session window is active (24 hours from last inbound message)
  const isSessionActive = useCallback(() => {
    const lastInbound = messages
      .filter(m => m.direction === 'inbound')
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())[0];
    
    if (!lastInbound?.created_at) return false;
    
    const lastInboundTime = new Date(lastInbound.created_at).getTime();
    const now = Date.now();
    const hoursDiff = (now - lastInboundTime) / (1000 * 60 * 60);
    
    return hoursDiff < 24;
  }, [messages]);

  // Helper to determine media type from MIME type
  const getMediaType = (mimeType: string): 'image' | 'document' | 'video' | 'audio' => {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    return 'document';
  };

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Check file size (16MB limit for most WhatsApp media)
    const maxSize = 16 * 1024 * 1024; // 16MB
    if (file.size > maxSize) {
      toast({
        title: "File too large",
        description: "Maximum file size is 16MB",
        variant: "destructive",
      });
      return;
    }
    
    setSelectedFile(file);
    
    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFilePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  };

  // Clear selected file
  const clearSelectedFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Send attachment
  const sendAttachment = async () => {
    if (!selectedFile || uploading || sending) return;
    
    if (!isSessionActive()) {
      toast({
        title: "Session expired",
        description: "You can only send attachments within 24 hours of receiving a reply",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    setSending(true);

    try {
      // 1. Upload file to R2
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const r2Key = `whatsapp-media/${contactId}/${fileName}`;

      const { data: urlData, error: urlError } = await supabase.functions.invoke('generate-upload-url', {
        body: { key: r2Key, contentType: selectedFile.type },
      });
      if (urlError || !urlData?.uploadUrl) {
        throw new Error(`Failed to get upload URL: ${urlError?.message}`);
      }

      const uploadResp = await fetch(urlData.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': selectedFile.type },
        body: selectedFile,
      });
      if (!uploadResp.ok) {
        throw new Error(`Upload failed: ${uploadResp.status}`);
      }

      // 2. Use R2 public URL
      const publicUrl = urlData.publicUrl;

      // 3. Send via edge function
      const mediaType = getMediaType(selectedFile.type);
      const response = await supabase.functions.invoke('send-whatsapp-message', {
        body: {
          contactId,
          phoneNumber: formattedPhone,
          mediaType,
          mediaUrl: publicUrl,
          mediaCaption: newMessage.trim() || undefined,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to send attachment');
      }

      // Clear inputs
      clearSelectedFile();
      setNewMessage("");
      await fetchMessages();

      toast({
        title: "Attachment sent",
        description: "Your file was sent successfully",
      });
    } catch (error) {
      console.error('Error sending attachment:', error);
      toast({
        title: "Failed to send",
        description: error instanceof Error ? error.message : "Could not send attachment",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      setSending(false);
    }
  };

  // Send a follow-up message (within session window)
  const sendFollowUpMessage = async () => {
    // If a file is selected, send as attachment instead
    if (selectedFile) {
      await sendAttachment();
      return;
    }
    
    if (!newMessage.trim() || sending) return;
    
    if (!isSessionActive()) {
      toast({
        title: "Session expired",
        description: "You can only send free-form messages within 24 hours of receiving a reply",
        variant: "destructive",
      });
      return;
    }

    setSending(true);
    try {
      const response = await supabase.functions.invoke('send-whatsapp-message', {
        body: {
          contactId,
          phoneNumber: formattedPhone,
          message: newMessage.trim(),
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to send message');
      }

      setNewMessage("");
      await fetchMessages();
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Failed to send",
        description: error instanceof Error ? error.message : "Could not send message",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  // Initial load and auto-send logic
  useEffect(() => {
    if (!open) {
      setAutoSendTriggered(false);
      return;
    }

    const initChat = async () => {
      const existingMessages = await fetchMessages();
      
      // Auto-send template if no messages exist
      if (existingMessages && existingMessages.length === 0 && !autoSendTriggered) {
        await sendConversationTemplate();
      }
    };

    initChat();
  }, [open, fetchMessages, sendConversationTemplate, autoSendTriggered]);

  // Real-time subscription for new messages
  useEffect(() => {
    if (!open) return;

    const channel = supabase
      .channel(`whatsapp-chat-${formattedPhone}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'whatsapp_messages',
          filter: `phone_number=eq.${formattedPhone}`,
        },
        (payload) => {
          console.log('[Realtime] WhatsApp message change:', payload);
          
          if (payload.eventType === 'INSERT') {
            const newMsg = payload.new as WhatsAppMessage;
            setMessages(prev => {
              // Avoid duplicates
              if (prev.some(m => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
          } else if (payload.eventType === 'UPDATE') {
            setMessages(prev =>
              prev.map(m => m.id === payload.new.id ? payload.new as WhatsAppMessage : m)
            );
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] Subscribed to WhatsApp chat:', formattedPhone);
        }
      });

    return () => {
      console.log('[Realtime] Unsubscribing from WhatsApp chat');
      supabase.removeChannel(channel);
    };
  }, [open, formattedPhone]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'read':
        return <CheckCheck className="h-3 w-3 text-blue-500" />;
      case 'delivered':
        return <CheckCheck className="h-3 w-3 text-muted-foreground" />;
      case 'sent':
        return <Check className="h-3 w-3 text-muted-foreground" />;
      case 'failed':
        return <AlertCircle className="h-3 w-3 text-red-500" />;
      default:
        return <Clock className="h-3 w-3 text-muted-foreground" />;
    }
  };

  // Render media content based on type
  const renderMedia = (msg: WhatsAppMessage) => {
    if (!msg.media_url) return null;

    const mediaType = msg.media_type || 'document';

    switch (mediaType) {
      case 'image':
        return (
          <div className="mb-2">
            <img 
              src={msg.media_url} 
              alt="Shared image" 
              className="max-w-full max-h-64 rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => window.open(msg.media_url!, '_blank')}
              onError={(e) => {
                // Handle expired URLs gracefully
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                target.parentElement!.innerHTML = `
                  <div class="flex items-center gap-2 p-3 bg-gray-100 dark:bg-slate-600 rounded-lg text-muted-foreground">
                    <span class="text-sm">Image expired or unavailable</span>
                  </div>
                `;
              }}
            />
          </div>
        );

      case 'document':
        return (
          <a 
            href={msg.media_url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-3 bg-white/50 dark:bg-slate-600/50 rounded-lg hover:bg-white/70 dark:hover:bg-slate-600/70 transition-colors mb-2"
          >
            <FileText className="h-5 w-5 text-red-500" />
            <span className="text-sm underline">View Document</span>
          </a>
        );

      case 'video':
        return (
          <a 
            href={msg.media_url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-3 bg-white/50 dark:bg-slate-600/50 rounded-lg hover:bg-white/70 dark:hover:bg-slate-600/70 transition-colors mb-2"
          >
            <Video className="h-5 w-5 text-blue-500" />
            <span className="text-sm underline">View Video</span>
          </a>
        );

      case 'audio':
        return (
          <a 
            href={msg.media_url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-3 bg-white/50 dark:bg-slate-600/50 rounded-lg hover:bg-white/70 dark:hover:bg-slate-600/70 transition-colors mb-2"
          >
            <Volume2 className="h-5 w-5 text-green-500" />
            <span className="text-sm underline">Play Audio</span>
          </a>
        );

      case 'sticker':
        return (
          <div className="mb-2">
            <img 
              src={msg.media_url} 
              alt="Sticker" 
              className="max-w-32 max-h-32 cursor-pointer"
              onClick={() => window.open(msg.media_url!, '_blank')}
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
              }}
            />
          </div>
        );

      default:
        return (
          <a 
            href={msg.media_url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-3 bg-white/50 dark:bg-slate-600/50 rounded-lg hover:bg-white/70 dark:hover:bg-slate-600/70 transition-colors mb-2"
          >
            <ImageIcon className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm underline">View Attachment</span>
          </a>
        );
    }
  };

  // Check if message content is just a placeholder
  const isPlaceholderContent = (content: string | null) => {
    if (!content) return true;
    const placeholders = ['[Image]', '[Document]', '[Video]', '[Audio]', '[Sticker]'];
    return placeholders.includes(content);
  };

  const initials = contactName
    .split(' ')
    .map(n => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md h-[600px] flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-4 py-3 border-b bg-green-600 text-white rounded-t-lg">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 border-2 border-white/30">
              <AvatarFallback className="bg-green-700 text-white">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <DialogTitle className="text-white font-semibold">
                {contactName}
              </DialogTitle>
              <div className="flex items-center gap-1 text-green-100 text-sm">
                <Phone className="h-3 w-3" />
                <span>{phoneNumber}</span>
              </div>
            </div>
            {isSessionActive() && (
              <Badge variant="secondary" className="bg-green-500 text-white border-0">
                Session Active
              </Badge>
            )}
          </div>
        </DialogHeader>

        {/* Chat Area */}
        <ScrollArea 
          ref={scrollAreaRef}
          className="flex-1 bg-[#e5ddd5] dark:bg-slate-800"
        >
          <div className="p-4 space-y-3 min-h-full">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : messages.length === 0 && !sending ? (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                Starting conversation...
              </div>
            ) : (
              messages.map((msg) => {
                // Check if this message matches the conversation template
                const isConversationTemplate = msg.message_content?.includes(CONVERSATION_TEMPLATE.content.substring(0, 50));
                
                return (
                  <div
                    key={msg.id}
                    className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className="max-w-[80%]">
                      <div
                        className={`rounded-lg px-3 py-2 shadow-sm ${
                          msg.direction === 'outbound'
                            ? 'bg-[#dcf8c6] dark:bg-green-700 text-foreground'
                            : 'bg-white dark:bg-slate-700 text-foreground'
                        }`}
                      >
                        {/* Render media content */}
                        {renderMedia(msg)}
                        
                        {/* Render text content (skip if just a placeholder) */}
                        {msg.message_content && !isPlaceholderContent(msg.message_content) && (
                          <p className="text-sm whitespace-pre-wrap">{msg.message_content}</p>
                        )}
                        
                        <div className="flex items-center justify-end gap-1 mt-1">
                          <span className="text-[10px] text-muted-foreground">
                            {msg.sent_at || msg.created_at
                              ? format(new Date(msg.sent_at || msg.created_at!), "HH:mm")
                              : ""}
                          </span>
                          {msg.direction === 'outbound' && getStatusIcon(msg.status)}
                        </div>
                      </div>
                      
                      {/* Show buttons for template messages */}
                      {isConversationTemplate && msg.direction === 'outbound' && (
                        <div className="mt-1 space-y-1">
                          {CONVERSATION_TEMPLATE.buttons.map((btn, idx) => (
                            <div
                              key={idx}
                              className="bg-white dark:bg-slate-600 text-center py-2 px-3 rounded-lg shadow-sm border border-gray-200 dark:border-slate-500"
                            >
                              <span className="text-sm text-blue-600 dark:text-blue-400">
                                {btn.text}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            
            {/* Sending indicator */}
            {sending && (
              <div className="flex justify-end">
                <div className="bg-[#dcf8c6] dark:bg-green-700 rounded-lg px-3 py-2 shadow-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Sending...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="p-3 border-t bg-background">
          {/* File Preview */}
          {selectedFile && (
            <div className="mb-2 p-2 bg-muted rounded-lg flex items-center gap-2">
              {filePreview ? (
                <img src={filePreview} alt="Preview" className="h-12 w-12 object-cover rounded" />
              ) : (
                <div className="h-12 w-12 bg-muted-foreground/20 rounded flex items-center justify-center">
                  <FileText className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={clearSelectedFile}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
          
          {/* Hidden file input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx"
            className="hidden"
          />
          
          <div className="flex gap-2">
            {/* Attachment button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={!isSessionActive() || sending || uploading}
              className="shrink-0"
            >
              <Paperclip className="h-5 w-5" />
            </Button>
            
            <Input
              placeholder={
                selectedFile
                  ? "Add a caption (optional)..."
                  : isSessionActive()
                    ? "Type a message..."
                    : "Session expired - waiting for reply"
              }
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendFollowUpMessage();
                }
              }}
              disabled={!isSessionActive() || sending}
              className="flex-1"
            />
            <Button
              size="icon"
              onClick={sendFollowUpMessage}
              disabled={(!newMessage.trim() && !selectedFile) || !isSessionActive() || sending}
              className="bg-green-600 hover:bg-green-700"
            >
              {sending || uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          {!isSessionActive() && messages.length > 0 && (
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Free-form messages can only be sent within 24 hours of receiving a reply
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
