import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Upload, FileText, Trash2, Plus, ChevronDown, ChevronUp, X, Circle, Square } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { useUser } from '@/hooks/use-user';
import { parsePdfTemplate } from '@/services/pdfParser';
import { SiteTemplatesService } from '@/services/siteTemplates';
import type { TemplateField, TemplateSection, FieldType } from '@/types/siteTemplates';
import { ResponsiveLayout } from '@/components/ResponsiveLayout';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FIELD_TYPES: FieldType[] = [
  'text', 'textarea', 'number', 'date',
  'select', 'multiselect', 'radio', 'checkbox',
  'coordinates_latlong', 'coordinates_utm',
  'file_upload', 'repeating_group',
  'section_header', 'divider',
];

const TYPES_WITH_OPTIONS: FieldType[] = ['select', 'multiselect', 'radio', 'checkbox'];

type Step = 'upload' | 'parsing' | 'review' | 'saving';

// ---------------------------------------------------------------------------
// InlineOptionsEditor
// ---------------------------------------------------------------------------

function InlineOptionsEditor({
  options,
  onChange,
  fieldType,
}: {
  options: string[];
  onChange: (opts: string[]) => void;
  fieldType: FieldType;
}) {
  const [draft, setDraft] = useState('');

  const addOption = () => {
    const val = draft.trim();
    if (!val) return;
    onChange([...options, val]);
    setDraft('');
  };

  const isRadio = fieldType === 'radio';
  const OptionIcon = isRadio ? Circle : Square;

  return (
    <div className="ml-2 mt-1 mb-2 pl-3 border-l-2 border-muted space-y-1">
      <span className="text-xs font-medium text-muted-foreground">Options</span>
      {options.length === 0 && (
        <p className="text-xs text-muted-foreground italic">No options yet — add one below</p>
      )}
      {options.map((opt, i) => (
        <div key={i} className="flex items-center gap-2 group">
          <OptionIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-sm flex-1">{opt}</span>
          <button
            type="button"
            className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => onChange(options.filter((_, idx) => idx !== i))}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <div className="flex items-center gap-1 pt-0.5">
        <OptionIcon className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
        <Input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOption(); } }}
          placeholder="Add option…"
          className="h-7 text-xs flex-1 px-2"
        />
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={addOption}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TemplateImportPDF() {
  const navigate = useNavigate();
  const { user } = useUser();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('upload');
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Editable template state (populated after Claude parses)
  const [templateName, setTemplateName] = useState('');
  const [siteType, setSiteType] = useState('');
  const [sections, setSections] = useState<TemplateSection[]>([]);
  const [fields, setFields] = useState<TemplateField[]>([]);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  // ---------------------------------------------------------------------------
  // File selection
  // ---------------------------------------------------------------------------

  const handleFile = useCallback((file: File) => {
    if (file.type !== 'application/pdf') {
      toast.error('Please select a PDF file.');
      return;
    }
    setSelectedFile(file);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  // ---------------------------------------------------------------------------
  // Parse
  // ---------------------------------------------------------------------------

  const handleParse = async () => {
    if (!selectedFile || !user?.organizationId) return;
    setStep('parsing');
    try {
      const parsed = await parsePdfTemplate(selectedFile, user.organizationId);
      setTemplateName(parsed.templateName);
      setSiteType(parsed.siteType);
      setSections(parsed.sections);
      setFields(parsed.fields);
      setStep('review');
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to parse PDF. Please try again.');
      setStep('upload');
    }
  };

  // ---------------------------------------------------------------------------
  // Field editors
  // ---------------------------------------------------------------------------

  const updateField = (id: string, patch: Partial<TemplateField>) => {
    setFields(prev => prev.map(f => f.id === id ? { ...f, ...patch } : f));
  };

  const deleteField = (id: string) => {
    setFields(prev => prev.filter(f => f.id !== id));
  };

  const addField = (sectionId: string) => {
    const sectionFields = fields.filter(f => f.sectionId === sectionId);
    const newField: TemplateField = {
      id: `field-${Date.now()}`,
      sectionId,
      label: 'New Field',
      fieldType: 'text',
      order: sectionFields.length,
      isRequired: false,
      isHidden: false,
      isProtected: false,
    };
    setFields(prev => [...prev, newField]);
  };

  const toggleSectionCollapse = (sectionId: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      next.has(sectionId) ? next.delete(sectionId) : next.add(sectionId);
      return next;
    });
  };

  // ---------------------------------------------------------------------------
  // Save
  // ---------------------------------------------------------------------------

  const handleSave = async () => {
    if (!user?.organizationId) return;
    if (!templateName.trim()) {
      toast.error('Template name is required.');
      return;
    }

    setStep('saving');
    try {
      const templateId = await SiteTemplatesService.createTemplate({
        orgId: user.organizationId,
        name: templateName.trim(),
        siteType: siteType.trim() || 'Unknown',
        sourceType: 'pdf_digitized',
        status: 'draft',
        createdBy: user.uid,
        fieldCount: fields.length,
      });

      await Promise.all([
        SiteTemplatesService.batchSaveSections(templateId, sections),
        SiteTemplatesService.batchSaveFields(templateId, fields),
      ]);

      toast.success('Template saved as draft!');
      navigate(`/templates/${templateId}/edit`);
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to save template.');
      setStep('review');
    }
  };

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const fieldsBySection = (sectionId: string) =>
    fields.filter(f => f.sectionId === sectionId).sort((a, b) => a.order - b.order);

  // ---------------------------------------------------------------------------
  // Upload step
  // ---------------------------------------------------------------------------

  if (step === 'upload') {
    return (
      <ResponsiveLayout>
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Import Form from PDF</h1>
          <p className="text-muted-foreground mt-1">
            Upload any archaeological site form PDF. ArchePal will extract sections and fields automatically.
          </p>
        </div>

        {/* Drop zone */}
        <div
          className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors
            ${dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 hover:border-primary/50'}`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
        >
          <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
          <p className="font-medium">Drop a PDF here or click to browse</p>
          <p className="text-sm text-muted-foreground mt-1">PDF files only</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={onFileChange}
          />
        </div>

        {/* Selected file */}
        {selectedFile && (
          <Card>
            <CardContent className="flex items-center gap-3 py-4">
              <FileText className="h-5 w-5 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSelectedFile(null)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        <Button
          className="w-full"
          disabled={!selectedFile}
          onClick={handleParse}
        >
          Extract Form Now
        </Button>
      </div>
      </ResponsiveLayout>
    );
  }

  // ---------------------------------------------------------------------------
  // Parsing step (loading skeleton)
  // ---------------------------------------------------------------------------

  if (step === 'parsing') {
    return (
      <ResponsiveLayout>
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Analyzing PDF…</h1>
          <p className="text-muted-foreground mt-1">
            This takes 30–45 seconds.
          </p>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-48" />
              </CardHeader>
              <CardContent className="space-y-3">
                {[1, 2, 3, 4].map(j => (
                  <div key={j} className="flex gap-4 items-center">
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-12" />
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
      </ResponsiveLayout>
    );
  }

  // ---------------------------------------------------------------------------
  // Review step
  // ---------------------------------------------------------------------------

  return (
    <ResponsiveLayout>
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1 flex-1 min-w-0">
          <h1 className="text-2xl font-bold">Review Parsed Template</h1>
          <p className="text-muted-foreground text-sm">
            {fields.length} fields across {sections.length} sections extracted.
            Edit labels, types, and toggles before saving.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" onClick={() => setStep('upload')}>
            Re-upload
          </Button>
          <Button onClick={handleSave} disabled={step === 'saving'}>
            {step === 'saving' ? 'Saving…' : 'Save as Draft'}
          </Button>
        </div>
      </div>

      {/* Template metadata */}
      <Card>
        <CardContent className="pt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="template-name">Template Name</Label>
            <Input
              id="template-name"
              value={templateName}
              onChange={e => setTemplateName(e.target.value)}
              placeholder="e.g. NC Cemetery Site Form"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="site-type">Site Type</Label>
            <Input
              id="site-type"
              value={siteType}
              onChange={e => setSiteType(e.target.value)}
              placeholder="e.g. Cemetery"
            />
          </div>
        </CardContent>
      </Card>

      {/* Sections + fields */}
      <ScrollArea className="h-[calc(100vh-320px)]">
        <div className="space-y-4 pr-2">
          {sections.map(section => (
            <Card key={section.id}>
              {/* Section header */}
              <CardHeader
                className="cursor-pointer select-none"
                onClick={() => toggleSectionCollapse(section.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">{section.title}</CardTitle>
                    {section.isProtected && (
                      <Badge variant="secondary">Protected</Badge>
                    )}
                    <Badge variant="outline" className="text-xs">
                      {fieldsBySection(section.id).length} fields
                    </Badge>
                  </div>
                  {collapsedSections.has(section.id)
                    ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    : <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  }
                </div>
              </CardHeader>

              {!collapsedSections.has(section.id) && (
                <CardContent className="space-y-2 pt-0">
                  {/* Column headers */}
                  <div className="grid grid-cols-[1fr_180px_80px_36px] gap-2 px-1 pb-1">
                    <span className="text-xs text-muted-foreground font-medium">Label</span>
                    <span className="text-xs text-muted-foreground font-medium">Field Type</span>
                    <span className="text-xs text-muted-foreground font-medium text-center">Required</span>
                    <span />
                  </div>

                  <Separator />

                  {/* Fields */}
                  {fieldsBySection(section.id).map(f => (
                    <div key={f.id} className="space-y-0">
                      <div className="grid grid-cols-[1fr_180px_80px_36px] gap-2 items-center py-1">
                        <div className="flex items-center gap-1.5">
                          {f.fieldType === 'radio' && (
                            <Circle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          )}
                          {(f.fieldType === 'checkbox' || f.fieldType === 'multiselect') && (
                            <Square className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          )}
                          <Input
                            value={f.label}
                            onChange={e => updateField(f.id, { label: e.target.value })}
                            className="h-8 text-sm"
                          />
                        </div>
                        <Select
                          value={f.fieldType}
                          onValueChange={val => updateField(f.id, { fieldType: val as FieldType })}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {FIELD_TYPES.map(t => (
                              <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="flex justify-center">
                          <Switch
                            checked={f.isRequired}
                            onCheckedChange={v => updateField(f.id, { isRequired: v })}
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => deleteField(f.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      {/* Options editor — shown for select/multiselect/radio/checkbox */}
                      {TYPES_WITH_OPTIONS.includes(f.fieldType) && (
                        <InlineOptionsEditor
                          options={f.options ?? []}
                          fieldType={f.fieldType}
                          onChange={opts => updateField(f.id, { options: opts })}
                        />
                      )}
                    </div>
                  ))}

                  {/* Add field */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-1 text-muted-foreground w-full justify-start"
                    onClick={() => addField(section.id)}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add field
                  </Button>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
    </ResponsiveLayout>
  );
}
