-- Fix: WhatsApp inbound messages not visible to org members
-- Problem: RLS policy and get_unified_inbox RPC only show inbound messages
-- to admins or if the contact is assigned to the user. Since webhook doesn't
-- set sent_by, and new contacts are unassigned, inbound messages are invisible.

-- 1. Update WhatsApp messages RLS: all org members can see inbound messages
DROP POLICY IF EXISTS "Users can view own or assigned messages" ON public.whatsapp_messages;

CREATE POLICY "Users can view org whatsapp messages"
ON public.whatsapp_messages
FOR SELECT TO authenticated
USING (
  org_id = get_user_org_id(auth.uid())
);

-- 2. Update email conversations RLS: same fix
DROP POLICY IF EXISTS "Users can view own or assigned email conversations" ON public.email_conversations;

CREATE POLICY "Users can view org email conversations"
ON public.email_conversations
FOR SELECT TO authenticated
USING (
  org_id = get_user_org_id(auth.uid())
);

-- 3. Update SMS messages RLS: same fix
DROP POLICY IF EXISTS "Users can view own or assigned SMS messages" ON public.sms_messages;

CREATE POLICY "Users can view org sms messages"
ON public.sms_messages
FOR SELECT TO authenticated
USING (
  org_id = get_user_org_id(auth.uid())
);

-- 4. Simplify get_unified_inbox - all org members see all messages
CREATE OR REPLACE FUNCTION public.get_unified_inbox(p_org_id uuid, p_limit integer DEFAULT 50)
 RETURNS TABLE(id uuid, conversation_id text, contact_id uuid, channel text, direction text, sender_name text, preview text, is_read boolean, sent_at timestamp with time zone, contact_name text, phone_number text, email_address text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    wm.id,
    wm.conversation_id::TEXT,
    wm.contact_id,
    'whatsapp'::TEXT as channel,
    wm.direction,
    wm.sender_name,
    LEFT(wm.message_content, 100) as preview,
    COALESCE(wm.read_at IS NOT NULL, FALSE) as is_read,
    wm.sent_at,
    COALESCE(c.first_name || ' ' || COALESCE(c.last_name, ''), wm.sender_name) as contact_name,
    wm.phone_number,
    NULL::TEXT as email_address
  FROM whatsapp_messages wm
  LEFT JOIN contacts c ON c.id = wm.contact_id
  WHERE wm.org_id = p_org_id

  UNION ALL

  SELECT
    ec.id,
    ec.conversation_id::TEXT,
    ec.contact_id,
    'email'::TEXT as channel,
    ec.direction,
    ec.from_name as sender_name,
    LEFT(ec.subject || ': ' || ec.email_content, 100) as preview,
    ec.is_read,
    ec.sent_at,
    COALESCE(c.first_name || ' ' || COALESCE(c.last_name, ''), ec.from_name) as contact_name,
    NULL::TEXT as phone_number,
    ec.from_email as email_address
  FROM email_conversations ec
  LEFT JOIN contacts c ON c.id = ec.contact_id
  WHERE ec.org_id = p_org_id

  ORDER BY sent_at DESC
  LIMIT p_limit;
END;
$function$;
