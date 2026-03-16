import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNotification } from "@/hooks/useNotification";
import { Copy, Eye, EyeOff, RefreshCw, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface WebhookConfigProps {
  webhookToken?: string;
  webhookUrl: string;
  sourceName: string;
  rateLimit: number;
  httpMethod: 'GET' | 'POST';
  targetTable: 'contacts' | 'contact_activities' | 'email_bulk_campaigns' | 'blog_posts' | 'whatsapp_bulk_campaigns' | 'call_logs' | 'email_conversations' | 'whatsapp_messages' | 'pipeline_stages' | 'teams' | 'profiles';
  fieldMappings: Record<string, string>;
  onSourceNameChange: (value: string) => void;
  onRateLimitChange: (value: number) => void;
  onHttpMethodChange: (value: 'GET' | 'POST') => void;
  onTargetTableChange: (value: 'contacts' | 'contact_activities' | 'email_bulk_campaigns' | 'blog_posts' | 'whatsapp_bulk_campaigns' | 'call_logs' | 'email_conversations' | 'whatsapp_messages' | 'pipeline_stages' | 'teams' | 'profiles') => void;
  onFieldMappingChange: (mappings: Record<string, string>) => void;
  onRegenerateToken?: () => void;
  customFields: Array<{ id: string; field_name: string; field_label: string; applies_to_table?: string }>;
}

export function WebhookConfig({
  webhookToken,
  webhookUrl,
  sourceName,
  rateLimit,
  httpMethod,
  targetTable,
  fieldMappings,
  onSourceNameChange,
  onRateLimitChange,
  onHttpMethodChange,
  onTargetTableChange,
  onFieldMappingChange,
  onRegenerateToken,
  customFields,
}: WebhookConfigProps) {
  const [showToken, setShowToken] = useState(false);
  const [newMapping, setNewMapping] = useState({ incoming: "", target: "" });
  const notify = useNotification();

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    notify.success("Copied!", `${label} copied to clipboard`);
  };

  const addMapping = () => {
    if (!newMapping.incoming || !newMapping.target) return;
    
    onFieldMappingChange({
      ...fieldMappings,
      [newMapping.incoming]: newMapping.target,
    });
    
    setNewMapping({ incoming: "", target: "" });
  };

  const removeMapping = (key: string) => {
    const { [key]: _, ...rest } = fieldMappings;
    onFieldMappingChange(rest);
  };

  const getTargetFieldOptions = () => {
    // Filter custom fields based on target table
    const relevantCustomFields = customFields.filter(field => 
      field.applies_to_table === targetTable || 
      field.applies_to_table === 'all'
    );

    if (targetTable === 'contacts') {
      return [
        { value: "first_name", label: "First Name" },
        { value: "last_name", label: "Last Name" },
        { value: "email", label: "Email" },
        { value: "phone", label: "Phone" },
        { value: "company", label: "Company" },
        { value: "job_title", label: "Job Title" },
        { value: "notes", label: "Notes" },
        { value: "address", label: "Address" },
        { value: "city", label: "City" },
        { value: "state", label: "State" },
        { value: "postal_code", label: "Postal Code" },
        { value: "country", label: "Country" },
        ...relevantCustomFields.map(field => ({
          value: field.field_name,
          label: `${field.field_label} (Custom)`,
        })),
      ];
    } else if (targetTable === 'contact_activities') {
      return [
        { value: "activity_type", label: "Activity Type" },
        { value: "subject", label: "Subject" },
        { value: "description", label: "Description" },
        { value: "scheduled_at", label: "Scheduled At" },
        { value: "completed_at", label: "Completed At" },
      ];
    } else if (targetTable === 'email_bulk_campaigns') {
      return [
        { value: "campaign_name", label: "Campaign Name" },
        { value: "subject", label: "Subject" },
        { value: "status", label: "Status" },
      ];
    } else if (targetTable === 'blog_posts') {
      return [
        { value: "title", label: "Title" },
        { value: "slug", label: "Slug" },
        { value: "content", label: "Content" },
        { value: "excerpt", label: "Excerpt" },
        { value: "status", label: "Status" },
        { value: "featured_image", label: "Featured Image" },
        { value: "category", label: "Category" },
        { value: "tags", label: "Tags" },
      ];
    } else if (targetTable === 'whatsapp_bulk_campaigns') {
      return [
        { value: "campaign_name", label: "Campaign Name" },
        { value: "template_name", label: "Template Name" },
        { value: "status", label: "Status" },
      ];
    } else if (targetTable === 'call_logs') {
      return [
        { value: "phone_number", label: "Phone Number" },
        { value: "direction", label: "Direction" },
        { value: "status", label: "Status" },
        { value: "duration", label: "Duration" },
      ];
    } else if (targetTable === 'email_conversations') {
      return [
        { value: "subject", label: "Subject" },
        { value: "from_email", label: "From Email" },
        { value: "to_email", label: "To Email" },
        { value: "body", label: "Body" },
      ];
    } else if (targetTable === 'whatsapp_messages') {
      return [
        { value: "message_id", label: "Message ID" },
        { value: "phone_number", label: "Phone Number" },
        { value: "message_body", label: "Message Body" },
        { value: "status", label: "Status" },
      ];
    } else if (targetTable === 'pipeline_stages') {
      return [
        { value: "name", label: "Stage Name" },
        { value: "stage_order", label: "Order" },
        { value: "color", label: "Color" },
      ];
    } else if (targetTable === 'teams') {
      return [
        { value: "name", label: "Team Name" },
        { value: "description", label: "Description" },
      ];
    } else if (targetTable === 'profiles') {
      return [
        { value: "full_name", label: "Full Name" },
        { value: "email", label: "Email" },
        { value: "role", label: "Role" },
      ];
    }
    return [];
  };

  const targetFieldOptions = getTargetFieldOptions();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Webhook Endpoint</CardTitle>
          <CardDescription>
            Send {httpMethod} requests to this URL to create records
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={webhookUrl}
              readOnly
              className="font-mono text-sm bg-muted"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => copyToClipboard(webhookUrl, "Webhook URL")}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>

          {webhookToken && (
            <div>
              <Label className="text-xs text-muted-foreground">Webhook Token</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={showToken ? webhookToken : "wh_" + "•".repeat(40)}
                  readOnly
                  className="font-mono text-sm bg-muted"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowToken(!showToken)}
                >
                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => copyToClipboard(webhookToken, "Token")}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                {onRegenerateToken && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onRegenerateToken}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Token is embedded in the URL. No additional authentication needed.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="http_method">HTTP Method</Label>
          <select
            id="http_method"
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            value={httpMethod}
            onChange={(e) => onHttpMethodChange(e.target.value as 'GET' | 'POST')}
          >
            <option value="POST">POST</option>
            <option value="GET">GET</option>
          </select>
          <p className="text-xs text-muted-foreground">
            HTTP method for webhook requests
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="target_table">Target Table</Label>
          <select
            id="target_table"
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            value={targetTable}
            onChange={(e) => onTargetTableChange(e.target.value as any)}
          >
            <option value="contacts">Contacts</option>
            <option value="contact_activities">Contact Activities</option>
            <option value="email_bulk_campaigns">Email Campaigns</option>
            <option value="blog_posts">Blog Posts</option>
            <option value="whatsapp_bulk_campaigns">WhatsApp Campaigns</option>
            <option value="call_logs">Call Logs</option>
            <option value="email_conversations">Email Conversations</option>
            <option value="whatsapp_messages">WhatsApp Messages</option>
            <option value="pipeline_stages">Pipeline Stages</option>
            <option value="teams">Teams</option>
            <option value="profiles">Users/Profiles</option>
          </select>
          <p className="text-xs text-muted-foreground">
            Table where records will be created
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="source_name">Source Name</Label>
          <Input
            id="source_name"
            value={sourceName}
            onChange={(e) => onSourceNameChange(e.target.value)}
            placeholder="e.g., Justdial, Facebook Ads"
          />
          <p className="text-xs text-muted-foreground">
            How this source will appear in records
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="rate_limit">Rate Limit (requests/minute)</Label>
          <Input
            id="rate_limit"
            type="number"
            min={1}
            max={1000}
            value={rateLimit}
            onChange={(e) => onRateLimitChange(parseInt(e.target.value) || 60)}
          />
          <p className="text-xs text-muted-foreground">
            Maximum webhook requests allowed per minute
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Field Mappings</CardTitle>
          <CardDescription>
            Map incoming webhook fields to your LOS fields
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.keys(fieldMappings).length > 0 && (
            <div className="space-y-2">
              {Object.entries(fieldMappings).map(([incoming, target]) => (
                <div key={incoming} className="flex items-center gap-2 p-2 bg-muted rounded-md">
                  <Badge variant="outline" className="font-mono">
                    {incoming}
                  </Badge>
                  <span className="text-muted-foreground">→</span>
                  <Badge>
                    {targetFieldOptions.find(opt => opt.value === target)?.label || target}
                  </Badge>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="ml-auto"
                    onClick={() => removeMapping(incoming)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="grid gap-2 md:grid-cols-[1fr_auto_1fr_auto]">
            <Input
              placeholder="Incoming field name"
              value={newMapping.incoming}
              onChange={(e) => setNewMapping({ ...newMapping, incoming: e.target.value })}
              className="font-mono"
            />
            <span className="flex items-center text-muted-foreground">→</span>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              value={newMapping.target}
              onChange={(e) => setNewMapping({ ...newMapping, target: e.target.value })}
            >
              <option value="">Select target field</option>
              {targetFieldOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <Button
              type="button"
              onClick={addMapping}
              disabled={!newMapping.incoming || !newMapping.target}
            >
              Add
            </Button>
          </div>

          <div className="bg-muted/50 p-3 rounded-md text-xs space-y-1">
            <p className="font-medium">Default mappings (auto-applied):</p>
            <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
              <li><code>name</code> → first_name, last_name</li>
              <li><code>email</code> → email</li>
              <li><code>phone</code> or <code>mobile</code> → phone</li>
              <li><code>company</code> or <code>company_name</code> → company</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Test Your Webhook</CardTitle>
          <CardDescription>
            Example cURL command to test webhook integration
          </CardDescription>
        </CardHeader>
        <CardContent>
          {httpMethod === 'POST' ? (
            <>
              <pre className="bg-muted p-4 rounded-md text-xs overflow-auto">
{`curl -X POST '${webhookUrl}' \\
  -H 'Content-Type: application/json' \\
  -d '{
  "name": "Test User",
  "email": "test@example.com",
  "phone": "+919876543210",
  "company": "Test Company"
}'`}
              </pre>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => copyToClipboard(`curl -X POST '${webhookUrl}' -H 'Content-Type: application/json' -d '{"name": "Test User", "email": "test@example.com", "phone": "+919876543210", "company": "Test Company"}'`, "cURL command")}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy cURL
              </Button>
            </>
          ) : (
            <>
              <pre className="bg-muted p-4 rounded-md text-xs overflow-auto">
{`curl -X GET '${webhookUrl}?name=Test+User&email=test@example.com&phone=%2B919876543210&company=Test+Company'`}
              </pre>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => copyToClipboard(`curl -X GET '${webhookUrl}?name=Test+User&email=test@example.com&phone=%2B919876543210&company=Test+Company'`, "cURL command")}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy cURL
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
