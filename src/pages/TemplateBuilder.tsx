import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useNotification } from "@/hooks/useNotification";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Plus, Trash2, Upload, Link, Phone, Copy, Workflow, MessageSquare, Check, CheckCheck } from "lucide-react";
import { useOrgContext } from "@/hooks/useOrgContext";

interface Button {
  type: string;
  text: string;
  url?: string;
  phone_code?: string;
  phone_number?: string;
  example_code?: string;
  flow_id?: string;
  flow_action?: string;
  navigate_screen?: string;
}

export default function TemplateBuilder() {
  const navigate = useNavigate();
  const notify = useNotification();
  const { orgId } = useOrgContext();
  
  const [loading, setLoading] = useState(false);
  const [submittingToExotel, setSubmittingToExotel] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [category, setCategory] = useState("marketing");
  const [language, setLanguage] = useState("en");
  const [headerType, setHeaderType] = useState<string>("none");
  const [headerContent, setHeaderContent] = useState("");
  const [bodyContent, setBodyContent] = useState("");
  const [footerText, setFooterText] = useState("");
  const [buttons, setButtons] = useState<Button[]>([]);
  const [sampleHeader, setSampleHeader] = useState<string[]>([]);
  const [sampleBody, setSampleBody] = useState<string[]>([]);
  const [mediaUrl, setMediaUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  // Auto-sync sample values with body content variables
  useEffect(() => {
    const bodyVars = (bodyContent.match(/\{\{(\d+)\}\}/g) || [])
      .map(v => parseInt(v.replace(/[{}]/g, '')))
      .filter(n => !isNaN(n));
    
    const maxBodyVar = bodyVars.length > 0 ? Math.max(...bodyVars) : 0;
    
    if (maxBodyVar !== sampleBody.length) {
      const newSampleBody = Array(maxBodyVar).fill('').map((_, idx) => 
        sampleBody[idx] || ''
      );
      setSampleBody(newSampleBody);
    }
  }, [bodyContent]);

  // Auto-sync sample values with header content variables
  useEffect(() => {
    const headerVars = (headerContent.match(/\{\{(\d+)\}\}/g) || [])
      .map(v => parseInt(v.replace(/[{}]/g, '')))
      .filter(n => !isNaN(n));
    
    const maxHeaderVar = headerVars.length > 0 ? Math.max(...headerVars) : 0;
    
    if (maxHeaderVar !== sampleHeader.length) {
      const newSampleHeader = Array(maxHeaderVar).fill('').map((_, idx) => 
        sampleHeader[idx] || ''
      );
      setSampleHeader(newSampleHeader);
    }
  }, [headerContent]);

  const insertVariable = (location: 'header' | 'body') => {
    if (location === 'header') {
      const currentVars = (headerContent.match(/{{(\d+)}}/g) || []).length;
      const newVar = `{{${currentVars + 1}}}`;
      setHeaderContent(headerContent + newVar);
      setSampleHeader([...sampleHeader, ""]);
    } else {
      const currentVars = (bodyContent.match(/{{(\d+)}}/g) || []).length;
      const newVar = `{{${currentVars + 1}}}`;
      setBodyContent(bodyContent + newVar);
      setSampleBody([...sampleBody, ""]);
    }
  };

  const addButton = (type: string) => {
    const copyCodeCount = buttons.filter(b => b.type === "COPY_CODE").length;
    const flowCount = buttons.filter(b => b.type === "FLOW").length;
    const phoneCount = buttons.filter(b => b.type === "PHONE_NUMBER").length;
    const urlCount = buttons.filter(b => b.type === "URL").length;
    
    if (type === "COPY_CODE" && copyCodeCount >= 1) {
      notify.error("Limit Reached", "Only 1 Copy Code button allowed");
      return;
    }
    if (type === "FLOW" && flowCount >= 1) {
      notify.error("Limit Reached", "Only 1 Flow button allowed");
      return;
    }
    if (type === "PHONE_NUMBER" && phoneCount >= 1) {
      notify.error("Limit Reached", "Only 1 Phone button allowed");
      return;
    }
    if (type === "URL" && urlCount >= 2) {
      notify.error("Limit Reached", "Maximum 2 URL buttons allowed");
      return;
    }
    if (buttons.length >= 10) {
      notify.error("Button Limit Reached", "Maximum 10 buttons allowed");
      return;
    }

    setButtons([
      ...buttons,
      {
        type,
        text: "",
        ...(type === "URL" && { url: "" }),
        ...(type === "PHONE_NUMBER" && { phone_code: "+91", phone_number: "" }),
        ...(type === "COPY_CODE" && { example_code: "" }),
        ...(type === "FLOW" && { flow_id: "", flow_action: "navigate", navigate_screen: "" }),
      },
    ]);
  };

  const updateButton = (index: number, field: string, value: string) => {
    const newButtons = [...buttons];
    newButtons[index] = { ...newButtons[index], [field]: value };
    setButtons(newButtons);
  };

  const removeButton = (index: number) => {
    setButtons(buttons.filter((_, i) => i !== index));
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type based on header type
    const validTypes: Record<string, string[]> = {
      image: ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'],
      video: ['video/mp4', 'video/3gpp'],
      document: ['application/pdf']
    };

    if (headerType !== 'none' && headerType !== 'text') {
      const allowedTypes = validTypes[headerType] || [];
      if (!allowedTypes.includes(file.type)) {
        notify.error("Invalid File Type", `Please upload a valid ${headerType} file`);
        return;
      }
    }

    // Validate file size (max 5MB for images, 16MB for videos, 100MB for documents)
    const maxSizes: Record<string, number> = {
      image: 5 * 1024 * 1024,
      video: 16 * 1024 * 1024,
      document: 100 * 1024 * 1024
    };

    const maxSize = maxSizes[headerType] || 5 * 1024 * 1024;
    if (file.size > maxSize) {
      notify.error("File Too Large", `File size must be less than ${maxSize / (1024 * 1024)}MB`);
      return;
    }

    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const r2Key = `whatsapp-templates/template-media/${orgId}/${Date.now()}.${fileExt}`;

      const { data: urlData, error: urlError } = await supabase.functions.invoke('generate-upload-url', {
        body: { key: r2Key, contentType: file.type },
      });
      if (urlError || !urlData?.uploadUrl) throw new Error(urlError?.message || 'Failed to get upload URL');

      const uploadResp = await fetch(urlData.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!uploadResp.ok) throw new Error(`Upload failed: ${uploadResp.status}`);

      setMediaUrl(urlData.publicUrl);

      notify.success("Upload Successful", "File uploaded successfully");
    } catch (error: any) {
      console.error('Error uploading file:', error);
      notify.error("Upload Failed", error);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!templateName || !bodyContent) {
      notify.error("Validation Error", "Template name and body content are required");
      return;
    }

    if (!orgId) {
      notify.error("Error", "Organization not found");
      return;
    }

    setLoading(true);

    try {
      // Save template locally to database
      const templateData = {
        org_id: orgId,
        template_id: `local_${Date.now()}`,
        template_name: templateName,
        template_type: 'whatsapp',
        category,
        language,
        header_type: headerType === 'none' ? null : headerType,
        header_content: headerType === 'text' ? headerContent : (headerType !== 'none' ? mediaUrl : null),
        content: bodyContent,
        footer_text: footerText || null,
        buttons: buttons.length > 0 ? buttons.map(btn => ({
          type: btn.type,
          text: btn.text,
          ...(btn.type === "URL" && { url: btn.url }),
          ...(btn.type === "PHONE_NUMBER" && { 
            phone_number: (btn.phone_code || "+91") + (btn.phone_number || ""),
          }),
          ...(btn.type === "COPY_CODE" && { example_code: btn.example_code }),
          ...(btn.type === "FLOW" && { 
            flow_id: btn.flow_id,
            flow_action: btn.flow_action,
            navigate_screen: btn.navigate_screen,
          }),
        })) : null,
        sample_values: {
          ...(sampleHeader.length > 0 && { header: sampleHeader }),
          ...(sampleBody.length > 0 && { body: sampleBody }),
        },
        status: 'draft',
        submission_status: 'pending_submission',
      };

      const { data: insertedTemplate, error } = await supabase
        .from('communication_templates')
        .insert(templateData)
        .select()
        .single();

      if (error) throw error;

      notify.success("Template Created", "Template saved locally. Now submitting to Exotel for WhatsApp approval...");
      
      // Submit to Exotel for approval
      setSubmittingToExotel(true);
      try {
        const { data: exotelResult, error: exotelError } = await supabase.functions.invoke(
          'submit-whatsapp-template',
          {
            body: {
              templateId: insertedTemplate.id,
              orgId: orgId,
            },
          }
        );

        if (exotelError) {
          notify.error("Exotel Submission Failed", exotelError.message || "Failed to submit template to Exotel. You can try again from the Templates page.");
        } else if (exotelResult?.success) {
          notify.success("Submitted to Exotel", "Template submitted for WhatsApp approval. Check the Templates page for status updates.");
        } else {
          notify.error("Exotel Submission Failed", exotelResult?.error || "Failed to submit template. Check WhatsApp Settings for missing configuration.");
        }
      } catch (exotelErr: any) {
        console.error('Exotel submission error:', exotelErr);
        notify.error("Exotel Submission Failed", exotelErr.message || "Failed to submit template to Exotel.");
      } finally {
        setSubmittingToExotel(false);
      }

      navigate('/templates');
    } catch (error: any) {
      console.error('Error saving template:', error);
      notify.error("Save Failed", error);
    } finally {
      setLoading(false);
    }
  };

  const renderPreview = () => {
    const quickReplyButtons = buttons.filter(b => b.type === "QUICK_REPLY");
    const ctaButtons = buttons.filter(b => b.type !== "QUICK_REPLY");

    return (
      <div className="flex justify-center">
        {/* Phone Frame */}
        <div className="relative bg-[#1f2c34] rounded-[40px] p-3 shadow-2xl w-[320px]">
          {/* Phone Notch */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-[#1f2c34] rounded-b-2xl z-10" />
          
          {/* Phone Screen */}
          <div className="bg-[#0b141a] rounded-[28px] overflow-hidden">
            {/* WhatsApp Header */}
            <div className="bg-[#1f2c34] text-white px-4 py-3 flex items-center gap-3 border-b border-[#2a3942]">
              <div className="w-10 h-10 bg-[#25D366] rounded-full flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">Template Preview</p>
                <p className="text-xs text-[#8696a0]">WhatsApp Business</p>
              </div>
            </div>
            
            {/* Chat Area with WhatsApp pattern */}
            <div 
              className="p-3 min-h-[400px]"
              style={{
                backgroundColor: '#0b141a',
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23182229' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
              }}
            >
              {/* Message Bubble */}
              <div className="bg-[#005c4b] rounded-lg p-3 shadow-md max-w-[85%] ml-auto relative">
                {/* Message tail */}
                <div className="absolute -right-2 top-0 w-4 h-4 overflow-hidden">
                  <div className="bg-[#005c4b] w-4 h-4 transform rotate-45 translate-x-[-50%]" />
                </div>
                
                {/* Header */}
                {headerType !== 'none' && (
                  <div className="mb-2">
                    {headerType === 'text' ? (
                      <p className="font-semibold text-white text-sm">{headerContent || "Header text here"}</p>
                    ) : (
                      <div className="bg-[#1f2c34] h-28 rounded-lg flex items-center justify-center text-[#8696a0] text-xs">
                        <div className="text-center">
                          <Upload className="w-6 h-6 mx-auto mb-1" />
                          {headerType.toUpperCase()}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Body */}
                <div className="text-white text-sm whitespace-pre-wrap mb-1">
                  {bodyContent || "Your message body will appear here. Use variables like {{1}} for dynamic content."}
                </div>
                
                {/* Footer & Timestamp */}
                <div className="flex items-center justify-end gap-1 mt-1">
                  {footerText && (
                    <span className="text-[#8696a0] text-xs mr-auto">{footerText}</span>
                  )}
                  <span className="text-[#8696a0] text-[10px]">12:00 PM</span>
                  <CheckCheck className="w-4 h-4 text-[#53bdeb]" />
                </div>
                
                {/* CTA Buttons (URL, Phone, Copy Code, Flow) */}
                {ctaButtons.length > 0 && (
                  <div className="border-t border-[#1f2c34] mt-3 pt-2 -mx-3 -mb-3 px-3 pb-3 space-y-1">
                    {ctaButtons.map((btn, idx) => (
                      <div 
                        key={idx} 
                        className="flex items-center justify-center gap-2 py-2 text-[#53bdeb] hover:bg-[#1f2c34] rounded cursor-pointer transition-colors text-sm"
                      >
                        {btn.type === "URL" && <Link className="w-4 h-4" />}
                        {btn.type === "PHONE_NUMBER" && <Phone className="w-4 h-4" />}
                        {btn.type === "COPY_CODE" && <Copy className="w-4 h-4" />}
                        {btn.type === "FLOW" && <Workflow className="w-4 h-4" />}
                        <span>{btn.text || `Button ${idx + 1}`}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Quick Reply Buttons (outside bubble) */}
              {quickReplyButtons.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2 justify-end max-w-[85%] ml-auto">
                  {quickReplyButtons.map((btn, idx) => (
                    <div 
                      key={idx} 
                      className="bg-[#1f2c34] border border-[#2a3942] rounded-full px-4 py-2 text-[#53bdeb] text-sm hover:bg-[#2a3942] cursor-pointer transition-colors"
                    >
                      {btn.text || `Reply ${idx + 1}`}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Create WhatsApp Template</h1>
            <p className="text-muted-foreground">Design and submit templates for WhatsApp approval</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Form Section */}
          <div className="space-y-6">
            {/* Basic Info */}
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
                <CardDescription>Template name, category, and language settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="templateName">Template Name *</Label>
                  <Input
                    id="templateName"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                    placeholder="welcome_message"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Use lowercase letters, numbers, and underscores only</p>
                </div>

                <div>
                  <Label htmlFor="category">Category *</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger id="category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="marketing">Marketing</SelectItem>
                      <SelectItem value="utility">Utility</SelectItem>
                      <SelectItem value="authentication">Authentication</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="language">Language *</Label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger id="language">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="en_US">English (US)</SelectItem>
                      <SelectItem value="hi">Hindi</SelectItem>
                      <SelectItem value="es">Spanish</SelectItem>
                      <SelectItem value="pt_BR">Portuguese (BR)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Header */}
            <Card>
              <CardHeader>
                <CardTitle>Header (Optional)</CardTitle>
                <CardDescription>Add a header with text or media</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="headerType">Header Type</Label>
                  <Select value={headerType} onValueChange={setHeaderType}>
                    <SelectTrigger id="headerType">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="text">Text</SelectItem>
                      <SelectItem value="image">Image</SelectItem>
                      <SelectItem value="video">Video</SelectItem>
                      <SelectItem value="document">Document</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {headerType === 'text' && (
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <Label htmlFor="headerContent">Header Text</Label>
                      <Button type="button" variant="outline" size="sm" onClick={() => insertVariable('header')}>
                        Insert Variable
                      </Button>
                    </div>
                    <Input
                      id="headerContent"
                      value={headerContent}
                      onChange={(e) => setHeaderContent(e.target.value)}
                      placeholder="Welcome to our service!"
                    />
                    
                    {sampleHeader.length > 0 && (
                      <div className="mt-3 space-y-2">
                        <Label>Sample Values</Label>
                        {sampleHeader.map((_, idx) => (
                          <Input
                            key={idx}
                            placeholder={`Sample value for {{${idx + 1}}}`}
                            value={sampleHeader[idx]}
                            onChange={(e) => {
                              const newSamples = [...sampleHeader];
                              newSamples[idx] = e.target.value;
                              setSampleHeader(newSamples);
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {headerType !== 'none' && headerType !== 'text' && (
                  <div className="space-y-3">
                    <Label htmlFor="mediaUpload">Upload {headerType}</Label>
                    <div className="flex items-center gap-3">
                      <Input
                        id="mediaUpload"
                        type="file"
                        onChange={handleFileUpload}
                        accept={
                          headerType === 'image' ? 'image/jpeg,image/png,image/jpg,image/webp' :
                          headerType === 'video' ? 'video/mp4,video/3gpp' :
                          headerType === 'document' ? 'application/pdf' : ''
                        }
                        className="hidden"
                        disabled={uploading}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => document.getElementById('mediaUpload')?.click()}
                        disabled={uploading}
                        className="w-full"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        {uploading ? 'Uploading...' : mediaUrl ? 'Change File' : 'Upload File'}
                      </Button>
                    </div>
                    {mediaUrl && (
                      <p className="text-xs text-muted-foreground">
                        ✓ File uploaded successfully
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Body */}
            <Card>
              <CardHeader>
                <CardTitle>Body Content *</CardTitle>
                <CardDescription>The main message content</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <Label htmlFor="bodyContent">Message Text</Label>
                    <Button type="button" variant="outline" size="sm" onClick={() => insertVariable('body')}>
                      Insert Variable
                    </Button>
                  </div>
                  <Textarea
                    id="bodyContent"
                    value={bodyContent}
                    onChange={(e) => setBodyContent(e.target.value)}
                    placeholder="Hello {{1}}, your order {{2}} is confirmed!"
                    rows={6}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Use variables like {"{{1}}"}, {"{{2}}"} for dynamic content</p>
                </div>

                {sampleBody.length > 0 && (
                  <div className="space-y-2">
                    <Label>Sample Values</Label>
                    {sampleBody.map((_, idx) => (
                      <Input
                        key={idx}
                        placeholder={`Sample value for {{${idx + 1}}}`}
                        value={sampleBody[idx]}
                        onChange={(e) => {
                          const newSamples = [...sampleBody];
                          newSamples[idx] = e.target.value;
                          setSampleBody(newSamples);
                        }}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Footer */}
            <Card>
              <CardHeader>
                <CardTitle>Footer (Optional)</CardTitle>
                <CardDescription>Add a footer text</CardDescription>
              </CardHeader>
              <CardContent>
                <div>
                  <Label htmlFor="footerText">Footer Text</Label>
                  <Input
                    id="footerText"
                    value={footerText}
                    onChange={(e) => setFooterText(e.target.value)}
                    placeholder="Thank you for your business"
                    maxLength={60}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Maximum 60 characters</p>
                </div>
              </CardContent>
            </Card>

            {/* Buttons */}
            <Card>
              <CardHeader>
                <CardTitle>Buttons (Optional)</CardTitle>
                <CardDescription>Add call-to-action or quick reply buttons (max 10 total)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Quick Reply Section */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Quick Reply</Label>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => addButton("QUICK_REPLY")} 
                    disabled={buttons.length >= 10}
                    className="w-full justify-start border-dashed"
                  >
                    <MessageSquare className="h-4 w-4 mr-2 text-muted-foreground" />
                    <span className="flex-1 text-left">Add Quick Reply</span>
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                      {buttons.filter(b => b.type === "QUICK_REPLY").length}/10
                    </span>
                  </Button>
                </div>

                <Separator />

                {/* CTA Buttons Section */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Call to Action</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => addButton("URL")} 
                      disabled={buttons.filter(b => b.type === "URL").length >= 2}
                      className="justify-start border-dashed"
                    >
                      <Link className="h-4 w-4 mr-2 text-muted-foreground" />
                      <span className="flex-1 text-left text-sm">URL</span>
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                        {buttons.filter(b => b.type === "URL").length}/2
                      </span>
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => addButton("PHONE_NUMBER")} 
                      disabled={buttons.filter(b => b.type === "PHONE_NUMBER").length >= 1}
                      className="justify-start border-dashed"
                    >
                      <Phone className="h-4 w-4 mr-2 text-muted-foreground" />
                      <span className="flex-1 text-left text-sm">Phone</span>
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                        {buttons.filter(b => b.type === "PHONE_NUMBER").length}/1
                      </span>
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => addButton("COPY_CODE")} 
                      disabled={buttons.filter(b => b.type === "COPY_CODE").length >= 1}
                      className="justify-start border-dashed"
                    >
                      <Copy className="h-4 w-4 mr-2 text-muted-foreground" />
                      <span className="flex-1 text-left text-sm">Copy Code</span>
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                        {buttons.filter(b => b.type === "COPY_CODE").length}/1
                      </span>
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => addButton("FLOW")} 
                      disabled={buttons.filter(b => b.type === "FLOW").length >= 1}
                      className="justify-start border-dashed"
                    >
                      <Workflow className="h-4 w-4 mr-2 text-muted-foreground" />
                      <span className="flex-1 text-left text-sm">Flow</span>
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                        {buttons.filter(b => b.type === "FLOW").length}/1
                      </span>
                    </Button>
                  </div>
                </div>

                {buttons.length > 0 && <Separator />}

                {buttons.map((btn, idx) => (
                  <Card key={idx}>
                    <CardContent className="pt-4 space-y-3">
                      <div className="flex justify-between items-center">
                        <Label>Button {idx + 1} - {btn.type.replace('_', ' ')}</Label>
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeButton(idx)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <Input
                        placeholder="Button text"
                        value={btn.text}
                        onChange={(e) => updateButton(idx, 'text', e.target.value)}
                        maxLength={25}
                      />
                      {btn.type === "URL" && (
                        <Input
                          placeholder="https://example.com"
                          value={btn.url || ""}
                          onChange={(e) => updateButton(idx, 'url', e.target.value)}
                        />
                      )}
                      {btn.type === "PHONE_NUMBER" && (
                        <div className="flex gap-2">
                          <Select 
                            value={btn.phone_code || "+91"}
                            onValueChange={(code) => {
                              updateButton(idx, 'phone_code', code);
                            }}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue placeholder="Code" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="+1">🇺🇸 +1</SelectItem>
                              <SelectItem value="+44">🇬🇧 +44</SelectItem>
                              <SelectItem value="+91">🇮🇳 +91</SelectItem>
                              <SelectItem value="+86">🇨🇳 +86</SelectItem>
                              <SelectItem value="+81">🇯🇵 +81</SelectItem>
                              <SelectItem value="+49">🇩🇪 +49</SelectItem>
                              <SelectItem value="+33">🇫🇷 +33</SelectItem>
                              <SelectItem value="+61">🇦🇺 +61</SelectItem>
                              <SelectItem value="+55">🇧🇷 +55</SelectItem>
                              <SelectItem value="+971">🇦🇪 +971</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input
                            placeholder="1234567890"
                            type="tel"
                            value={btn.phone_number || ""}
                            onChange={(e) => {
                              const cleanedValue = e.target.value.replace(/\D/g, '');
                              updateButton(idx, 'phone_number', cleanedValue);
                            }}
                            className="flex-1"
                          />
                        </div>
                      )}
                      {btn.type === "COPY_CODE" && (
                        <Input
                          placeholder="Example code (e.g., 123456)"
                          value={btn.example_code || ""}
                          onChange={(e) => updateButton(idx, 'example_code', e.target.value)}
                        />
                      )}
                      {btn.type === "FLOW" && (
                        <div className="space-y-2">
                          <Input
                            placeholder="Flow ID"
                            value={btn.flow_id || ""}
                            onChange={(e) => updateButton(idx, 'flow_id', e.target.value)}
                          />
                          <Select 
                            value={btn.flow_action || "navigate"}
                            onValueChange={(action) => updateButton(idx, 'flow_action', action)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Flow Action" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="navigate">Navigate</SelectItem>
                              <SelectItem value="data_exchange">Data Exchange</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input
                            placeholder="Navigate Screen (optional)"
                            value={btn.navigate_screen || ""}
                            onChange={(e) => updateButton(idx, 'navigate_screen', e.target.value)}
                          />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </CardContent>
            </Card>

            <div className="flex gap-4">
              <Button onClick={handleSubmit} disabled={loading} className="flex-1">
                {loading ? "Submitting..." : "Submit Template for Approval"}
              </Button>
              <Button variant="outline" onClick={() => navigate(-1)}>
                Cancel
              </Button>
            </div>
          </div>

          {/* Preview Section */}
          <div className="space-y-6">
            <div className="sticky top-6">
              <div className="text-center mb-4">
                <h3 className="text-lg font-semibold">Template Preview</h3>
                <p className="text-sm text-muted-foreground">How your template will appear on WhatsApp</p>
              </div>
              {renderPreview()}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
