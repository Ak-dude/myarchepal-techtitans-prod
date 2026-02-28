import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowLeft, Plus, Trash2, ChevronDown, ChevronUp,
  GripVertical, Eye, Layers, LayoutGrid,
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
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';

import { useUser } from '@/hooks/use-user';
import { SiteTemplatesService } from '@/services/siteTemplates';
import DynamicFormRenderer from '@/components/DynamicFormRenderer';
import FieldEditor, { FIELD_TYPES } from '@/components/templates/FieldEditor';
import type { TemplateField, TemplateSection, FieldType } from '@/types/siteTemplates';

// ---------------------------------------------------------------------------
// Pre-built archaeological module blocks
// ---------------------------------------------------------------------------

interface PresetBlock {
  label: string;
  description: string;
  section: Omit<TemplateSection, 'id' | 'order'>;
  fields: Omit<TemplateField, 'id' | 'sectionId' | 'order'>[];
}

const PRESET_BLOCKS: PresetBlock[] = [
  {
    label: 'Coordinates Block',
    description: 'Lat/Long + UTM + datum',
    section: { title: 'Coordinates', isCollapsible: true, isProtected: false },
    fields: [
      { label: 'Coordinates (Lat/Long)', fieldType: 'coordinates_latlong', isRequired: true, isHidden: false, isProtected: false },
      { label: 'Coordinates (UTM)', fieldType: 'coordinates_utm', isRequired: false, isHidden: false, isProtected: false },
    ],
  },
  {
    label: 'Environment & Condition',
    description: 'Elevation, soil, drainage, damage, threatened',
    section: { title: 'Environment & Condition', isCollapsible: true, isProtected: false },
    fields: [
      { label: 'Elevation (ft)', fieldType: 'number', isRequired: false, isHidden: false, isProtected: false },
      { label: 'Soil Type', fieldType: 'select', isRequired: false, isHidden: false, isProtected: false, options: ['Sandy', 'Clay', 'Loam', 'Rocky', 'Silty', 'Mixed'] },
      { label: 'Drainage', fieldType: 'select', isRequired: false, isHidden: false, isProtected: false, options: ['Well-drained', 'Moderately drained', 'Somewhat poorly drained', 'Poorly drained'] },
      { label: 'Damage Observed', fieldType: 'multiselect', isRequired: false, isHidden: false, isProtected: false, options: ['Erosion', 'Vandalism', 'Development encroachment', 'Agriculture', 'Flooding', 'None visible'] },
      { label: 'Threatened By', fieldType: 'radio', isRequired: false, isHidden: false, isProtected: false, options: ['Development', 'Agriculture', 'Natural processes', 'Erosion', 'None'] },
    ],
  },
  {
    label: 'Damage Assessment',
    description: 'Type, extent, probable cause, notes',
    section: { title: 'Damage Assessment', isCollapsible: true, isProtected: false },
    fields: [
      { label: 'Damage Type', fieldType: 'select', isRequired: false, isHidden: false, isProtected: false, options: ['Structural', 'Surface disturbance', 'Sub-surface disturbance', 'Vegetation removal', 'None'] },
      { label: 'Extent of Damage', fieldType: 'radio', isRequired: false, isHidden: false, isProtected: false, options: ['None', 'Minor (< 25%)', 'Moderate (25–50%)', 'Major (> 50%)', 'Destroyed'] },
      { label: 'Probable Cause', fieldType: 'multiselect', isRequired: false, isHidden: false, isProtected: false, options: ['Natural (erosion/flooding)', 'Agricultural activity', 'Construction/grading', 'Vandalism/looting', 'Unknown'] },
      { label: 'Damage Notes', fieldType: 'textarea', isRequired: false, isHidden: false, isProtected: false, placeholder: 'Describe observed damage in detail…' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function makeField(sectionId: string, order: number, overrides: Partial<TemplateField> = {}): TemplateField {
  return {
    id: makeId('field'),
    sectionId,
    label: 'New Field',
    fieldType: 'text',
    order,
    isRequired: false,
    isHidden: false,
    isProtected: false,
    ...overrides,
  };
}

function makeSection(order: number, overrides: Partial<TemplateSection> = {}): TemplateSection {
  return {
    id: makeId('section'),
    title: 'New Section',
    order,
    isCollapsible: true,
    isProtected: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Friendly display labels for the field type palette
// ---------------------------------------------------------------------------

const PALETTE_LABELS: Partial<Record<FieldType, string>> = {
  text: 'Text',
  textarea: 'Long Text',
  number: 'Number',
  date: 'Date',
  select: 'Dropdown',
  multiselect: 'Multi-select',
  radio: 'Radio',
  checkbox: 'Checkbox',
  coordinates_latlong: 'Lat / Long',
  coordinates_utm: 'UTM',
  file_upload: 'File Upload',
  repeating_group: 'Repeating Group',
  section_header: 'Section Header',
  divider: 'Divider',
};

// ---------------------------------------------------------------------------
// SortableFieldRow (same pattern as TemplateEditor)
// ---------------------------------------------------------------------------

function SortableFieldRow({
  field, isSelected, onSelect, onDelete,
}: {
  field: TemplateField;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
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
      className={`grid grid-cols-[20px_1fr_140px_36px] gap-2 items-center px-3 py-2 cursor-pointer transition-colors ${
        isSelected ? 'bg-primary/5 border-l-2 border-l-primary' : 'hover:bg-muted/30'
      }`}
      onClick={() => onSelect(field.id)}
    >
      <button
        className="cursor-grab active:cursor-grabbing text-muted-foreground"
        onClick={e => e.stopPropagation()}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <span className="text-sm truncate font-medium">{field.label}</span>
      <Badge variant="outline" className="text-xs w-fit">{PALETTE_LABELS[field.fieldType] ?? field.fieldType}</Badge>
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
              <strong>{field.label}</strong> will be removed from the canvas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => onDelete(field.id)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SortableSectionContainer (same pattern as TemplateEditor)
// ---------------------------------------------------------------------------

function SortableSectionContainer({
  section, isCollapsed, onToggleCollapse, onSectionChange, fieldCount, children,
}: {
  section: TemplateSection;
  isCollapsed: boolean;
  onToggleCollapse: (id: string) => void;
  onSectionChange: (id: string, patch: Partial<TemplateSection>) => void;
  fieldCount: number;
  children: React.ReactNode;
}) {
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
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/30">
        <button
          className="cursor-grab active:cursor-grabbing text-muted-foreground shrink-0"
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
            className="h-7 text-sm font-medium border-transparent hover:border-input focus:border-input bg-transparent min-w-0"
          />
          <Badge variant="outline" className="text-xs shrink-0">
            {fieldCount} field{fieldCount !== 1 ? 's' : ''}
          </Badge>
        </button>
        <div className="flex items-center gap-1.5 shrink-0">
          <Label className="text-xs text-muted-foreground">Admin only</Label>
          <Switch
            checked={section.isProtected}
            onCheckedChange={v => onSectionChange(section.id, { isProtected: v })}
          />
        </div>
      </div>
      {!isCollapsed && children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TemplateBuilder
// ---------------------------------------------------------------------------

export default function TemplateBuilder() {
  const navigate = useNavigate();
  const { user } = useUser();

  // ---- Template metadata ---------------------------------------------------
  const [templateName, setTemplateName] = useState('');
  const [siteType, setSiteType] = useState('');

  // ---- Canvas state --------------------------------------------------------
  const [sections, setSections] = useState<TemplateSection[]>([]);
  const [fields, setFields] = useState<TemplateField[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);

  // ---- UI state ------------------------------------------------------------
  const [saving, setSaving] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(true);

  // ---- DnD sensors ---------------------------------------------------------
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  // ---- Derived -------------------------------------------------------------
  const selectedField = fields.find(f => f.id === selectedFieldId) ?? null;

  const fieldsBySection = useCallback(
    (sectionId: string) =>
      fields.filter(f => f.sectionId === sectionId).sort((a, b) => a.order - b.order),
    [fields],
  );

  /** Returns the section to add a new field to — active, last, or first available. */
  const getTargetSectionId = (): string | null => {
    if (activeSectionId && sections.find(s => s.id === activeSectionId)) return activeSectionId;
    if (sections.length > 0) return sections[sections.length - 1].id;
    return null;
  };

  // ---- Palette actions -----------------------------------------------------
  const handleAddFieldType = (fieldType: FieldType) => {
    let sectionId = getTargetSectionId();
    if (!sectionId) {
      // Auto-create a first section
      const section = makeSection(0, { title: 'Section 1' });
      setSections([section]);
      sectionId = section.id;
      setActiveSectionId(section.id);
    }
    const order = fields.filter(f => f.sectionId === sectionId).length;
    const field = makeField(sectionId!, order, {
      fieldType,
      label: PALETTE_LABELS[fieldType] ?? fieldType,
    });
    setFields(prev => [...prev, field]);
    setSelectedFieldId(field.id);
    // Ensure the target section is expanded
    setCollapsedSections(prev => {
      const next = new Set(prev);
      next.delete(sectionId!);
      return next;
    });
  };

  const handleInsertBlock = (block: PresetBlock) => {
    const sectionOrder = sections.length;
    const section = makeSection(sectionOrder, block.section);
    const blockFields: TemplateField[] = block.fields.map((f, i) =>
      makeField(section.id, i, f),
    );
    setSections(prev => [...prev, section]);
    setFields(prev => [...prev, ...blockFields]);
    setActiveSectionId(section.id);
    setCollapsedSections(prev => {
      const next = new Set(prev);
      next.delete(section.id);
      return next;
    });
    toast.success(`"${block.label}" block added.`);
  };

  // ---- Section actions -----------------------------------------------------
  const toggleSection = (id: string) =>
    setCollapsedSections(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const updateSection = (id: string, patch: Partial<TemplateSection>) =>
    setSections(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));

  const handleAddSection = () => {
    const section = makeSection(sections.length);
    setSections(prev => [...prev, section]);
    setActiveSectionId(section.id);
  };

  const handleSectionDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setSections(prev => {
      const oldIndex = prev.findIndex(s => s.id === active.id);
      const newIndex = prev.findIndex(s => s.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex).map((s, i) => ({ ...s, order: i }));
    });
  }, []);

  // ---- Field actions -------------------------------------------------------
  const updateField = useCallback((id: string, patch: Partial<TemplateField>) => {
    setFields(prev => prev.map(f => f.id === id ? { ...f, ...patch } : f));
  }, []);

  // updateAndSave is local-only in the builder (no templateId yet)
  const updateAndSaveField = useCallback((id: string, patch: Partial<TemplateField>) => {
    setFields(prev => prev.map(f => f.id === id ? { ...f, ...patch } : f));
  }, []);

  const handleDeleteField = (fieldId: string) => {
    setFields(prev => prev.filter(f => f.id !== fieldId));
    if (selectedFieldId === fieldId) setSelectedFieldId(null);
  };

  const handleAddField = (sectionId: string) => {
    const order = fields.filter(f => f.sectionId === sectionId).length;
    const field = makeField(sectionId, order);
    setFields(prev => [...prev, field]);
    setSelectedFieldId(field.id);
    setActiveSectionId(sectionId);
  };

  const handleFieldDragEnd = useCallback((sectionId: string, event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setFields(prev => {
      const sectionFields = prev.filter(f => f.sectionId === sectionId).sort((a, b) => a.order - b.order);
      const oldIndex = sectionFields.findIndex(f => f.id === active.id);
      const newIndex = sectionFields.findIndex(f => f.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      const reordered = arrayMove(sectionFields, oldIndex, newIndex).map((f, i) => ({ ...f, order: i }));
      const others = prev.filter(f => f.sectionId !== sectionId);
      return [...others, ...reordered];
    });
  }, []);

  // ---- Create template -----------------------------------------------------
  const handleCreate = async () => {
    if (!templateName.trim()) {
      toast.error('Template name is required.');
      return;
    }
    if (!siteType.trim()) {
      toast.error('Site type is required.');
      return;
    }
    if (!user?.organizationId) return;

    setSaving(true);
    try {
      const templateId = await SiteTemplatesService.createTemplate({
        orgId: user.organizationId,
        name: templateName.trim(),
        siteType: siteType.trim(),
        sourceType: 'blank_canvas',
        status: 'draft',
        createdBy: user.uid,
        fieldCount: fields.length,
      });
      await Promise.all([
        SiteTemplatesService.batchSaveSections(templateId, sections),
        SiteTemplatesService.batchSaveFields(templateId, fields),
      ]);
      toast.success('Template created!');
      navigate(`/templates/${templateId}/edit`);
    } catch {
      toast.error('Failed to create template. Please try again.');
    } finally {
      setSaving(false);
    }
  };

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

        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Input
            value={templateName}
            onChange={e => setTemplateName(e.target.value)}
            placeholder="Template name…"
            className="h-8 text-sm font-semibold max-w-[220px] border-transparent hover:border-input focus:border-input bg-transparent"
          />
          <Input
            value={siteType}
            onChange={e => setSiteType(e.target.value)}
            placeholder="Site type…"
            className="h-8 text-sm max-w-[160px]"
          />
          <Badge variant="secondary" className="shrink-0">Blank Canvas</Badge>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Preview */}
          {sections.length > 0 && (
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Eye className="h-3.5 w-3.5 mr-1.5" />Preview
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Form Preview — {templateName || 'Untitled'}</DialogTitle>
                </DialogHeader>
                <DynamicFormRenderer
                  sections={sections}
                  fields={fields}
                  userRole="admin"
                  mode="preview"
                />
              </DialogContent>
            </Dialog>
          )}

          <Button size="sm" onClick={handleCreate} disabled={saving}>
            {saving ? 'Creating…' : 'Create Template'}
          </Button>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left: palette + canvas */}
        <ScrollArea className="flex-1 border-r">
          <div className="p-4 space-y-4 max-w-3xl mx-auto">

            {/* Field Palette */}
            <Collapsible open={paletteOpen} onOpenChange={setPaletteOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm" className="w-full justify-between">
                  <span className="flex items-center gap-2">
                    <LayoutGrid className="h-3.5 w-3.5" />
                    Field Palette
                  </span>
                  {paletteOpen
                    ? <ChevronUp className="h-3.5 w-3.5" />
                    : <ChevronDown className="h-3.5 w-3.5" />
                  }
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-2 p-3 border rounded-xl bg-muted/20 space-y-3">
                  {/* Field types */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Field Types</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {FIELD_TYPES.map(ft => (
                        <button
                          key={ft}
                          onClick={() => handleAddFieldType(ft)}
                          className="flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium rounded-lg border bg-background hover:bg-primary/5 hover:border-primary/40 transition-colors text-left"
                        >
                          <Plus className="h-3 w-3 text-muted-foreground shrink-0" />
                          {PALETTE_LABELS[ft] ?? ft}
                        </button>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Pre-built blocks */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5" />
                      Pre-built Blocks
                    </p>
                    <div className="space-y-1.5">
                      {PRESET_BLOCKS.map(block => (
                        <button
                          key={block.label}
                          onClick={() => handleInsertBlock(block)}
                          className="w-full flex items-start gap-2 px-3 py-2 rounded-lg border bg-background hover:bg-primary/5 hover:border-primary/40 transition-colors text-left"
                        >
                          <Plus className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                          <div>
                            <p className="text-xs font-semibold">{block.label}</p>
                            <p className="text-xs text-muted-foreground">{block.description}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            {/* Canvas */}
            {sections.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed rounded-xl">
                <LayoutGrid className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="font-medium text-sm">Canvas is empty</p>
                <p className="text-xs text-muted-foreground mt-1 mb-4">
                  Use the palette above to add fields, or insert a pre-built block.
                </p>
                <Button variant="outline" size="sm" onClick={handleAddSection}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" />Add Section
                </Button>
              </div>
            ) : (
              <>
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleSectionDragEnd}
                >
                  <SortableContext items={sections.map(s => s.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-3">
                      {sections.map(section => {
                        const sFields = fieldsBySection(section.id);
                        const isCollapsed = collapsedSections.has(section.id);
                        const isActive = activeSectionId === section.id;

                        return (
                          <SortableSectionContainer
                            key={section.id}
                            section={section}
                            isCollapsed={isCollapsed}
                            fieldCount={sFields.length}
                            onToggleCollapse={toggleSection}
                            onSectionChange={updateSection}
                          >
                            <DndContext
                              sensors={sensors}
                              collisionDetection={closestCenter}
                              onDragEnd={event => handleFieldDragEnd(section.id, event)}
                            >
                              <SortableContext items={sFields.map(f => f.id)} strategy={verticalListSortingStrategy}>
                                <div
                                  className={`divide-y ${isActive ? 'ring-1 ring-primary/20' : ''}`}
                                  onClick={() => setActiveSectionId(section.id)}
                                >
                                  {sFields.length > 0 && (
                                    <div className="grid grid-cols-[20px_1fr_140px_36px] gap-2 px-3 py-1.5 bg-background">
                                      <span />
                                      <span className="text-xs text-muted-foreground">Label</span>
                                      <span className="text-xs text-muted-foreground">Type</span>
                                      <span />
                                    </div>
                                  )}
                                  {sFields.map(field => (
                                    <SortableFieldRow
                                      key={field.id}
                                      field={field}
                                      isSelected={selectedFieldId === field.id}
                                      onSelect={id => setSelectedFieldId(prev => prev === id ? null : id)}
                                      onDelete={handleDeleteField}
                                    />
                                  ))}
                                  <div className="px-3 py-2 bg-background">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 text-xs text-muted-foreground"
                                      onClick={e => { e.stopPropagation(); handleAddField(section.id); }}
                                    >
                                      <Plus className="h-3 w-3 mr-1" />Add field
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
              </>
            )}
          </div>
        </ScrollArea>

        {/* Right: property panel */}
        <div className="w-80 xl:w-96 shrink-0 bg-background">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-5">
              {!selectedField ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <p className="text-sm text-muted-foreground">
                    Click any field to edit its properties
                  </p>
                </div>
              ) : (
                <FieldEditor
                  key={selectedField.id}
                  field={selectedField}
                  allFields={fields}
                  onUpdate={updateField}
                  onUpdateAndSave={updateAndSaveField}
                  onBlurSave={() => {}}
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
