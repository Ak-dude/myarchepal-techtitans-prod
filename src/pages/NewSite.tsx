import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Upload, Image as ImageIcon, ChevronRight, ChevronLeft,
  Loader2, LayoutTemplate, CheckCircle2, FileText, X,
} from "lucide-react";
import { toast } from "sonner";

import { ResponsiveLayout } from "@/components/ResponsiveLayout";
import { PageHeader } from "@/components/PageHeader";
import { AccountButton } from "@/components/AccountButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

import { SitesService } from "@/services/sites";
import { SiteTemplatesService } from "@/services/siteTemplates";
import { useAuth } from "@/hooks/use-auth";
import { useUser } from "@/hooks/use-user";
import type { SiteTemplate } from "@/types/siteTemplates";

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

function StepIndicator({ step }: { step: 0 | 1 }) {
  const steps = ['Basic Info', 'Choose Template'];
  return (
    <div className="flex items-center gap-2">
      {steps.map((label, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${
            i === step ? 'text-primary' : i < step ? 'text-muted-foreground' : 'text-muted-foreground/50'
          }`}>
            <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
              i < step
                ? 'bg-primary border-primary text-primary-foreground'
                : i === step
                  ? 'border-primary text-primary'
                  : 'border-muted-foreground/30 text-muted-foreground/50'
            }`}>
              {i < step ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
            </div>
            {label}
          </div>
          {i < steps.length - 1 && (
            <div className={`h-px w-8 transition-colors ${i < step ? 'bg-primary' : 'bg-muted-foreground/20'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Template card
// ---------------------------------------------------------------------------

function TemplateCard({
  template,
  selected,
  onSelect,
}: {
  template: SiteTemplate;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`text-left w-full rounded-xl border-2 p-4 transition-all ${
        selected
          ? 'border-primary bg-primary/5 shadow-sm'
          : 'border-border hover:border-primary/40 hover:bg-muted/30'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{template.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {template.fieldCount ?? 0} field{(template.fieldCount ?? 0) !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {selected && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
          {template.siteType && (
            <Badge variant="secondary" className="text-xs">{template.siteType}</Badge>
          )}
        </div>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// NewSite
// ---------------------------------------------------------------------------

export default function NewSite() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { organization, isOrgAdmin, isSuperAdmin } = useUser();

  const isAdmin = isOrgAdmin || isSuperAdmin;

  // ---- Step state ----------------------------------------------------------
  const [step, setStep] = useState<0 | 1>(0);
  const [saving, setSaving] = useState(false);

  // ---- Step 1 state --------------------------------------------------------
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ---- Step 2 state --------------------------------------------------------
  const [templates, setTemplates] = useState<SiteTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  // Load published templates when reaching step 2
  useEffect(() => {
    if (step !== 1 || !organization?.id) return;
    setTemplatesLoading(true);
    SiteTemplatesService.listTemplates(organization.id)
      .then(all => setTemplates(all.filter(t => t.status === 'published')))
      .catch(() => toast.error('Failed to load templates.'))
      .finally(() => setTemplatesLoading(false));
  }, [step, organization?.id]);

  // ---- Image handling ------------------------------------------------------
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

  // ---- Navigation ----------------------------------------------------------
  const handleNext = () => {
    if (!name.trim()) { toast.error('Site name is required.'); return; }
    setStep(1);
  };

  // ---- Save ----------------------------------------------------------------
  const handleCreate = async () => {
    if (!user || !name.trim()) return;
    setSaving(true);
    try {
      const siteId = await SitesService.createSite({
        name: name.trim(),
        description: description.trim(),
        status: 'draft',
        location: { latitude: 0, longitude: 0 },
        createdBy: user.uid,
        organizationId: organization?.id,
        visibility: 'private',
        artifacts: [],
        images: [],
        ...(selectedTemplateId ? { linkedTemplateId: selectedTemplateId } : {}),
      });

      if (selectedImage) {
        try {
          const url = await SitesService.uploadSiteImage(siteId, selectedImage);
          await SitesService.updateSiteImages(siteId, [url]);
        } catch {
          toast.warning('Site created, but image upload failed.');
        }
      }

      toast.success('Site created as draft!');
      navigate(`/site/${siteId}`);
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to create site. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ---- Permission guard ----------------------------------------------------
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

        {/* Page title + step indicator */}
        <div className="space-y-3">
          <h1 className="text-2xl font-bold">New Archaeological Site</h1>
          <StepIndicator step={step} />
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* Step 1 — Basic Info                                                  */}
        {/* ------------------------------------------------------------------ */}
        {step === 0 && (
          <div className="space-y-5">

            {/* Image upload */}
            <Card>
              <CardContent className="pt-5">
                {imagePreview ? (
                  <div className="relative">
                    <img
                      src={imagePreview}
                      alt="Site preview"
                      className="w-full max-h-56 object-cover rounded-lg"
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
                    <div className="flex flex-col items-center justify-center h-44 bg-muted rounded-lg hover:bg-muted/70 transition-colors">
                      <ImageIcon className="h-10 w-10 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">Click to add site image</p>
                      <p className="text-xs text-muted-foreground mt-1">JPG, PNG, GIF — max 5 MB</p>
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
                    className="w-full mt-3"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Image
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Name + description */}
            <Card>
              <CardContent className="pt-5 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name">
                    Site Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="name"
                    placeholder="e.g. Crowders Mountain Rockshelter"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleNext(); }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="description">Description <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Textarea
                    id="description"
                    placeholder="Brief overview of the site — location, features, significance…"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    rows={4}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Next button */}
            <Button className="w-full" onClick={handleNext}>
              Next — Choose Template
              <ChevronRight className="h-4 w-4 ml-1.5" />
            </Button>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* Step 2 — Template selection                                          */}
        {/* ------------------------------------------------------------------ */}
        {step === 1 && (
          <div className="space-y-5">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                Link a published form template to this site. Consultants will fill it in when assigned.
                You can also skip and link a template later.
              </p>
            </div>

            {templatesLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
              </div>
            ) : templates.length === 0 ? (
              <Card>
                <CardContent className="py-10 flex flex-col items-center text-center gap-3">
                  <LayoutTemplate className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    No published templates yet.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate('/templates')}
                  >
                    Go to Templates
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* No template option */}
                <button
                  type="button"
                  onClick={() => setSelectedTemplateId(null)}
                  className={`text-left rounded-xl border-2 p-4 transition-all ${
                    selectedTemplateId === null
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-border hover:border-primary/40 hover:bg-muted/30'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-semibold text-sm">No Template</p>
                      <p className="text-xs text-muted-foreground">Link one later in Site Details</p>
                    </div>
                    {selectedTemplateId === null && (
                      <CheckCircle2 className="h-4 w-4 text-primary ml-auto shrink-0" />
                    )}
                  </div>
                </button>

                {templates.map(t => (
                  <TemplateCard
                    key={t.id}
                    template={t}
                    selected={selectedTemplateId === t.id}
                    onSelect={() => setSelectedTemplateId(t.id)}
                  />
                ))}
              </div>
            )}

            {/* Selected template summary */}
            {selectedTemplateId && (
              <div className="flex items-center gap-2 text-sm text-primary">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>
                  <strong>{templates.find(t => t.id === selectedTemplateId)?.name}</strong> will be linked to this site.
                </span>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-3 pt-1">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setStep(0)}
                disabled={saving}
              >
                <ChevronLeft className="h-4 w-4 mr-1.5" />
                Back
              </Button>
              <Button
                className="flex-1"
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
          </div>
        )}
      </div>
    </ResponsiveLayout>
  );
}
