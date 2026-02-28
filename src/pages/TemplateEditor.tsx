import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowLeft, Plus, Trash2, ChevronDown, ChevronUp,
  Globe, EyeOff, Save, Eye, GripVertical,
} from 'lucide-react';

// @dnd-kit
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';

import { SiteTemplatesService } from '@/services/siteTemplates';
import DynamicFormRenderer from '@/components/DynamicFormRenderer';
import FieldEditor from '@/components/templates/FieldEditor';
import type { SiteTemplate, TemplateField, TemplateSection } from '@/types/siteTemplates';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeField(sectionId: string, order: number): TemplateField {
  return {
    id: `field-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    sectionId,
    label: 'New Field',
    fieldType: 'text',
    order,
    isRequired: false,
    isHidden: false,
    isProtected: false,
  };
}

function makeSection(order: number): TemplateSection {
  return {
    id: `section-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: 'New Section',
    order,
    isCollapsible: true,
    isProtected: false,
  };
}

// ---------------------------------------------------------------------------
// SortableFieldRow
// ---------------------------------------------------------------------------

interface SortableFieldRowProps {
  field: TemplateField;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

function SortableFieldRow({ field, isSelected, onSelect, onDelete }: SortableFieldRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: field.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    position: 'relative',
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`grid grid-cols-[20px_1fr_140px_64px_64px_36px] gap-2 items-center px-3 py-2 cursor-pointer transition-colors ${
        isSelected
          ? 'bg-primary/5 border-l-2 border-l-primary'
          : 'hover:bg-muted/30'
      }`}
      onClick={() => onSelect(field.id)}
    >
      {/* Drag handle */}
      <button
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
        onClick={e => e.stopPropagation()}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>

      <span className="text-sm truncate font-medium">{field.label}</span>
      <Badge variant="outline" className="text-xs w-fit">{field.fieldType}</Badge>
      <div className="flex justify-center">
        {field.isRequired && <span className="text-destructive font-bold text-sm">*</span>}
      </div>
      <div className="flex justify-center">
        {field.isProtected && (
          <Badge variant="secondary" className="text-xs px-1">A</Badge>
        )}
      </div>

