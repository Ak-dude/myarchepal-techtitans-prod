import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Upload, Camera, FileText, ArrowLeft, ArrowRight, Loader2,
} from 'lucide-react';

import { ResponsiveLayout } from '@/components/ResponsiveLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';

import DynamicFormRenderer from '@/components/DynamicFormRenderer';
import { FormFillContext } from '@/contexts/FormFillContext';

import { SiteTemplatesService } from '@/services/siteTemplates';
import { SiteSubmissionsService } from '@/services/siteSubmissions';
import { SitesService } from '@/services/sites';
import { FilledFormUploadService, type ParseFilledFormResult } from '@/services/filledFormUpload';
import { useAuth } from '@/hooks/use-auth';
import { useUser } from '@/hooks/use-user';
import { calculateReliability } from '@/lib/reliabilityScore';

import type { TemplateField, TemplateSection } from '@/types/siteTemplates';
import type { MediaAttachment } from '@/types/siteSubmissions';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_MB = Number(import.meta.env.VITE_MAX_UPLOAD_MB ?? 20);

type Step = 'upload' | 'parsing' | 'processing' | 'review';

/** Must match normalization in api/services/filled_form_parser.py */
function normalizeLabel(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const UploadFilledForm = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { organization } = useUser();

  const [step, setStep] = useState<Step>('upload');

  // --- Step 1 state ---
  const [file, setFile] = useState<File | null>(null);
  const [base64Data, setBase64Data] = useState('');
  const [mediaType, setMediaType] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // --- Parse result ---
  const [parseResult, setParseResult] = useState<ParseFilledFormResult | null>(null);

  // --- Review state ---
  const [resolvedSiteId, setResolvedSiteId] = useState('');
  const [resolvedSiteName, setResolvedSiteName] = useState('');
  const [submissionId, setSubmissionId] = useState('');
  const [finalFields, setFinalFields] = useState<TemplateField[]>([]);
  const [finalSections, setFinalSections] = useState<TemplateSection[]>([]);
  const [finalFormData, setFinalFormData] = useState<Record<string, unknown>>({});
  const [currentValues, setCurrentValues] = useState<Record<string, unknown>>({});
  const [mediaAttachments, setMediaAttachments] = useState<MediaAttachment[]>([]);

  // ---- Step 1: read file to base64 ----
  const readFile = useCallback((f: File): Promise<string> =>
    new Promise((resolve, reject) => {
      if (f.size > MAX_MB * 1024 * 1024) {
        reject(new Error(`File exceeds ${MAX_MB} MB limit`));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(f);
    }), []);

  const handleFileChosen = useCallback(async (f: File) => {
    try {
      const b64 = await readFile(f);
      setFile(f);
      setBase64Data(b64);
      setMediaType(f.type || 'image/jpeg');
    } catch (err: any) {
      toast.error(err.message ?? 'Could not read file');
    }
  }, [readFile]);

  // ---- Analyze + auto-process: parse → create site/template/submission → review ----
  const handleAnalyze = useCallback(async () => {
    if (!base64Data || !organization?.id || !user?.uid) return;
    setStep('parsing');
    try {
      const result = await FilledFormUploadService.parseFilledForm(
        base64Data, mediaType, file?.name ?? 'upload', organization.id,
      );
      setParseResult(result);

      // Auto-decide: use matched template only for high confidence
      const autoUseMatch = result.confidenceLevel === 'high' && !!result.matchedTemplateId;
      const autoSiteName = result.suggestedSiteName || result.templateName || 'Uploaded Site';
      const autoSiteType = result.siteType || 'Unknown';

      setStep('processing');
      try {
        // 1. Create site automatically
        const idToken = await user.getIdToken(true);
        const siteId = await FilledFormUploadService.createSiteFromUpload(
          autoSiteName, autoSiteType, idToken,
        );

        const isNewTemplate = !autoUseMatch;
        let templateId = result.matchedTemplateId ?? '';
        let fields: TemplateField[] = [];
        let sections: TemplateSection[] = [];

        // 2. Create or load template
        if (isNewTemplate) {
          templateId = await SiteTemplatesService.createTemplate({
            orgId: organization.id,
            name: result.templateName,
            siteType: result.siteType,
            sourceType: 'filled_form_upload',
            status: 'published',
            createdBy: user.uid,
            fieldCount: result.fields.length,
          });
          await Promise.all([
            SiteTemplatesService.batchSaveFields(templateId, result.fields),
            SiteTemplatesService.batchSaveSections(templateId, result.sections),
          ]);
          fields = result.fields;
          sections = result.sections;
        } else {
          [fields, sections] = await Promise.all([
            SiteTemplatesService.getTemplateFields(templateId),
            SiteTemplatesService.getTemplateSections(templateId),
          ]);
        }

        // 3. Remap form data keys (field labels → field IDs)
        const idMap = isNewTemplate
          ? Object.fromEntries(fields.map(f => [normalizeLabel(f.label), f.id]))
          : result.fieldIdMap;
        const remappedData = FilledFormUploadService.remapFormData(result.formData, idMap);

        // 4. Link template + consultant to site
        await SitesService.updateSite(siteId, {
          linkedTemplateId: templateId,
          assignedConsultantId: user.uid,
          assignedConsultantEmail: user.email ?? '',
          submissionStatus: 'in_progress',
        });

        // 5. Create pre-populated submission
        const newSubmissionId = await SiteSubmissionsService.createSubmission(siteId, {
          siteId,
          templateId,
          consultantId: user.uid,
          organizationId: organization.id,
          formData: remappedData,
          mediaAttachments: [],
          status: 'in_progress',
          isDraft: true,
          lastSavedAt: null as any,
        });

        // 6. Notify admin if new template (fire-and-forget)
        if (isNewTemplate) {
          fetch('/api/notify-admin-template-review', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              template_id: templateId,
              template_name: result.templateName,
              uploaded_by_uid: user.uid,
              site_name: autoSiteName,
              org_id: organization.id,
            }),
          }).catch(() => {});
        }

        // 7. Advance to review
        setResolvedSiteId(siteId);
        setResolvedSiteName(autoSiteName);
        setSubmissionId(newSubmissionId);
        setFinalFields(fields);
        setFinalSections(sections);
        setFinalFormData(remappedData);
        setCurrentValues(remappedData);
        setStep('review');
      } catch (err: any) {
        toast.error(err.message ?? 'Something went wrong. Please try again.');
        setStep('upload');
      }
    } catch (err: any) {
      toast.error(err.message ?? 'Form parsing failed. Try a clearer image.');
      setStep('upload');
    }
  }, [base64Data, mediaType, file, organization, user]);

  // ---- Review: media change ----
  const handleMediaChange = useCallback(async (updated: MediaAttachment[]) => {
    setMediaAttachments(updated);
    if (!resolvedSiteId || !submissionId) return;
    try {
      await SiteSubmissionsService.updateSubmission(resolvedSiteId, submissionId, {
        mediaAttachments: updated,
      });
    } catch (err) {
      console.error('Failed to save attachments:', err);
    }
  }, [resolvedSiteId, submissionId]);

  // ---- Review: submit ----
  const handleSubmit = useCallback(async (values: Record<string, unknown>) => {
    if (!resolvedSiteId || !submissionId) return;
    try {
      await SiteSubmissionsService.updateSubmission(resolvedSiteId, submissionId, {
        formData: values,
      });
      await SiteSubmissionsService.submitForm(resolvedSiteId, submissionId);
      await SitesService.updateSite(resolvedSiteId, { submissionStatus: 'submitted' });
      toast.success('Form submitted successfully!');
      navigate(`/site/${resolvedSiteId}`);
    } catch {
      toast.error('Submission failed. Please try again.');
    }
  }, [resolvedSiteId, submissionId, navigate]);

  const { score: reliabilityScore, label: reliabilityLabel } = calculateReliability(
    finalFields, currentValues,
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <ResponsiveLayout>
      {/* Header */}
      <header className="bg-card/95 backdrop-blur-lg px-4 py-3 border-b border-border sticky top-0 z-40">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Button
            variant="ghost" size="icon" className="shrink-0 h-8 w-8"
            onClick={() => step === 'review' && resolvedSiteId ? navigate(`/site/${resolvedSiteId}`) : navigate(-1)}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <p className="font-semibold text-sm">Upload Filled Form</p>
            <p className="text-xs text-muted-foreground capitalize">
              {step === 'processing' ? 'Setting up your form...' : `Step: ${step}`}
            </p>
          </div>
          {/* Step indicator dots */}
          <div className="ml-auto flex items-center gap-1.5">
            {(['upload', 'review'] as const).map((s) => (
              <div
                key={s}
                className={`h-1.5 w-6 rounded-full transition-colors ${
                  step === 'upload' && s === 'upload' ? 'bg-primary' :
                  step !== 'upload' && s === 'review' ? 'bg-primary' :
                  step !== 'upload' && s === 'upload' ? 'bg-primary/40' : 'bg-muted'
                }`}
              />
            ))}
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto p-4 pb-32 sm:p-6 space-y-4">

        {/* ================================================================
            STEP 1 — UPLOAD
            ================================================================ */}
        {step === 'upload' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Upload a Filled Form</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Upload a PDF or photo of a paper form you've already filled out. Claude will
                extract the values and create a digital record.
              </p>
            </div>

            {/* Drop zone */}
            <Card
              className={`border-2 border-dashed cursor-pointer hover:border-primary/60 transition-colors ${
                file ? 'border-primary/40 bg-primary/5' : 'border-muted-foreground/30'
              }`}
              onClick={() => fileInputRef.current?.click()}
            >
              <CardContent className="py-10 flex flex-col items-center gap-3 text-center">
                {file ? (
                  <>
                    <FileText className="w-10 h-10 text-primary" />
                    <div>
                      <p className="font-medium text-sm">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(file.size / 1024 / 1024).toFixed(1)} MB · Click to change
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <Upload className="w-10 h-10 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">Click to upload a form</p>
                      <p className="text-xs text-muted-foreground">PDF, JPEG, PNG or WEBP · max {MAX_MB} MB</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,image/jpeg,image/png,image/webp"
              aria-label="Upload filled form file"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFileChosen(f); }}
            />

            {/* Camera button (mobile) */}
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => cameraInputRef.current?.click()}
            >
              <Camera className="w-4 h-4" />
              Take a Photo
            </Button>
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              // eslint-disable-next-line react/no-unknown-property
              capture="environment"
              aria-label="Take a photo of the form"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFileChosen(f); }}
            />

            <Button
              className="w-full gap-2"
              disabled={!file}
              onClick={handleAnalyze}
            >
              <ArrowRight className="w-4 h-4" />
              Analyze Form
            </Button>
          </div>
        )}

        {/* ================================================================
            STEP 2 — PARSING
            ================================================================ */}
        {step === 'parsing' && <ParsingStep />}

        {/* ================================================================
            STEP: PROCESSING
            ================================================================ */}
        {step === 'processing' && <ProcessingStep />}

        {/* ================================================================
            STEP 5 — REVIEW
            ================================================================ */}
        {step === 'review' && resolvedSiteId && submissionId && (
          <FormFillContext.Provider
            value={{
              siteId: resolvedSiteId,
              submissionId,
              orgId: organization!.id,
              mediaAttachments,
              onMediaChange: handleMediaChange,
            }}
          >
            <ReviewStep
              siteName={resolvedSiteName}
              templateName={parseResult?.templateName ?? ''}
              fields={finalFields}
              sections={finalSections}
              initialValues={finalFormData}
              reliabilityScore={reliabilityScore}
              reliabilityLabel={reliabilityLabel}
              onValuesChange={setCurrentValues}
              onSubmit={handleSubmit}
            />
          </FormFillContext.Provider>
        )}
      </div>
    </ResponsiveLayout>
  );
};

