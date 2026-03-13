import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, MapPin, FileText, Save, Loader2, AlertCircle,
  Upload, Image as ImageIcon, Mic, MicOff, LayoutTemplate,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ResponsiveLayout } from "@/components/ResponsiveLayout";
import { PageHeader } from "@/components/PageHeader";
import { AccountButton } from "@/components/AccountButton";

import DynamicFormRenderer from "@/components/DynamicFormRenderer";
import { SitesService, Site } from "@/services/sites";
import { SiteTemplatesService } from "@/services/siteTemplates";
import { SiteSubmissionsService } from "@/services/siteSubmissions";
import { useAuth } from "@/hooks/use-auth";
import { useUser } from "@/hooks/use-user";
import { useArchaeologist } from "@/hooks/use-archaeologist";
import { SiteConditions } from "@/components/SiteConditions";
import { Timestamp } from "firebase/firestore";
import type { SiteTemplate, TemplateSection, TemplateField } from "@/types/siteTemplates";
import type { SiteSubmission } from "@/types/siteSubmissions";

const EditSite = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { organization, isOrgAdmin, isSuperAdmin } = useUser();
  const { isArchaeologist, loading: archaeologistLoading } = useArchaeologist();
  const isAdmin = isOrgAdmin || isSuperAdmin;

  const [siteLoading, setSiteLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [site, setSite] = useState<Site | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Basic site form fields
  const [basicForm, setBasicForm] = useState({
    name: "",
    description: "",
    researchAnalysis: "",
    location: { address: "", country: "", region: "", latitude: "", longitude: "" },
    period: "",
    status: "active" as "active" | "inactive" | "archived" | "draft",
    dateDiscovered: "",
    notes: "",
  });

  // Template form state
  const [template, setTemplate] = useState<SiteTemplate | null>(null);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [sections, setSections] = useState<TemplateSection[]>([]);
  const [fields, setFields] = useState<TemplateField[]>([]);
  const [fieldsLoading, setFieldsLoading] = useState(false);
  const [existingSubmission, setExistingSubmission] = useState<SiteSubmission | null>(null);
  const [templateFormData, setTemplateFormData] = useState<Record<string, unknown>>({});

  // ---- Load site ---------------------------------------------------------
  useEffect(() => {
    if (!id) { setError("Site ID not found"); setSiteLoading(false); return; }

    SitesService.getSiteById(id)
      .then((siteData) => {
        if (!siteData) { setError("Site not found"); return; }
        setSite(siteData);

        const dateDiscovered = siteData.dateDiscovered instanceof Timestamp
          ? siteData.dateDiscovered.toDate().toISOString().split('T')[0]
          : siteData.dateDiscovered instanceof Date
          ? siteData.dateDiscovered.toISOString().split('T')[0]
          : "";

        setBasicForm({
          name: siteData.name || "",
          description: siteData.description || "",
          researchAnalysis: siteData.researchAnalysis || "",
          location: {
            address: siteData.location?.address || "",
            country: siteData.location?.country || "",
            region: siteData.location?.region || "",
            latitude: siteData.location?.latitude?.toString() || "",
            longitude: siteData.location?.longitude?.toString() || "",
          },
          period: siteData.period || "",
          status: siteData.status || "active",
          dateDiscovered,
          notes: (siteData as any).notes || "",
        });
      })
      .catch(() => setError("Failed to load site details"))
      .finally(() => setSiteLoading(false));
  }, [id]);

  // ---- Load linked template + existing submission -------------------------
  useEffect(() => {
    const templateId = site?.linkedTemplateId;
    if (!templateId || !id) return;

    setTemplateLoading(true);
    setFieldsLoading(true);

    Promise.all([
      SiteTemplatesService.getTemplate(templateId),
      SiteTemplatesService.getTemplateSections(templateId),
      SiteTemplatesService.getTemplateFields(templateId),
      SiteSubmissionsService.getSubmissionBySite(id),
    ])
      .then(([t, s, f, submission]) => {
        setTemplate(t);
        setSections(s);
        setFields(f);
        if (submission) {
          setExistingSubmission(submission);
          setTemplateFormData(submission.formData ?? {});
        }
      })
      .catch(() => toast.error('Failed to load template fields.'))
      .finally(() => {
        setTemplateLoading(false);
        setFieldsLoading(false);
      });
  }, [site?.linkedTemplateId, id]);

  // ---- Permission check --------------------------------------------------
  const isCreator = user && site && site.createdBy === user.uid;
  const isActiveProject = site && site.status === "active";
  const canEdit = isAdmin || (user && isArchaeologist && site && (isCreator || isActiveProject));

  useEffect(() => {
    if (!siteLoading && !archaeologistLoading && site && !canEdit) {
      toast.error("You don't have permission to edit this site.");
      navigate(`/site/${id}`);
    }
  }, [canEdit, siteLoading, archaeologistLoading, site, navigate, id]);

  // ---- Image handling ----------------------------------------------------
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

  // ---- Speech recognition ------------------------------------------------
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const r = new SpeechRecognition();
    r.continuous = true;
    r.interimResults = true;
    r.lang = 'en-US';
    r.onresult = (event: any) => {
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) final += event.results[i][0].transcript + ' ';
      }
      if (final) setBasicForm(prev => ({ ...prev, notes: prev.notes + final }));
    };
    r.onerror = () => { setIsRecording(false); toast.error('Speech recognition error.'); };
    r.onend = () => setIsRecording(false);
    setRecognition(r);
  }, []);

  const toggleRecording = () => {
    if (!recognition) { toast.error("Speech recognition not supported in this browser."); return; }
    if (isRecording) { recognition.stop(); setIsRecording(false); }
    else { recognition.start(); setIsRecording(true); }
  };

  // ---- Input handlers ----------------------------------------------------
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name.startsWith("location.")) {
      const field = name.split(".")[1];
      setBasicForm(prev => ({ ...prev, location: { ...prev.location, [field]: value } }));
    } else {
      setBasicForm(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleTemplateFormChange = useCallback((values: Record<string, unknown>) => {
    setTemplateFormData(values);
  }, []);

  // ---- Save --------------------------------------------------------------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!site?.id) return;
    if (!basicForm.name.trim()) { toast.error('Site name is required.'); return; }

    setSaving(true);
    try {
      const updateData: Partial<Site> = {
        name: basicForm.name.trim(),
        description: basicForm.description,
        researchAnalysis: basicForm.researchAnalysis || undefined,
        location: {
          address: basicForm.location.address || "",
          country: basicForm.location.country || "",
          region: basicForm.location.region || "",
          latitude: basicForm.location.latitude ? parseFloat(basicForm.location.latitude) : 0,
          longitude: basicForm.location.longitude ? parseFloat(basicForm.location.longitude) : 0,
        },
        period: basicForm.period || "",
        status: basicForm.status,
        ...(basicForm.dateDiscovered
          ? { dateDiscovered: Timestamp.fromDate(new Date(basicForm.dateDiscovered)) }
          : {}),
        notes: basicForm.notes || "",
      } as any;

      await SitesService.updateSite(site.id, updateData);

      // Upload new image if selected
      if (selectedImage) {
        try {
          const url = await SitesService.uploadSiteImage(site.id, selectedImage);
          const existing = site.images || [];
          await SitesService.updateSiteImages(site.id, [url, ...existing]);
        } catch {
          toast.warning('Site updated, but image upload failed.');
        }
      }

      // Save / update template submission if template is linked and form data exists
      if (site.linkedTemplateId && user) {
        const hasData = Object.values(templateFormData).some(v =>
          v !== undefined && v !== null && v !== '' &&
          !(Array.isArray(v) && v.length === 0)
        );
        if (hasData) {
          try {
            if (existingSubmission?.id) {
              await SiteSubmissionsService.updateSubmission(site.id, existingSubmission.id, {
                formData: templateFormData,
                status: existingSubmission.status === 'pending' ? 'in_progress' : existingSubmission.status,
                isDraft: existingSubmission.isDraft,
              });
              if (existingSubmission.status === 'pending') {
                await SitesService.updateSite(site.id, { submissionStatus: 'in_progress' });
              }
            } else {
              await SiteSubmissionsService.createSubmission(site.id, {
                siteId: site.id,
                templateId: site.linkedTemplateId,
                consultantId: user.uid,
                organizationId: organization?.id ?? '',
                formData: templateFormData,
                mediaAttachments: [],
                status: 'in_progress',
                lastSavedAt: null as any,
                isDraft: true,
              });
              await SitesService.updateSite(site.id, { submissionStatus: 'in_progress' });
            }
          } catch {
            toast.warning('Site updated, but form data could not be saved.');
          }
        }
      }

      toast.success('Site updated successfully!');
      navigate(`/site/${site.id}`);
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to update site. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ---- Loading / error states --------------------------------------------
  if (siteLoading || archaeologistLoading) {
    return (
      <ResponsiveLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Loading site…</p>
          </div>
        </div>
      </ResponsiveLayout>
    );
  }

  if (error || !site) {
    return (
      <ResponsiveLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-destructive" />
            <p className="text-destructive mb-4">{error || "Site not found"}</p>
            <Button onClick={() => navigate("/site-lists")} variant="outline">Back to Sites</Button>
          </div>
        </div>
      </ResponsiveLayout>
    );
  }

  // ---- Render ------------------------------------------------------------
  return (
    <ResponsiveLayout>
      {/* Header */}
      <header className="bg-card/95 backdrop-blur-lg px-4 py-4 border-b border-border sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(`/site/${id}`)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <PageHeader showLogo={false} />
          </div>
          <AccountButton />
        </div>
      </header>

      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <h1 className="text-2xl font-bold">Edit Site</h1>

        {/* Linked template badge */}
        {site.linkedTemplateId && (
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

        {/* Site Conditions */}
        {site.location?.latitude && site.location?.longitude && (
          <SiteConditions latitude={site.location.latitude} longitude={site.location.longitude} />
        )}

        {/* Image */}
        <Card>
          <CardContent className="pt-6 space-y-3">
            {imagePreview || (site.images && site.images.length > 0) ? (
              <div className="relative">
                <img
                  src={imagePreview || site.images?.[0]}
                  alt="Site preview"
                  className="w-full max-h-48 object-cover rounded-lg"
                />
                {imagePreview && (
                  <Button
                    type="button" variant="destructive" size="icon"
                    className="absolute top-2 right-2 h-7 w-7"
                    onClick={removeImage}
                  >
                    ✕
                  </Button>
                )}
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
            <Button
              type="button" variant="outline" size="sm" className="w-full"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4 mr-2" />
              {selectedImage || (site.images?.length ?? 0) > 0 ? 'Change Image' : 'Upload Image'}
            </Button>
          </CardContent>
        </Card>

        {/* Basic Information */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Basic Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Site Name <span className="text-destructive">*</span></Label>
              <Input id="name" name="name" value={basicForm.name} onChange={handleInputChange}
                placeholder="e.g. Crowders Mountain Rockshelter" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" value={basicForm.description}
                onChange={handleInputChange} rows={3}
                placeholder="Brief overview of the site…" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="researchAnalysis">Research and Analysis</Label>
              <Textarea id="researchAnalysis" name="researchAnalysis" value={basicForm.researchAnalysis}
                onChange={handleInputChange} rows={3}
                placeholder="Research findings, analysis, interpretations…" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="period">Historical Period</Label>
              <Input id="period" name="period" value={basicForm.period} onChange={handleInputChange}
                placeholder="e.g. Woodland Period, Mississippian" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dateDiscovered">Date Discovered</Label>
              <Input id="dateDiscovered" name="dateDiscovered" type="date"
                value={basicForm.dateDiscovered} onChange={handleInputChange} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="status">Status</Label>
              <Select value={basicForm.status}
                onValueChange={v => setBasicForm(prev => ({ ...prev, status: v as any }))}>
                <SelectTrigger id="status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Field Notes */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Field Notes
              </span>
              <Button type="button" variant={isRecording ? "destructive" : "outline"}
                size="sm" onClick={toggleRecording} className="gap-2">
                {isRecording ? <><MicOff className="w-4 h-4" />Stop</> : <><Mic className="w-4 h-4" />Record</>}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea id="notes" name="notes" value={basicForm.notes} onChange={handleInputChange}
              rows={5} placeholder="Field notes, site observations, updates…" />
            {isRecording && (
              <div className="flex items-center gap-2 text-sm text-destructive mt-2">
                <div className="w-2 h-2 bg-destructive rounded-full animate-pulse" />
                <span>Recording… speak now</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Location */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Location Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="location.address">Address</Label>
              <Input id="location.address" name="location.address"
                value={basicForm.location.address} onChange={handleInputChange}
                placeholder="Street address or location description" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="location.region">Region / State</Label>
                <Input id="location.region" name="location.region"
                  value={basicForm.location.region} onChange={handleInputChange}
                  placeholder="e.g. Mecklenburg" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="location.country">Country</Label>
                <Input id="location.country" name="location.country"
                  value={basicForm.location.country} onChange={handleInputChange}
                  placeholder="e.g. USA" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="location.latitude">Latitude</Label>
                <Input id="location.latitude" name="location.latitude" type="number"
                  step="0.000001" value={basicForm.location.latitude} onChange={handleInputChange}
                  placeholder="35.267" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="location.longitude">Longitude</Label>
                <Input id="location.longitude" name="location.longitude" type="number"
                  step="0.000001" value={basicForm.location.longitude} onChange={handleInputChange}
                  placeholder="-81.046" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Template form fields */}
        {site.linkedTemplateId && (
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
              userRole={isAdmin ? "org_admin" : "member"}
              mode="fill"
              initialValues={templateFormData}
              onChange={handleTemplateFormChange}
            />
          ) : null
        )}

        {/* Actions */}
        <div className="space-y-2 pt-2">
          <Button type="submit" className="w-full" size="lg" disabled={saving}>
            {saving ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</>
            ) : (
              <><Save className="w-4 h-4 mr-2" />Update Site</>
            )}
          </Button>
          <Button type="button" variant="outline" className="w-full"
            onClick={() => navigate(`/site/${id}`)} disabled={saving}>
            Cancel
          </Button>
        </div>
      </form>
    </ResponsiveLayout>
  );
};

export default EditSite;
