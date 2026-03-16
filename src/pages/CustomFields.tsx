import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrgContext } from "@/hooks/useOrgContext";
import { useDialogState } from "@/hooks/useDialogState";
import { useNotification } from "@/hooks/useNotification";
import { useOrgData } from "@/hooks/useOrgData";
import { useDragDropOrder } from "@/hooks/useDragDropOrder";
import DashboardLayout from "@/components/Layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2, GripVertical, Download, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { FormDialog } from "@/components/common/FormDialog";
import { LoadingState } from "@/components/common/LoadingState";
import { EmptyState } from "@/components/common/EmptyState";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface CustomField {
  id: string;
  field_name: string;
  field_label: string;
  field_type: string;
  field_options: any;
  is_required: boolean;
  is_active: boolean;
  field_order: number;
  applies_to_table: string;
}

const FIELD_TYPES = [
  { value: "text", label: "Text" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "select", label: "Dropdown" },
  { value: "textarea", label: "Text Area" },
  { value: "file", label: "File Upload (Image/PDF)" },
  { value: "location", label: "Location (Lat/Long)" },
];

interface SortableFieldCardProps {
  field: CustomField;
  onEdit: (field: CustomField) => void;
  onDelete: (id: string) => void;
}

function SortableFieldCard({ field, onEdit, onDelete }: SortableFieldCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div
                {...attributes}
                {...listeners}
                className="cursor-grab active:cursor-grabbing"
              >
                <GripVertical className="h-5 w-5 text-muted-foreground mt-1" />
              </div>
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  {field.field_label}
                  {field.is_required && (
                    <Badge variant="secondary" className="text-xs">Required</Badge>
                  )}
                  {!field.is_active && (
                    <Badge variant="outline" className="text-xs">Inactive</Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  <span className="font-mono text-xs">{field.field_name}</span>
                  {" • "}
                  <span className="capitalize">{field.field_type}</span>
                  {field.field_options && field.field_options.length > 0 && (
                    <>
                      {" • "}
                      <span>{field.field_options.length} options</span>
                    </>
                  )}
                </CardDescription>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onEdit(field)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onDelete(field.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        {field.field_options && field.field_options.length > 0 && (
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {field.field_options.map((option, idx) => (
                <Badge key={idx} variant="outline">
                  {option}
                </Badge>
              ))}
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

export default function CustomFields() {
  const { orgId } = useOrgContext();
  const notify = useNotification();
  const [isProcessing, setIsProcessing] = useState(false);

  const dialog = useDialogState({
    field_name: "",
    field_label: "",
    field_type: "text",
    field_options: "",
    is_required: false,
    is_active: true,
    field_order: 0,
    applies_to_table: "contacts",
  });

  const { data: fields = [], isLoading, refetch } = useOrgData<CustomField>("custom_fields", {
    orderBy: { column: "field_order", ascending: true }
  });

  const dragDrop = useDragDropOrder<CustomField>();

  // Sync fields with drag-drop state
  useEffect(() => {
    dragDrop.setItems(fields);
  }, [fields]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    dragDrop.handleDragEnd(event, async (reorderedItems) => {
      for (let i = 0; i < reorderedItems.length; i++) {
        await supabase
          .from('custom_fields')
          .update({ field_order: i })
          .eq('id', reorderedItems[i].id);
      }
      notify.success("Order updated", "Custom fields have been reordered successfully");
      refetch();
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId) return;
    
    // Validate required fields
    if (!dialog.formData.field_label?.trim()) {
      notify.error("Validation Error", "Field Label is required");
      return;
    }
    
    setIsProcessing(true);

    try {
      const fieldData: any = {
        field_label: dialog.formData.field_label.trim(),
        field_type: dialog.formData.field_type,
        is_required: dialog.formData.is_required,
        is_active: dialog.formData.is_active,
        field_order: dialog.formData.field_order,
        applies_to_table: dialog.formData.applies_to_table,
      };

      // For new fields, handle field_name generation
      if (!dialog.isEditing) {
        const fieldName = (dialog.formData.field_name?.trim() || dialog.formData.field_label)
          .toLowerCase()
          .replace(/\s+/g, '_')
          .replace(/[^a-z0-9_]/g, '');
        
        if (!fieldName) {
          notify.error("Validation Error", "Field Name cannot be empty");
          return;
        }
        
        fieldData.field_name = fieldName;
        fieldData.org_id = orgId;
      }
      // For editing, don't update field_name as it's the internal identifier

      if (dialog.formData.field_type === "select" && dialog.formData.field_options) {
        fieldData.field_options = dialog.formData.field_options
          .split(",")
          .map(opt => opt.trim())
          .filter(opt => opt);
      } else {
        fieldData.field_options = null;
      }

      if (dialog.isEditing) {
        console.log("[CustomFields] submit editing", {
          editingItem: dialog.editingItem,
          formData: dialog.formData,
        });
        const fieldId = (dialog.editingItem as any)?.id ?? (dialog.formData as any)?.id;
        if (!fieldId) {
          notify.error("Error", "Cannot update field: missing field ID");
          setIsProcessing(false);
          return;
        }

        const { error } = await supabase
          .from("custom_fields")
          .update(fieldData)
          .eq("id", fieldId);

        if (error) throw error;
        notify.success("Field updated", "Custom field has been updated successfully");
      } else {
        const { error } = await supabase
          .from("custom_fields")
          .insert([fieldData]);

        if (error) throw error;
        notify.success("Field created", "Custom field has been added successfully");
      }

      dialog.closeDialog();
      refetch();
    } catch (error) {
      notify.error("Error", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!notify.confirm("Are you sure? This will delete all values for this field from existing contacts.")) return;

    try {
      const { error } = await supabase
        .from("custom_fields")
        .delete()
        .eq("id", id);

      if (error) throw error;
      notify.success("Field deleted", "Custom field has been removed successfully");
      refetch();
    } catch (error) {
      notify.error("Error deleting field", error);
    }
  };

  const openEditDialog = (field: CustomField) => {
    console.log("[CustomFields] openEditDialog field", field);
    dialog.openDialog({
      id: field.id,
      field_name: field.field_name || "",
      field_label: field.field_label || "",
      field_type: field.field_type || "text",
      field_options: field.field_options ? field.field_options.join(", ") : "",
      is_required: field.is_required || false,
      is_active: field.is_active !== false,
      field_order: field.field_order || 0,
      applies_to_table: field.applies_to_table || "contacts",
    });
  };

  const openCreateDialog = () => {
    dialog.openDialog();
    dialog.updateFormData({ field_order: dragDrop.items.length } as any);
  };
  const downloadTemplate = () => {
    const template = [
      ["field_name", "field_label", "field_type", "field_options", "is_required", "is_active", "field_order", "applies_to_table"],
      ["department", "Department", "select", "Sales;Marketing;Engineering", "true", "true", "1", "contacts"],
      ["budget", "Budget", "number", "", "false", "true", "2", "contacts"],
      ["notes", "Additional Notes", "textarea", "", "false", "true", "3", "contacts"],
    ];

    const csvContent = template.map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "custom_fields_template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    notify.success("Template downloaded", "CSV template has been downloaded successfully");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Custom Fields</h1>
            <p className="text-muted-foreground">Configure dynamic fields for contact forms</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Add Field
            </Button>
          </div>
        </div>

        <FormDialog
          open={dialog.isOpen}
          onOpenChange={(open) => !open && dialog.closeDialog()}
          title={dialog.isEditing ? "Edit Field" : "Add New Field"}
          onSubmit={handleSubmit}
          isLoading={isProcessing}
          submitLabel={isProcessing ? "Saving..." : dialog.isEditing ? "Update" : "Create"}
        >
          <div className="space-y-2">
            <Label htmlFor="field_label">Field Label *</Label>
            <Input
              id="field_label"
              value={dialog.formData.field_label}
              onChange={(e) => dialog.updateFormData({ field_label: e.target.value })}
              placeholder="e.g., Department"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="field_name">Field Name (Internal) *</Label>
            <Input
              id="field_name"
              value={dialog.formData.field_name}
              onChange={(e) => dialog.updateFormData({ field_name: e.target.value })}
              placeholder="e.g., department"
              disabled={!!dialog.isEditing}
              required
            />
            <p className="text-xs text-muted-foreground">
              Will be converted to lowercase with underscores
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="field_type">Field Type *</Label>
            <Select 
              value={dialog.formData.field_type} 
              onValueChange={(value) => dialog.updateFormData({ field_type: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIELD_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="applies_to_table">Applies To Table *</Label>
            <Select 
              value={dialog.formData.applies_to_table} 
              onValueChange={(value) => dialog.updateFormData({ applies_to_table: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="contacts">Contacts</SelectItem>
                <SelectItem value="all">All Tables</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Which table this custom field applies to
            </p>
          </div>

          {dialog.formData.field_type === "select" && (
            <div className="space-y-2">
              <Label htmlFor="field_options">Dropdown Options *</Label>
              <Input
                id="field_options"
                value={dialog.formData.field_options}
                onChange={(e) => dialog.updateFormData({ field_options: e.target.value })}
                placeholder="Option 1, Option 2, Option 3"
                required
              />
              <p className="text-xs text-muted-foreground">
                Separate options with commas
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="field_order">Display Order</Label>
            <Input
              id="field_order"
              type="number"
              value={dialog.formData.field_order}
              onChange={(e) => dialog.updateFormData({ field_order: parseInt(e.target.value) || 0 })}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="is_required">Required Field</Label>
            <Switch
              id="is_required"
              checked={dialog.formData.is_required}
              onCheckedChange={(checked) => dialog.updateFormData({ is_required: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="is_active">Active</Label>
            <Switch
              id="is_active"
              checked={dialog.formData.is_active}
              onCheckedChange={(checked) => dialog.updateFormData({ is_active: checked })}
            />
          </div>
        </FormDialog>

        <div className="grid gap-4">
          {isLoading ? (
            <LoadingState message="Loading fields..." />
          ) : dragDrop.items.length === 0 ? (
            <EmptyState message="No custom fields configured. Click 'Add Field' to create one." />
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={dragDrop.items.map(f => f.id)}
                strategy={verticalListSortingStrategy}
              >
                {dragDrop.items.map((field) => (
                  <SortableFieldCard
                    key={field.id}
                    field={field}
                    onEdit={openEditDialog}
                    onDelete={handleDelete}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