export default UploadFilledForm;

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ParsingStep() {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Analyzing your form...</h2>
        <p className="text-sm text-muted-foreground">
          ArchePal is reading the layout and extracting the data. This may take 30 seconds.
        </p>
      </div>
      {[
        'Reading form layout...',
        'Extracting field values...',
        'Checking against existing templates...',
      ].map((msg, i) => (
        <div key={i} className="flex items-center gap-3">
          <Loader2 className="w-4 h-4 text-muted-foreground animate-spin shrink-0" />
          <Skeleton className="h-4 flex-1 rounded" />
          <span className="text-xs text-muted-foreground hidden sm:block">{msg}</span>
        </div>
      ))}
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-20 w-full rounded-xl" />
      ))}
    </div>
  );
}

function ProcessingStep() {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Setting up your form...</h2>
        <p className="text-sm text-muted-foreground">
          Saving the template and creating your submission. Just a moment.
        </p>
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-xl" />
      ))}
    </div>
  );
}

// --------------- ReviewStep ---------------

function ReviewStep({
  siteName,
  templateName,
  fields,
  sections,
  initialValues,
  reliabilityScore,
  reliabilityLabel,
  onValuesChange,
  onSubmit,
}: {
  siteName: string;
  templateName: string;
  fields: TemplateField[];
  sections: TemplateSection[];
  initialValues: Record<string, unknown>;
  reliabilityScore: number;
  reliabilityLabel: string;
  onValuesChange: (v: Record<string, unknown>) => void;
  onSubmit: (v: Record<string, unknown>) => Promise<void>;
}) {
  const progressColor =
    reliabilityLabel === 'Complete' ? 'text-green-600 dark:text-green-400' :
    reliabilityLabel === 'Incomplete' ? 'text-amber-600 dark:text-amber-400' :
    'text-destructive';

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Review Extracted Data</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Review and correct the extracted values, then click Submit when ready.
        </p>
      </div>

      {/* Site + template info */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary">{siteName}</Badge>
        <Badge variant="outline">{templateName}</Badge>
      </div>

      {/* Reliability bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Required fields</span>
          <span className={`font-medium ${progressColor}`}>
            {reliabilityLabel} ({reliabilityScore}%)
          </span>
        </div>
        <Progress value={reliabilityScore} className="h-1.5" />
      </div>

      {/* Pre-populated form — Submit button rendered by DynamicFormRenderer */}
      <DynamicFormRenderer
        sections={sections}
        fields={fields}
        initialValues={initialValues}
        userRole="member"
        mode="fill"
        onChange={onValuesChange}
        onSubmit={onSubmit}
      />
    </div>
  );
}
