import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Loader2, WifiOff } from 'lucide-react';
import { toast } from 'sonner';

import { ResponsiveLayout } from '@/components/ResponsiveLayout';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import DynamicFormRenderer from '@/components/DynamicFormRenderer';

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
import type { SiteSubmission } from '@/types/siteSubmissions';

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

  // ---- auto-save state ----
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submissionIdRef = useRef<string | null>(null);

  // ---- progress ----
  const [currentValues, setCurrentValues] = useState<Record<string, unknown>>({});
  const { score: progress, label: reliabilityLabel } = calculateReliability(fields, currentValues);

  // ---- load everything ----
  useEffect(() => {
    if (!siteId || !user?.uid || !organization?.id) return;

    const load = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        // 1. Site
        const siteData = await SitesService.getSiteById(siteId);
        if (!siteData) throw new Error('Site not found.');
        if (!siteData.linkedTemplateId) throw new Error('This site has no linked form template.');
        setSite(siteData);

        // 2. Template fields + sections (parallel)
        const [templateFields, templateSections] = await Promise.all([
          SiteTemplatesService.getTemplateFields(siteData.linkedTemplateId),
          SiteTemplatesService.getTemplateSections(siteData.linkedTemplateId),
        ]);
        setFields(templateFields);
        setSections(templateSections);

        // 3. Existing submission or create new one
        let existing = await SiteSubmissionsService.getSubmissionBySite(siteId);

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
            lastSavedAt: null as any, // set by service
          });
          // Update site status to in_progress
          await SitesService.updateSite(siteId, { submissionStatus: 'in_progress' });
          existing = await SiteSubmissionsService.getSubmission(siteId, newId);
        }

        setSubmission(existing);
        submissionIdRef.current = existing.id;
        setCurrentValues(existing.formData ?? {});
      } catch (err: any) {
        console.error('FormFill load error:', err);
        setLoadError(err.message ?? 'Failed to load form.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [siteId, user?.uid, organization?.id]);

  // ---- auto-save ----
  const handleChange = useCallback((values: Record<string, unknown>) => {
    setCurrentValues(values);

    if (!siteId || !submissionIdRef.current) return;

    // Clear existing debounce
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
        // Fail silently — Firestore offline persistence will retry
      }
    }, 2000);
  }, [siteId]);

  // ---- manual save (Save Draft button) ----
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
      // Final save + mark submitted
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
              {/* Offline indicator */}
              {!isOnline && (
                <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                  <WifiOff className="w-3 h-3" />
                  <span>Offline</span>
                </div>
              )}

              {/* Sync status */}
              {syncLabel && (
                <span className="text-xs text-muted-foreground">
                  {syncStatus === 'saving' && <Loader2 className="w-3 h-3 inline animate-spin mr-1" />}
                  {syncStatus === 'saved' && <CheckCircle2 className="w-3 h-3 inline text-green-500 mr-1" />}
                  {syncLabel}
                </span>
              )}

              {/* Submitted badge */}
              {isSubmitted && (
                <span className="text-xs font-medium text-green-600 dark:text-green-400">
                  Submitted
                </span>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-0.5">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Required fields</span>
              <span className={
                reliabilityLabel === 'Complete'
                  ? 'text-green-600 dark:text-green-400 font-medium'
                  : reliabilityLabel === 'Incomplete'
                  ? 'text-amber-600 dark:text-amber-400 font-medium'
                  : 'text-destructive font-medium'
              }>
                {reliabilityLabel} ({progress}%)
              </span>
            </div>
            <Progress value={progress} className="h-1.5" />
          </div>
        </div>
      </header>

      {/* Form */}
      <div className="max-w-3xl mx-auto p-4 pb-24 sm:p-6">
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
            }}
          >
            <DynamicFormRenderer
              sections={sections}
              fields={fields}
              initialValues={submission.formData ?? {}}
              userRole="member"
              mode="fill"
              onChange={handleChange}
              onSave={handleSave}
              onSubmit={handleSubmit}
            />
          </FormFillContext.Provider>
        )}
      </div>
    </ResponsiveLayout>
  );
};

export default FormFill;
