import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Download,
  FileSpreadsheet,
  Loader2,
  Lock,
  Save,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';

import { ResponsiveLayout } from '@/components/ResponsiveLayout';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

import { SitesService } from '@/services/sites';
import { SiteTemplatesService } from '@/services/siteTemplates';
import { SiteSubmissionsService } from '@/services/siteSubmissions';
import { auth } from '@/lib/firebase';
import { useUser } from '@/hooks/use-user';
import { calculateReliability } from '@/lib/reliabilityScore';

import type { Site } from '@/services/sites';
import type { TemplateField, TemplateSection } from '@/types/siteTemplates';
import type { SiteSubmission, MediaAttachment } from '@/types/siteSubmissions';

// ---------------------------------------------------------------------------
// Field value renderer
// ---------------------------------------------------------------------------

function renderValue(field: TemplateField, value: unknown) {
  if (
    value === null ||
    value === undefined ||
    value === '' ||
    (Array.isArray(value) && value.length === 0)
  ) {
    return <span className="text-muted-foreground italic text-sm">—</span>;
  }

  switch (field.fieldType) {
    case 'coordinates_latlong': {
      const v = value as { lat?: string; lng?: string };
      if (!v.lat && !v.lng)
        return <span className="text-muted-foreground italic text-sm">—</span>;
      return (
        <span className="font-mono text-sm">
          {v.lat ?? '?'}°N, {v.lng ?? '?'}°E
        </span>
      );
    }

    case 'coordinates_utm': {
      const v = value as { zone?: string; easting?: string; northing?: string; datum?: string };
      if (!v.zone)
        return <span className="text-muted-foreground italic text-sm">—</span>;
      return (
        <span className="font-mono text-sm">
          Zone {v.zone}, E {v.easting}, N {v.northing} ({v.datum})
        </span>
      );
    }

    case 'file_upload': {
      const files = value as MediaAttachment[];
      return (
        <div className="flex flex-wrap gap-2">
          {files.map(f => {
            const isImage = /\.(jpg|jpeg|png|gif|webp|heic)$/i.test(f.fileName);
            return isImage ? (
              <a
                key={f.id}
                href={f.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <img
                  src={f.downloadUrl}
                  alt={f.fileName}
                  className="h-20 w-20 object-cover rounded-md border border-border"
                />
              </a>
            ) : (
              <a
                key={f.id}
                href={f.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-primary underline"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                {f.fileName}
              </a>
            );
          })}
        </div>
      );
    }

    case 'repeating_group': {
      const rows = value as Record<string, unknown>[];
      if (!rows || rows.length === 0)
        return <span className="text-muted-foreground italic text-sm">No entries</span>;
      const cols = field.groupFields ?? [];
      return (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="text-sm w-full border-collapse">
            <thead>
              <tr className="bg-muted/50">
                {cols.map(c => (
                  <th
                    key={c.id}
                    className="text-left py-2 px-3 text-muted-foreground font-medium border-b border-border"
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b border-border/50 last:border-0">
                  {cols.map(c => (
                    <td key={c.id} className="py-2 px-3">
                      {row[c.id] !== undefined && row[c.id] !== '' ? String(row[c.id]) : '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    case 'multiselect':
    case 'checkbox': {
      const vals = Array.isArray(value) ? value : [String(value)];
      return <span className="text-sm">{vals.join(', ')}</span>;
    }

    case 'date': {
      try {
        return (
          <span className="text-sm">
            {new Date(String(value)).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </span>
        );
      } catch {
        return <span className="text-sm">{String(value)}</span>;
      }
    }

    default:
      return <span className="text-sm">{String(value)}</span>;
  }
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    assigned:
      'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    in_progress:
      'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    submitted:
      'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    reviewed:
      'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  };
  const label: Record<string, string> = {
    assigned: 'Assigned',
    in_progress: 'In Progress',
    submitted: 'Submitted',
    reviewed: 'Reviewed',
  };
  return (
    <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${cls[status] ?? ''}`}>
      {label[status] ?? status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const SubmissionDetail = () => {
  const { siteId, submissionId } = useParams<{ siteId: string; submissionId: string }>();
  const navigate = useNavigate();
  const { isOrgAdmin, isSuperAdmin } = useUser();
  const isAdmin = isOrgAdmin || isSuperAdmin;

  const [site, setSite] = useState<Site | null>(null);
  const [fields, setFields] = useState<TemplateField[]>([]);
  const [sections, setSections] = useState<TemplateSection[]>([]);
  const [submission, setSubmission] = useState<SiteSubmission | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Protected field editing (admin only)
  const [editingProtected, setEditingProtected] = useState(false);
  const [protectedValues, setProtectedValues] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);

  // Export state
  const [exporting, setExporting] = useState<'pdf' | 'csv' | null>(null);

  // ---- load ----
  useEffect(() => {
    if (!siteId || !submissionId) return;
    const load = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const siteData = await SitesService.getSiteById(siteId);
        if (!siteData) throw new Error('Site not found.');
        setSite(siteData);

        if (siteData.linkedTemplateId) {
          const [tFields, tSections] = await Promise.all([
            SiteTemplatesService.getTemplateFields(siteData.linkedTemplateId),
            SiteTemplatesService.getTemplateSections(siteData.linkedTemplateId),
          ]);
          setFields(tFields);
          setSections(tSections);
        }

        const sub = await SiteSubmissionsService.getSubmission(siteId, submissionId);
        if (!sub) throw new Error('Submission not found.');
        setSubmission(sub);
        setProtectedValues(sub.formData ?? {});
      } catch (err: any) {
        setLoadError(err.message ?? 'Failed to load submission.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [siteId, submissionId]);

  // ---- export ----
  const handleExport = async (type: 'pdf' | 'csv') => {
    if (!siteId || !submissionId) return;
    setExporting(type);
    try {
      const token = await auth?.currentUser?.getIdToken();
      const res = await fetch(
        `/api/submissions/${siteId}/${submissionId}/export-${type}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      );
      if (!res.ok) throw new Error(`Export failed: ${res.statusText}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `submission-${submissionId}.${type}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
      toast.error('Export failed. Please try again.');
    } finally {
      setExporting(null);
    }
  };

  // ---- save protected fields ----
  const handleSaveProtected = async () => {
    if (!siteId || !submissionId || !submission) return;
    setSaving(true);
    try {
      await SiteSubmissionsService.updateSubmission(siteId, submissionId, {
        formData: protectedValues,
      });
      setSubmission(prev => (prev ? { ...prev, formData: protectedValues } : prev));
      setEditingProtected(false);
      toast.success('Protected fields saved.');
    } catch (err) {
      console.error('Save error:', err);
      toast.error('Save failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ---- render: loading ----
  if (loading) {
    return (
      <ResponsiveLayout>
        <div className="max-w-3xl mx-auto p-4 space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </ResponsiveLayout>
    );
  }

  // ---- render: error ----
  if (loadError || !site || !submission) {
    return (
      <ResponsiveLayout>
        <div className="max-w-3xl mx-auto p-8 text-center space-y-4">
          <p className="text-destructive font-medium">
            {loadError ?? 'Submission not found.'}
          </p>
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </Button>
        </div>
      </ResponsiveLayout>
    );
  }

  const { score, label: reliabilityLabel } = calculateReliability(
    fields,
    submission.formData ?? {},
  );

  const orderedSections = [...sections].sort((a, b) => a.order - b.order);
  const fieldsBySection = orderedSections.reduce<Record<string, TemplateField[]>>(
    (acc, s) => {
      acc[s.id] = fields
        .filter(
          f =>
            f.sectionId === s.id &&
            f.fieldType !== 'section_header' &&
            f.fieldType !== 'divider',
        )
        .sort((a, b) => a.order - b.order);
      return acc;
    },
    {},
  );

  const reliabilityColor =
    reliabilityLabel === 'Complete'
      ? 'text-green-600 dark:text-green-400'
      : reliabilityLabel === 'Incomplete'
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-destructive';

  return (
    <ResponsiveLayout>
      {/* Sticky header */}
      <header className="bg-card/95 backdrop-blur-lg px-4 py-4 border-b border-border sticky top-0 z-40">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 h-8 w-8"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="min-w-0">
              <p className="font-semibold text-sm leading-tight truncate">{site.name}</p>
              <p className="text-xs text-muted-foreground">Submission Review</p>
            </div>
          </div>
          <StatusBadge status={submission.status} />
        </div>
      </header>

      <div className="max-w-3xl mx-auto p-4 pb-24 sm:p-6 space-y-4">
        {/* Meta card */}
        <Card>
          <CardContent className="pt-4 pb-4 space-y-3">
            {/* Reliability */}
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Data Reliability</span>
                <span className={`font-medium ${reliabilityColor}`}>
                  {reliabilityLabel} ({score}%)
                </span>
              </div>
              <Progress value={score} className="h-2" />
            </div>

            {/* Timestamps */}
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
              {submission.submittedAt && (
                <span>
                  Submitted:{' '}
                  {submission.submittedAt.toDate().toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              )}
              {submission.lastSavedAt && (
                <span>
                  Last saved:{' '}
                  {submission.lastSavedAt.toDate().toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              )}
            </div>

            {/* Export buttons */}
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleExport('pdf')}
                disabled={exporting !== null}
              >
                {exporting === 'pdf' ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                )}
                Export PDF
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleExport('csv')}
                disabled={exporting !== null}
              >
                {exporting === 'csv' ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" />
                )}
                Export CSV
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Sections */}
        {orderedSections.map(section => {
          // Non-admin users skip protected sections
          if (section.isProtected && !isAdmin) return null;

          const sectionFields = fieldsBySection[section.id] ?? [];
          const hasEditableFields = sectionFields.some(f =>
            ['text', 'textarea', 'number', 'date'].includes(f.fieldType),
          );

          return (
            <Card key={section.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  {section.title}
                  {section.isProtected && (
                    <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-0">
                {sectionFields.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No fields in this section.</p>
                ) : (
                  sectionFields.map((f, idx) => {
                    const value = editingProtected && section.isProtected
                      ? protectedValues[f.id]
                      : submission.formData?.[f.id];
                    const isEditable =
                      editingProtected &&
                      section.isProtected &&
                      isAdmin &&
                      ['text', 'textarea', 'number', 'date'].includes(f.fieldType);

                    return (
                      <div key={f.id}>
                        <div className="py-3">
                          <p className="text-xs font-medium text-muted-foreground mb-1.5">
                            {f.label}
                            {f.isRequired && (
                              <span className="text-destructive ml-1">*</span>
                            )}
                          </p>
                          {isEditable ? (
                            f.fieldType === 'textarea' ? (
                              <Textarea
                                value={(protectedValues[f.id] as string) ?? ''}
                                onChange={e =>
                                  setProtectedValues(prev => ({
                                    ...prev,
                                    [f.id]: e.target.value,
                                  }))
                                }
                                rows={3}
                                className="text-sm"
                              />
                            ) : (
                              <Input
                                type={
                                  f.fieldType === 'number'
                                    ? 'number'
                                    : f.fieldType === 'date'
                                    ? 'date'
                                    : 'text'
                                }
                                value={(protectedValues[f.id] as string) ?? ''}
                                onChange={e =>
                                  setProtectedValues(prev => ({
                                    ...prev,
                                    [f.id]: e.target.value,
                                  }))
                                }
                                className="text-sm"
                              />
                            )
                          ) : (
                            renderValue(f, value)
                          )}
                        </div>
                        {idx < sectionFields.length - 1 && (
                          <Separator />
                        )}
                      </div>
                    );
                  })
                )}

                {/* Edit controls for protected sections (admin only) */}
                {section.isProtected && isAdmin && hasEditableFields && (
                  <div className="flex gap-2 pt-4 border-t border-border mt-2">
                    {editingProtected ? (
                      <>
                        <Button
                          size="sm"
                          onClick={handleSaveProtected}
                          disabled={saving}
                        >
                          {saving ? (
                            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                          ) : (
                            <Save className="w-3.5 h-3.5 mr-1.5" />
                          )}
                          Save Changes
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingProtected(false);
                            setProtectedValues(submission.formData ?? {});
                          }}
                          disabled={saving}
                        >
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingProtected(true)}
                      >
                        Edit Protected Fields
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </ResponsiveLayout>
  );
};

export default SubmissionDetail;
