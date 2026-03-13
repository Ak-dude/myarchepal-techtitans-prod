import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Upload, Image as ImageIcon, Loader2, X, LayoutTemplate,
} from "lucide-react";
import { toast } from "sonner";

import { ResponsiveLayout } from "@/components/ResponsiveLayout";
import { PageHeader } from "@/components/PageHeader";
import { AccountButton } from "@/components/AccountButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

import DynamicFormRenderer from "@/components/DynamicFormRenderer";
import { SitesService } from "@/services/sites";
import { SiteTemplatesService } from "@/services/siteTemplates";
import { SiteSubmissionsService } from "@/services/siteSubmissions";
import { useAuth } from "@/hooks/use-auth";
import { useUser } from "@/hooks/use-user";
import type { SiteTemplate, TemplateSection, TemplateField } from "@/types/siteTemplates";

// ---------------------------------------------------------------------------
// NewSite
// ---------------------------------------------------------------------------

export default function NewSite() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { organization, isOrgAdmin, isSuperAdmin } = useUser();
  const isAdmin = isOrgAdmin || isSuperAdmin;

  const [saving, setSaving] = useState(false);

  // ---- Site basic info -------------------------------------------------------
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ---- Template (pre-selected from CreateSiteModal via URL param) -----------
  const templateIdParam = searchParams.get('templateId') ?? '';
  const [template, setTemplate] = useState<SiteTemplate | null>(null);
  const [templateLoading, setTemplateLoading] = useState(false);

  // ---- Template fields ------------------------------------------------------
  const [sections, setSections] = useState<TemplateSection[]>([]);
  const [fields, setFields] = useState<TemplateField[]>([]);
  const [fieldsLoading, setFieldsLoading] = useState(false);

  // Form data captured from DynamicFormRenderer via onChange
  const [formData, setFormData] = useState<Record<string, unknown>>({});

  // Load template metadata + sections + fields when templateId param is present
  useEffect(() => {
    if (!templateIdParam) {
      setTemplate(null);
      setSections([]);
      setFields([]);
      return;
    }

    setTemplateLoading(true);
    setFieldsLoading(true);

    Promise.all([
      SiteTemplatesService.getTemplate(templateIdParam),
      SiteTemplatesService.getTemplateSections(templateIdParam),
      SiteTemplatesService.getTemplateFields(templateIdParam),
    ])
      .then(([t, s, f]) => {
        setTemplate(t);
        setSections(s);
        setFields(f);
      })
      .catch(() => toast.error('Failed to load template fields.'))
      .finally(() => {
        setTemplateLoading(false);
        setFieldsLoading(false);
      });
  }, [templateIdParam]);

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
  const handleCreate = async () => {
    if (!user) return;
    if (!name.trim()) { toast.error('Site name is required.'); return; }

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
        ...(templateIdParam ? { linkedTemplateId: templateIdParam } : {}),
      });

      if (selectedImage) {
        try {
          const url = await SitesService.uploadSiteImage(siteId, selectedImage);
          await SitesService.updateSiteImages(siteId, [url]);
        } catch {
          toast.warning('Site created, but image upload failed.');
        }
      }

      // If a template was selected and form data was entered, save as a draft submission
      if (templateIdParam) {
        const hasData = Object.values(formData).some(v =>
          v !== undefined && v !== null && v !== '' &&
          !(Array.isArray(v) && v.length === 0)
        );
        if (hasData) {
          try {
            await SiteSubmissionsService.createSubmission(siteId, {
              siteId,
              templateId: templateIdParam,
              consultantId: user.uid,
              organizationId: organization?.id ?? '',
              formData,
              mediaAttachments: [],
              status: 'in_progress',
              lastSavedAt: null as any,
              isDraft: true,
            });
            await SitesService.updateSite(siteId, { submissionStatus: 'in_progress' });
          } catch {
            toast.warning('Site created, but initial form data could not be saved.');
          }
        }
      }

      toast.success('Site created!');
      navigate(`/site/${siteId}`);
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to create site. Please try again.');
    } finally {
      setSaving(false);
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
      {/* Header */}
      <header className="bg-card/95 backdrop-blur-lg px-4 py-4 border-b border-border sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <PageHeader showLogo={false} />
          <AccountButton />
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        <h1 className="text-2xl font-bold">New Archaeological Site</h1>

        {/* ------------------------------------------------------------------ */}
        {/* Selected template pill — shown when a template was picked in modal   */}
        {/* ------------------------------------------------------------------ */}
        {templateIdParam && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-primary/5 border border-primary/20">
            <LayoutTemplate className="h-4 w-4 text-primary shrink-0" />
            {templateLoading ? (
              <Skeleton className="h-4 w-40" />
            ) : template ? (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium">{template.name}</span>
                {template.siteType && (
                  <Badge variant="secondary" className="text-xs">{template.siteType}</Badge>
                )}
                <span className="text-xs text-muted-foreground">
                  {template.fieldCount ?? 0} fields
                </span>
              </div>
            ) : null}
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* Site basic info                                                      */}
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
          </CardContent>
        </Card>

        {/* ------------------------------------------------------------------ */}
        {/* Template fields                                                      */}
        {/* ------------------------------------------------------------------ */}
        {templateIdParam && (
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
        {/* Create button                                                        */}
        {/* ------------------------------------------------------------------ */}
        <Button
          className="w-full"
          size="lg"
          onClick={handleCreate}
          disabled={saving}
        >
          {saving ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating…</>
          ) : (
            'Create Site'
          )}
        </Button>

      </div>
    </ResponsiveLayout>
  );
}
