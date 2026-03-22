import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Upload, Image as ImageIcon, Loader2, X, LayoutTemplate } from "lucide-react";
import { toast } from "sonner";

import { ResponsiveLayout } from "@/components/ResponsiveLayout";
import { PageHeader } from "@/components/PageHeader";
import { AccountButton } from "@/components/AccountButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import DynamicFormRenderer from "@/components/DynamicFormRenderer";
import { SitesService } from "@/services/sites";
import { SiteTemplatesService } from "@/services/siteTemplates";
import { SiteSubmissionsService } from "@/services/siteSubmissions";
import { useAuth } from "@/hooks/use-auth";
import { useUser } from "@/hooks/use-user";
import type { SiteTemplate, TemplateSection, TemplateField } from "@/types/siteTemplates";

export default function NewSite() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { organization, isOrgAdmin, isSuperAdmin } = useUser();
  const isAdmin = isOrgAdmin || isSuperAdmin;

  const [saving, setSaving] = useState(false);
  const [saveMode, setSaveMode] = useState<'draft' | 'submit' | null>(null);

  // ---- Site basic info -------------------------------------------------------
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ---- Template list for dropdown -------------------------------------------
  const [templateList, setTemplateList] = useState<SiteTemplate[]>([]);
  const [templateListLoading, setTemplateListLoading] = useState(false);

  // Pre-select from URL param if coming from a direct link
  const [selectedTemplateId, setSelectedTemplateId] = useState(
    searchParams.get('templateId') ?? ''
  );

  // ---- Selected template's sections + fields --------------------------------
  const [template, setTemplate] = useState<SiteTemplate | null>(null);
  const [sections, setSections] = useState<TemplateSection[]>([]);
  const [fields, setFields] = useState<TemplateField[]>([]);
  const [fieldsLoading, setFieldsLoading] = useState(false);

  // Form data captured from DynamicFormRenderer
  const [formData, setFormData] = useState<Record<string, unknown>>({});

  // Load template list on mount
  useEffect(() => {
    if (!organization?.id) return;
    setTemplateListLoading(true);
    Promise.all([
      SiteTemplatesService.listTemplates(organization.id).catch(() => [] as SiteTemplate[]),
      SiteTemplatesService.listSystemTemplates().catch(() => [] as SiteTemplate[]),
    ])
      .then(([orgTemplates, systemTemplates]) => {
        const published = orgTemplates.filter(t => t.status === 'published');
        setTemplateList([...systemTemplates, ...published]);
      })
      .finally(() => setTemplateListLoading(false));
  }, [organization?.id]);

  // Load sections + fields whenever selected template changes
  useEffect(() => {
    if (!selectedTemplateId) {
      setTemplate(null);
      setSections([]);
      setFields([]);
      setFormData({});
      return;
    }
    setFieldsLoading(true);
    Promise.all([
      SiteTemplatesService.getTemplate(selectedTemplateId),
      SiteTemplatesService.getTemplateSections(selectedTemplateId),
      SiteTemplatesService.getTemplateFields(selectedTemplateId),
    ])
      .then(([t, s, f]) => {
        setTemplate(t);
        setSections(s);
        setFields(f);
        setFormData({});
      })
      .catch(() => toast.error('Failed to load template fields.'))
      .finally(() => setFieldsLoading(false));
  }, [selectedTemplateId]);

  // ---- Image handling -------------------------------------------------------
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be smaller than 5 MB.'); return; }
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file.'); return; }
    setSelectedImage(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const removeImage = () => { setSelectedImage(null); setImagePreview(null); };

  const handleFormChange = useCallback((values: Record<string, unknown>) => {
    setFormData(values);
  }, []);

  // ---- Create ---------------------------------------------------------------
  const handleCreate = async (mode: 'draft' | 'submit') => {
    if (!user) return;
    if (!name.trim()) { toast.error('Site name is required.'); return; }

    setSaveMode(mode);
    setSaving(true);
    try {
      const siteId = await SitesService.createSite({
        name: name.trim(),
        description: description.trim(),
        status: 'draft',
        location: { latitude: 0, longitude: 0 },
        dateDiscovered: new Date(),
        createdBy: user.uid,
        organizationId: organization?.id,
        visibility: 'private',
        artifacts: [],
        images: [],
        ...(selectedTemplateId ? {
          linkedTemplateId: selectedTemplateId,
          assignedConsultantId: user.uid,
          assignedConsultantEmail: user.email ?? '',
          submissionStatus: mode === 'submit' ? 'submitted' : 'in_progress',
        } : {}),
      });

      if (selectedImage) {
        try {
          const url = await SitesService.uploadSiteImage(siteId, selectedImage);
          await SitesService.updateSiteImages(siteId, [url]);
        } catch {
          toast.warning('Site created, but image upload failed.');
        }
      }

      if (selectedTemplateId) {
        try {
          const submissionId = await SiteSubmissionsService.createSubmission(siteId, {
            siteId,
            templateId: selectedTemplateId,
            consultantId: user.uid,
            organizationId: organization?.id ?? '',
            formData,
            mediaAttachments: [],
            status: mode === 'submit' ? 'submitted' : 'in_progress',
            lastSavedAt: null as any,
            isDraft: mode === 'draft',
          });

          if (mode === 'submit') {
            toast.success('Site created and form submitted!');
            navigate(`/submission/${siteId}/${submissionId}`);
          } else {
            toast.success('Site created — continuing in form...');
            navigate(`/form/${siteId}`);
          }
        } catch {
          toast.warning('Site created, but could not save form data.');
          navigate(`/site/${siteId}`);
        }
      } else {
        toast.success('Site created!');
        navigate(`/site/${siteId}`);
      }
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to create site. Please try again.');
    } finally {
      setSaving(false);
      setSaveMode(null);
    }
  };

  // ---- Permission guard -----------------------------------------------------
  if (!isAdmin) {
    return (
      <ResponsiveLayout>
        <header className="bg-card/95 backdrop-blur-lg px-4 py-4 border-b border-border sticky top-0 z-40">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <PageHeader showLogo={false} />
            <AccountButton />
          </div>
        </header>
        <div className="flex items-center justify-center min-h-[60vh] p-6">
          <div className="text-center space-y-3 max-w-sm">
            <p className="font-semibold">Access Restricted</p>
            <p className="text-sm text-muted-foreground">
              Only organization administrators can create new sites.
            </p>
            <Button variant="outline" onClick={() => navigate('/site-lists')}>
              View Sites
            </Button>
          </div>
        </div>
      </ResponsiveLayout>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <ResponsiveLayout>
      <header className="bg-card/95 backdrop-blur-lg px-4 py-4 border-b border-border sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <PageHeader showLogo={false} />
          <AccountButton />
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        <h1 className="text-2xl font-bold">New Archaeological Site</h1>

        {/* ------------------------------------------------------------------ */}
        {/* Site basic info + template selection in one card                    */}
        {/* ------------------------------------------------------------------ */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Site Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">

            {/* Image upload */}
            {imagePreview ? (
              <div className="relative">
                <img
                  src={imagePreview}
                  alt="Site preview"
                  className="w-full max-h-48 object-cover rounded-lg"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-7 w-7"
                  onClick={removeImage}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <label htmlFor="image-upload" className="cursor-pointer block">
                <div className="flex flex-col items-center justify-center h-36 bg-muted rounded-lg hover:bg-muted/70 transition-colors">
                  <ImageIcon className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">Click to add site image</p>
                  <p className="text-xs text-muted-foreground mt-0.5">JPG, PNG, GIF — max 5 MB</p>
                </div>
              </label>
            )}
            <input
              ref={fileInputRef}
              id="image-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageSelect}
            />
            {!imagePreview && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload Image
              </Button>
            )}

            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="name">
                Site Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                placeholder="e.g. Crowders Mountain Rockshelter"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="description">
                Description{' '}
                <span className="text-muted-foreground text-xs">(optional)</span>
              </Label>
              <Textarea
                id="description"
                placeholder="Brief overview of the site — location, features, significance…"
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            {/* Template dropdown */}
            <div className="space-y-1.5">
              <Label htmlFor="template-select" className="flex items-center gap-1.5">
                <LayoutTemplate className="h-3.5 w-3.5 text-muted-foreground" />
                Form Template{' '}
                <span className="text-muted-foreground text-xs">(optional)</span>
              </Label>
              {templateListLoading ? (
                <Skeleton className="h-10 w-full rounded-md" />
              ) : (
                <Select
                  value={selectedTemplateId || 'none'}
                  onValueChange={v => setSelectedTemplateId(v === 'none' ? '' : v)}
                >
                  <SelectTrigger id="template-select">
                    <SelectValue placeholder="Select a form template…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No template — create site only</SelectItem>
                    {templateList.map(t => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.isSystemTemplate ? '⭐ ' : ''}{t.name}
                        {t.siteType ? ` — ${t.siteType}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {template && (
                <p className="text-xs text-muted-foreground">
                  {template.fieldCount ?? 0} fields · {template.siteType}
                </p>
              )}
              {templateList.length === 0 && !templateListLoading && (
                <p className="text-xs text-muted-foreground">
                  No published templates yet.{' '}
                  <button
                    className="underline text-primary"
                    onClick={() => navigate('/templates')}
                  >
                    Create one first
                  </button>
                  {' '}or continue without a template.
                </p>
              )}
            </div>

          </CardContent>
        </Card>

        {/* ------------------------------------------------------------------ */}
        {/* Template form fields rendered inline                                */}
        {/* ------------------------------------------------------------------ */}
        {selectedTemplateId && (
          fieldsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-28 w-full rounded-xl" />
              ))}
            </div>
          ) : sections.length > 0 ? (
            <DynamicFormRenderer
              sections={sections}
              fields={fields}
              userRole="member"
              mode="fill"
              onChange={handleFormChange}
            />
          ) : null
        )}

        {/* ------------------------------------------------------------------ */}
        {/* Action buttons                                                       */}
        {/* ------------------------------------------------------------------ */}
        <div className="flex gap-3 pb-8">
          {selectedTemplateId ? (
            <>
              <Button
                variant="outline"
                className="flex-1"
                size="lg"
                onClick={() => handleCreate('draft')}
                disabled={saving}
              >
                {saving && saveMode === 'draft'
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</>
                  : 'Save as Draft'
                }
              </Button>
              <Button
                className="flex-1"
                size="lg"
                onClick={() => handleCreate('submit')}
                disabled={saving}
              >
                {saving && saveMode === 'submit'
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Submitting…</>
                  : 'Submit Form'
                }
              </Button>
            </>
          ) : (
            <Button
              className="w-full"
              size="lg"
              onClick={() => handleCreate('draft')}
              disabled={saving}
            >
              {saving
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating…</>
                : 'Create Site'
              }
            </Button>
          )}
        </div>

      </div>
    </ResponsiveLayout>
  );
}