      {/* Delete */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={e => e.stopPropagation()}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete field?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{field.label}</strong> will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => onDelete(field.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SortableSectionContainer
// ---------------------------------------------------------------------------

interface SortableSectionContainerProps {
  section: TemplateSection;
  isCollapsed: boolean;
  onToggleCollapse: (id: string) => void;
  onSectionChange: (id: string, patch: Partial<TemplateSection>) => void;
  onSectionBlur: (section: TemplateSection) => void;
  children: React.ReactNode;
  fieldCount: number;
}

function SortableSectionContainer({
  section,
  isCollapsed,
  onToggleCollapse,
  onSectionChange,
  onSectionBlur,
  children,
  fieldCount,
}: SortableSectionContainerProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: section.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 20 : undefined,
    position: 'relative',
  };

  return (
    <div ref={setNodeRef} style={style} className="border rounded-xl overflow-hidden">
      {/* Section header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/30">
        {/* Section drag handle */}
        <button
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground shrink-0"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>

        <button
          className="flex-1 flex items-center gap-2 text-left min-w-0"
          onClick={() => onToggleCollapse(section.id)}
        >
          {isCollapsed
            ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            : <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          }
          <Input
            value={section.title}
            onClick={e => e.stopPropagation()}
            onChange={e => onSectionChange(section.id, { title: e.target.value })}
            onBlur={e => onSectionBlur({ ...section, title: e.target.value })}
            className="h-7 text-sm font-medium border-transparent hover:border-input focus:border-input bg-transparent min-w-0"
          />
          <Badge variant="outline" className="text-xs shrink-0">
            {fieldCount} field{fieldCount !== 1 ? 's' : ''}
          </Badge>
        </button>

        {/* Admin-only toggle */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Label className="text-xs text-muted-foreground">Admin only</Label>
          <Switch
            checked={section.isProtected}
            onCheckedChange={v => {
              const updated = { ...section, isProtected: v };
              onSectionChange(section.id, { isProtected: v });
              onSectionBlur(updated);
            }}
          />
        </div>
      </div>

      {/* Fields slot */}
      {!isCollapsed && children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TemplateEditor
// ---------------------------------------------------------------------------

export default function TemplateEditor() {
  const { templateId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();

  // ---- Data state ----------------------------------------------------------
  const [template, setTemplate] = useState<SiteTemplate | null>(null);
  const [sections, setSections] = useState<TemplateSection[]>([]);
  const [fields, setFields] = useState<TemplateField[]>([]);
  const [loading, setLoading] = useState(true);

  // ---- UI state ------------------------------------------------------------
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // ---- DnD sensors ---------------------------------------------------------
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  // ---- Load ----------------------------------------------------------------
  useEffect(() => {
    if (!templateId) return;
    setLoading(true);
    Promise.all([
      SiteTemplatesService.getTemplate(templateId),
      SiteTemplatesService.getTemplateFields(templateId),
      SiteTemplatesService.getTemplateSections(templateId),
    ])
      .then(([tmpl, flds, secs]) => {
        setTemplate(tmpl);
        setFields(flds);
        setSections(secs.sort((a, b) => a.order - b.order));
      })
      .catch(() => toast.error('Failed to load template.'))
      .finally(() => setLoading(false));
  }, [templateId]);

  // ---- Derived -------------------------------------------------------------
  const selectedField = fields.find(f => f.id === selectedFieldId) ?? null;
  const fieldsBySection = useCallback(
    (sectionId: string) =>
      fields.filter(f => f.sectionId === sectionId).sort((a, b) => a.order - b.order),
    [fields],
  );

  // ---- Section actions -----------------------------------------------------
  const toggleSection = (id: string) =>
    setCollapsedSections(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const updateSection = useCallback((id: string, patch: Partial<TemplateSection>) => {
    setSections(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
  }, []);

  const autoSaveSection = useCallback(async (section: TemplateSection) => {
    if (!templateId) return;
    try { await SiteTemplatesService.saveSection(templateId, section); }
    catch { toast.error('Failed to save section.'); }
  }, [templateId]);

  const handleAddSection = async () => {
    if (!templateId) return;
    const section = makeSection(sections.length);
    setSections(prev => [...prev, section]);
    try { await SiteTemplatesService.saveSection(templateId, section); }
    catch { toast.error('Failed to add section.'); }
  };

  // Section drag end
  const handleSectionDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setSections(prev => {
      const oldIndex = prev.findIndex(s => s.id === active.id);
      const newIndex = prev.findIndex(s => s.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      const reordered = arrayMove(prev, oldIndex, newIndex).map((s, i) => ({ ...s, order: i }));
      if (templateId) {
        SiteTemplatesService.batchSaveSections(templateId, reordered)
          .catch(() => toast.error('Failed to save section order.'));
      }
      return reordered;
    });
  }, [templateId]);

  // ---- Field actions -------------------------------------------------------
  const updateField = useCallback((id: string, patch: Partial<TemplateField>) => {
    setFields(prev => prev.map(f => f.id === id ? { ...f, ...patch } : f));
  }, []);

  const autoSaveField = useCallback(async (field: TemplateField) => {
    if (!templateId) return;
    try { await SiteTemplatesService.saveField(templateId, field); }
    catch { toast.error('Failed to auto-save field.'); }
  }, [templateId]);

  const updateAndSaveField = useCallback((id: string, patch: Partial<TemplateField>) => {
    setFields(prev => {
      const updated = prev.map(f => f.id === id ? { ...f, ...patch } : f);
      const field = updated.find(f => f.id === id);
      if (field && templateId) {
        SiteTemplatesService.saveField(templateId, field)
          .catch(() => toast.error('Failed to save field.'));
      }
      return updated;
    });
  }, [templateId]);

  const handleAddField = async (sectionId: string) => {
    if (!templateId) return;
    const order = fields.filter(f => f.sectionId === sectionId).length;
    const field = makeField(sectionId, order);
    setFields(prev => [...prev, field]);
    setSelectedFieldId(field.id);
    try { await SiteTemplatesService.saveField(templateId, field); }
    catch { toast.error('Failed to add field.'); }
  };

  const handleDeleteField = async (fieldId: string) => {
    if (!templateId) return;
    setFields(prev => prev.filter(f => f.id !== fieldId));
    if (selectedFieldId === fieldId) setSelectedFieldId(null);
    try {
      await SiteTemplatesService.deleteField(templateId, fieldId);
      toast.success('Field deleted.');
    } catch { toast.error('Failed to delete field.'); }
  };

  // Field drag end (per-section)
  const handleFieldDragEnd = useCallback((sectionId: string, event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setFields(prev => {
      const sectionFields = prev
        .filter(f => f.sectionId === sectionId)
        .sort((a, b) => a.order - b.order);
      const oldIndex = sectionFields.findIndex(f => f.id === active.id);
      const newIndex = sectionFields.findIndex(f => f.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      const reordered = arrayMove(sectionFields, oldIndex, newIndex).map((f, i) => ({ ...f, order: i }));
      if (templateId) {
        Promise.all(reordered.map(f => SiteTemplatesService.saveField(templateId, f)))
          .catch(() => toast.error('Failed to save field order.'));
      }
      const others = prev.filter(f => f.sectionId !== sectionId);
      return [...others, ...reordered];
    });
  }, [templateId]);

  // ---- Template metadata ---------------------------------------------------
  const updateTemplateMeta = (patch: Partial<SiteTemplate>) =>
    setTemplate(prev => prev ? { ...prev, ...patch } : prev);

  const autoSaveTemplateMeta = async (patch: Partial<SiteTemplate>) => {
    if (!templateId) return;
    try { await SiteTemplatesService.updateTemplate(templateId, patch); }
    catch { toast.error('Failed to save template.'); }
  };

  // ---- Save all ------------------------------------------------------------
  const handleSave = async () => {
    if (!templateId || !template) return;
    setSaving(true);
    try {
      await Promise.all([
        SiteTemplatesService.batchSaveFields(templateId, fields),
        SiteTemplatesService.batchSaveSections(templateId, sections),
        SiteTemplatesService.updateTemplate(templateId, {
          name: template.name,
          siteType: template.siteType,
          fieldCount: fields.length,
        }),
      ]);
      toast.success('Template saved.');
    } catch { toast.error('Save failed. Please try again.'); }
    finally { setSaving(false); }
  };

  // ---- Publish toggle ------------------------------------------------------
  const handlePublishToggle = async () => {
    if (!templateId || !template) return;
    setPublishing(true);
    try {
      if (template.status === 'published') {
        await SiteTemplatesService.archiveTemplate(templateId);
        setTemplate(prev => prev ? { ...prev, status: 'draft' } : prev);
        toast.success('Template unpublished.');
      } else {
        await SiteTemplatesService.publishTemplate(templateId);
        setTemplate(prev => prev ? { ...prev, status: 'published' } : prev);
        toast.success('Template published.');
      }
    } catch { toast.error('Action failed.'); }
    finally { setPublishing(false); }
  };

  // ---------------------------------------------------------------------------
  // Loading / error
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex flex-col h-screen">
        <div className="h-14 border-b px-4 flex items-center gap-3">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-5 w-64" />
          <div className="ml-auto flex gap-2">
            <Skeleton className="h-8 w-20" /><Skeleton className="h-8 w-24" />
          </div>
        </div>
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 p-4 space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
          </div>
          <div className="w-80 border-l p-4 space-y-3">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        </div>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-3">
        <p className="text-muted-foreground">Template not found.</p>
        <Button variant="outline" onClick={() => navigate('/templates')}>Back to Templates</Button>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col h-screen overflow-hidden">

      {/* Header */}
      <header className="h-14 border-b flex items-center gap-3 px-4 shrink-0 bg-background z-10">
        <Button variant="ghost" size="icon" className="h-8 w-8"
          onClick={() => navigate('/templates')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>

        <Input
          value={template.name}
          onChange={e => updateTemplateMeta({ name: e.target.value })}
          onBlur={e => autoSaveTemplateMeta({ name: e.target.value })}
          className="h-8 text-sm font-semibold max-w-xs border-transparent hover:border-input focus:border-input bg-transparent"
        />

        <Badge variant={template.status === 'published' ? 'default' : 'secondary'} className="shrink-0">
          {template.status === 'published' ? 'Published' : 'Draft'}
        </Badge>

        <div className="ml-auto flex items-center gap-2">
          {/* Preview */}
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Eye className="h-3.5 w-3.5 mr-1.5" />Preview
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Form Preview — {template.name}</DialogTitle>
              </DialogHeader>
              <DynamicFormRenderer
                sections={sections}
                fields={fields}
                userRole="admin"
                mode="preview"
              />
            </DialogContent>
          </Dialog>

          <Button variant="outline" size="sm" onClick={handleSave} disabled={saving}>
            <Save className="h-3.5 w-3.5 mr-1.5" />
            {saving ? 'Saving…' : 'Save'}
          </Button>

          <Button
            size="sm"
            variant={template.status === 'published' ? 'outline' : 'default'}
            onClick={handlePublishToggle}
            disabled={publishing}
          >
            {template.status === 'published'
              ? <><EyeOff className="h-3.5 w-3.5 mr-1.5" />Unpublish</>
              : <><Globe className="h-3.5 w-3.5 mr-1.5" />Publish</>
            }
          </Button>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left: section + field canvas */}
        <ScrollArea className="flex-1 border-r">
          <div className="p-4 space-y-3 max-w-3xl mx-auto">

            {/* Template metadata */}
            <div className="grid grid-cols-2 gap-3 pb-1">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Site Type</Label>
                <Input
                  value={template.siteType}
                  onChange={e => updateTemplateMeta({ siteType: e.target.value })}
                  onBlur={e => autoSaveTemplateMeta({ siteType: e.target.value })}
                  placeholder="e.g. Cemetery"
                  className="h-8 text-sm"
                />
              </div>
              <div className="flex items-end pb-0.5">
                <p className="text-xs text-muted-foreground">
                  {fields.length} field{fields.length !== 1 ? 's' : ''} · {sections.length} section{sections.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            <Separator />

            {/* Sections with outer DnD context */}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleSectionDragEnd}
            >
              <SortableContext
                items={sections.map(s => s.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-3">
                  {sections.map(section => {
                    const sFields = fieldsBySection(section.id);
                    const isCollapsed = collapsedSections.has(section.id);

                    return (
                      <SortableSectionContainer
                        key={section.id}
                        section={section}
                        isCollapsed={isCollapsed}
                        fieldCount={sFields.length}
                        onToggleCollapse={toggleSection}
                        onSectionChange={updateSection}
                        onSectionBlur={autoSaveSection}
                      >
                        {/* Inner DnD context for fields within this section */}
                        <DndContext
                          sensors={sensors}
                          collisionDetection={closestCenter}
                          onDragEnd={event => handleFieldDragEnd(section.id, event)}
                        >
                          <SortableContext
                            items={sFields.map(f => f.id)}
                            strategy={verticalListSortingStrategy}
                          >
                            <div className="divide-y">
                              {/* Column headers */}
                              {sFields.length > 0 && (
                                <div className="grid grid-cols-[20px_1fr_140px_64px_64px_36px] gap-2 px-3 py-1.5 bg-background">
                                  <span />
                                  <span className="text-xs text-muted-foreground">Label</span>
                                  <span className="text-xs text-muted-foreground">Type</span>
                                  <span className="text-xs text-muted-foreground text-center">Req.</span>
                                  <span className="text-xs text-muted-foreground text-center">Prot.</span>
                                  <span />
                                </div>
                              )}

                              {sFields.map(field => (
                                <SortableFieldRow
                                  key={field.id}
                                  field={field}
                                  isSelected={selectedFieldId === field.id}
                                  onSelect={id =>
                                    setSelectedFieldId(prev => prev === id ? null : id)
                                  }
                                  onDelete={handleDeleteField}
                                />
                              ))}

                              {/* Add field */}
                              <div className="px-3 py-2 bg-background">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs text-muted-foreground"
                                  onClick={() => handleAddField(section.id)}
                                >
                                  <Plus className="h-3 w-3 mr-1" />
                                  Add field
                                </Button>
                              </div>
                            </div>
                          </SortableContext>
                        </DndContext>
                      </SortableSectionContainer>
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>

            {/* Add section */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full border-dashed"
              onClick={handleAddSection}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add Section
            </Button>
          </div>
        </ScrollArea>

        {/* Right: property panel */}
        <div className="w-80 xl:w-96 shrink-0 bg-background">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-5">
              {!selectedField ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <p className="text-sm text-muted-foreground">
                    Click any field row to edit its properties
                  </p>
                </div>
              ) : (
                <FieldEditor
                  key={selectedField.id}
                  field={selectedField}
                  allFields={fields}
                  onUpdate={updateField}
                  onUpdateAndSave={updateAndSaveField}
                  onBlurSave={autoSaveField}
                  onDelete={() => handleDeleteField(selectedField.id)}
                />
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
