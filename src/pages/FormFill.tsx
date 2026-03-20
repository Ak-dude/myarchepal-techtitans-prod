import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Loader2, WifiOff, Save, ScanLine } from 'lucide-react';
import { toast } from 'sonner';

import { ResponsiveLayout } from '@/components/ResponsiveLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import DynamicFormRenderer from '@/components/DynamicFormRenderer';
import SitePhotosPanel from '@/components/SitePhotosPanel';

import { SitesService } from '@/services/sites';
import { SiteTemplatesService } from '@/services/siteTemplates';
import { SiteSubmissionsService } from '@/services/siteSubmissions';
import { useAuth } from '@/hooks/use-auth';
import { useUser } from '@/hooks/use-user';
import { useNetworkStatus } from '@/hooks/use-network';
import { FormFillContext } from '@/contexts/FormFillContext';
import { calculateReliability } from '@/lib/reliabilityScore';

import type { Site } from '@/services/sites';
import type { TemplateField, TemplateSection } from '@/types/siteTemplates';
import type { MediaAttachment, SiteSubmission } from '@/types/siteSubmissions';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(d: Date) {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

type SyncStatus = 'idle' | 'saving' | 'saved';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const FormFill = () => {
  const { siteId } = useParams<{ siteId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { organization } = useUser();
  const { isOnline } = useNetworkStatus();

  // ---- data state ----
  const [site, setSite] = useState<Site | null>(null);
  const [fields, setFields] = useState<TemplateField[]>([]);
  const [sections, setSections] = useState<TemplateSection[]>([]);
  const [submission, setSubmission] = useState<SiteSubmission | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ---- shared media attachments state (all upload components read/write here) ----
  const [allMediaAttachments, setAllMediaAttachments] = useState<MediaAttachment[]>([]);

  // ---- auto-save state ----
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submissionIdRef = useRef<string | null>(null);

  // ---- scan-to-fill state ----
  const [scanLoading, setScanLoading] = useState(false);
  const [scannedValues, setScannedValues] = useState<Record<string, unknown> | null>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);

  // ---- form values for progress ----
  const [currentValues, setCurrentValues] = useState<Record<string, unknown>>({});
  const { score: progress, label: reliabilityLabel } = calculateReliability(fields, currentValues);

  // ---- load everything ----
  useEffect(() => {
    if (!siteId || !user?.uid || !organization?.id) return;

    const load = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const siteData = await SitesService.getSiteById(siteId);
        if (!siteData) throw new Error('Site not found.');
        if (!siteData.linkedTemplateId) throw new Error('This site has no linked form template.');
        setSite(siteData);

        const [templateFields, templateSections] = await Promise.all([
          SiteTemplatesService.getTemplateFields(siteData.linkedTemplateId),
          SiteTemplatesService.getTemplateSections(siteData.linkedTemplateId),
        ]);
        setFields(templateFields);
        setSections(templateSections);

        let existing = await SiteSubmissionsService.getSubmissionBySite(siteId, user.uid);

        if (!existing) {
          const newId = await SiteSubmissionsService.createSubmission(siteId, {
            siteId,
            templateId: siteData.linkedTemplateId,
            consultantId: user.uid,
            organizationId: organization.id,
            formData: {},
            mediaAttachments: [],
            status: 'in_progress',
            isDraft: true,
            lastSavedAt: null as any,
          });
          await SitesService.updateSite(siteId, { submissionStatus: 'in_progress' });
          existing = await SiteSubmissionsService.getSubmission(siteId, newId);
        }

        setSubmission(existing);
        submissionIdRef.current = existing.id;
        setCurrentValues(existing.formData ?? {});
        setAllMediaAttachments(existing.mediaAttachments ?? []);
      } catch (err: any) {
        console.error('FormFill load error:', err);
        setLoadError(err.message ?? 'Failed to load form.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [siteId, user?.uid, organization?.id]);

  // ---- shared media change handler (used by all upload components) ----
  const handleMediaChange = useCallback(async (updated: MediaAttachment[]) => {
    setAllMediaAttachments(updated);
    if (!siteId || !submissionIdRef.current) return;
    try {
      await SiteSubmissionsService.updateSubmission(siteId, submissionIdRef.current, {
        mediaAttachments: updated,
      });
    } catch (err) {
      console.error('Failed to save mediaAttachments:', err);
    }
  }, [siteId]);

  // ---- auto-save (form field values) ----
  const handleChange = useCallback((values: Record<string, unknown>) => {
    setCurrentValues(values);
    if (!siteId || !submissionIdRef.current) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSyncStatus('saving');
    debounceRef.current = setTimeout(async () => {
      try {
        await SiteSubmissionsService.updateSubmission(siteId, submissionIdRef.current!, {
          formData: values,
          isDraft: true,
        });
        setSavedAt(new Date());
        setSyncStatus('saved');
      } catch (err) {
        console.error('Auto-save failed:', err);
        setSyncStatus('idle');
      }
    }, 2000);
  }, [siteId]);

  // ---- manual save ----
  const handleSave = useCallback(async (values: Record<string, unknown>) => {
    if (!siteId || !submissionIdRef.current) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSyncStatus('saving');
    try {
      await SiteSubmissionsService.updateSubmission(siteId, submissionIdRef.current, {
        formData: values,
        isDraft: true,
      });
      setSavedAt(new Date());
      setSyncStatus('saved');
      toast.success('Draft saved');
    } catch (err) {
      console.error('Save failed:', err);
      setSyncStatus('idle');
      toast.error('Save failed. Please try again.');
    }
  }, [siteId]);

  // ---- submit ----
  const handleSubmit = useCallback(async (values: Record<string, unknown>) => {
    if (!siteId || !submissionIdRef.current) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    try {
      await SiteSubmissionsService.updateSubmission(siteId, submissionIdRef.current, {
        formData: values,
      });
      await SiteSubmissionsService.submitForm(siteId, submissionIdRef.current);
      await SitesService.updateSite(siteId, { submissionStatus: 'submitted' });
      toast.success('Form submitted successfully!');
      navigate('/my-assignments');
    } catch (err) {
      console.error('Submit failed:', err);
      toast.error('Submission failed. Please try again.');
    }
  }, [siteId, navigate]);

  // ---- scan paper form ----
  const handleScanImage = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !fields.length) return;

    setScanLoading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          resolve(dataUrl.split(',')[1]); // strip "data:image/...;base64,"
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const mediaType = file.type || 'image/jpeg';

      const fieldDefs = fields
        .filter(f => !['section_header', 'divider', 'file_upload', 'repeating_group'].includes(f.fieldType))
        .map(f => ({ id: f.id, label: f.label, fieldType: f.fieldType, options: f.options ?? null }));

      const res = await fetch('/api/parse-form-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64_image: base64, media_type: mediaType, fields: fieldDefs }),
      });

      if (!res.ok) throw new Error(await res.text());

      const data = await res.json();
      const merged = { ...currentValues, ...data.formData };
      setScannedValues(merged);
      // Auto-save the merged data
      if (siteId && submissionIdRef.current) {
        await SiteSubmissionsService.updateSubmission(siteId, submissionIdRef.current, {
          formData: merged,
          isDraft: true,
        });
        setSavedAt(new Date());
        setSyncStatus('saved');
      }
      toast.success(`Scanned ${data.fields_found} field${data.fields_found !== 1 ? 's' : ''} from image`);
    } catch (err: any) {
      console.error('Scan failed:', err);
      toast.error('Could not read the form image. Try a clearer photo.');
    } finally {
      setScanLoading(false);
    }
  }, [fields, currentValues, siteId]);

  // ---- sync status label ----
  const syncLabel = syncStatus === 'saving'
    ? 'Saving...'
    : syncStatus === 'saved' && savedAt
    ? `Saved ${formatTime(savedAt)}`
    : '';

  // ---- render: loading ----
  if (loading) {
    return (
      <ResponsiveLayout>
        <header className="bg-card/95 backdrop-blur-lg px-4 py-4 border-b border-border sticky top-0 z-40">
          <div className="max-w-3xl mx-auto flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-5 w-48" />
          </div>
        </header>
        <div className="max-w-3xl mx-auto p-4 space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      </ResponsiveLayout>
    );
  }

  // ---- render: error ----
  if (loadError || !site || !submission) {
    return (
      <ResponsiveLayout>
        <div className="max-w-3xl mx-auto p-8 text-center space-y-4">
          <p className="text-destructive font-medium">{loadError ?? 'Form could not be loaded.'}</p>
          <Button variant="outline" onClick={() => navigate('/my-assignments')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Assignments
          </Button>
        </div>
      </ResponsiveLayout>
    );
  }

  const isSubmitted = submission.status === 'submitted' || submission.status === 'reviewed';

  const progressColor =
    reliabilityLabel === 'Complete'
      ? 'text-green-600 dark:text-green-400'
      : reliabilityLabel === 'Incomplete'
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-destructive';

  return (
    <ResponsiveLayout>
      {/* Sticky header */}
      <header className="bg-card/95 backdrop-blur-lg px-4 py-3 border-b border-border sticky top-0 z-40">
        <div className="max-w-3xl mx-auto space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 h-8 w-8"
                onClick={() => navigate('/my-assignments')}
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div className="min-w-0">
                <p className="font-semibold text-sm leading-tight truncate">{site.name}</p>
                {site.stateSiteNumber && (
                  <p className="text-xs text-muted-foreground font-mono">{site.stateSiteNumber}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {!isOnline && (
                <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                  <WifiOff className="w-3 h-3" />
                  <span>Offline</span>
                </div>
              )}
              {syncLabel && (
                <span className="text-xs text-muted-foreground">
                  {syncStatus === 'saving' && <Loader2 className="w-3 h-3 inline animate-spin mr-1" />}
                  {syncStatus === 'saved' && <CheckCircle2 className="w-3 h-3 inline text-green-500 mr-1" />}
                  {syncLabel}
                </span>
              )}
              {isSubmitted && (
                <span className="text-xs font-medium text-green-600 dark:text-green-400">
                  Submitted
                </span>
              )}
            </div>
          </div>

          {/* Progress bar */}
          {!isSubmitted && (
            <div className="space-y-0.5">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Required fields</span>
                <span className={`font-medium ${progressColor}`}>
                  {reliabilityLabel} ({progress}%)
                </span>
              </div>
              <Progress value={progress} className="h-1.5" />
            </div>
          )}
        </div>
      </header>

      {/* Form */}
      <div className="max-w-3xl mx-auto p-4 pb-32 sm:p-6">
        {isSubmitted ? (
          <div className="text-center py-12 space-y-3">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
            <p className="font-semibold text-lg">Form Submitted</p>
            <p className="text-sm text-muted-foreground">
              This form has been submitted and can no longer be edited.
            </p>
            <Button variant="outline" onClick={() => navigate('/my-assignments')}>
              Back to Assignments
            </Button>
          </div>
        ) : (
          <FormFillContext.Provider
            value={{
              siteId: siteId!,
              submissionId: submissionIdRef.current!,
              orgId: organization!.id,
              mediaAttachments: allMediaAttachments,
              onMediaChange: handleMediaChange,
            }}
          >
            <div className="space-y-4">
              {/* Photo upload panel — always at top for quick access */}
              <SitePhotosPanel />

              {/* Scan-to-fill card */}
              <Card>
                <CardContent className="py-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Scan Paper Form</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Upload a photo of a filled paper form — Claude will auto-fill the fields
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    disabled={scanLoading}
                    onClick={() => scanInputRef.current?.click()}
                  >
                    {scanLoading ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <ScanLine className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    {scanLoading ? 'Scanning...' : 'Upload Image'}
                  </Button>
                  <input
                    ref={scanInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleScanImage}
                  />
                </CardContent>
              </Card>

              {/* Template form fields — Save is in sticky bar; Submit stays here for RHF validation */}
              <DynamicFormRenderer
                sections={sections}
                fields={fields}
                initialValues={submission.formData ?? {}}
                userRole="member"
                mode="fill"
                onChange={handleChange}
                onSubmit={handleSubmit}
                resetValues={scannedValues}
              />
            </div>
          </FormFillContext.Provider>
        )}
      </div>

      {/* Sticky bottom bar — Save is always reachable; Submit lives inside the form (RHF validation) */}
      {!isSubmitted && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-lg border-t border-border">
          <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground truncate">{site.name}</span>
                <span className={`font-medium shrink-0 ml-2 ${progressColor}`}>
                  {progress}% complete
                </span>
              </div>
              <Progress value={progress} className="h-1" />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => handleSave(currentValues)}
            >
              <Save className="h-3.5 w-3.5 mr-1.5" />
              Save Draft
            </Button>
          </div>
        </div>
      )}
    </ResponsiveLayout>
  );
};

export default FormFill;
