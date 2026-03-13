import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';
import {
  Plus, FileText, Edit, Trash2, Copy, Globe, EyeOff, MoreHorizontal, Lock,
} from 'lucide-react';
import { format } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { useUser } from '@/hooks/use-user';
import { SiteTemplatesService } from '@/services/siteTemplates';
import type { SiteTemplate } from '@/types/siteTemplates';
import NewTemplateModal from '@/components/templates/NewTemplateModal';
import { ResponsiveLayout } from '@/components/ResponsiveLayout';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SOURCE_LABELS: Record<string, string> = {
  pdf_digitized: 'PDF Import',
  customized:    'Customized',
  blank_canvas:  'Blank Canvas',
};

const SOURCE_VARIANTS: Record<string, 'default' | 'secondary' | 'outline'> = {
  pdf_digitized: 'outline',
  customized:    'secondary',
  blank_canvas:  'secondary',
};


function formatUpdated(ts: any): string {
  try {
    const date = ts?.toDate ? ts.toDate() : new Date(ts);
    return format(date, 'MMM d, yyyy');
  } catch {
    return '—';
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TemplateList() {
  const navigate = useNavigate();
  const { user } = useUser();

  const [templates, setTemplates] = useState<SiteTemplate[]>([]);
  const [systemTemplates, setSystemTemplates] = useState<SiteTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<SiteTemplate | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);

  // Real-time listener — org templates
  useEffect(() => {
    if (!db || !user?.organizationId) return;
    const q = query(
      collection(db, 'siteTemplates'),
      where('orgId', '==', user.organizationId),
      orderBy('updatedAt', 'desc'),
    );
    const unsub = onSnapshot(q, snap => {
      setTemplates(snap.docs.map(d => ({ id: d.id, ...d.data() } as SiteTemplate)));
      setLoading(false);
    }, err => {
      console.error(err);
      setLoading(false);
    });
    return unsub;
  }, [user?.organizationId]);

  // Real-time listener — system default templates
  useEffect(() => {
    if (!db) return;
    const q = query(
      collection(db, 'siteTemplates'),
      where('orgId', '==', 'SYSTEM'),
      orderBy('updatedAt', 'desc'),
    );
    const unsub = onSnapshot(q, snap => {
      setSystemTemplates(snap.docs.map(d => ({ id: d.id, ...d.data() } as SiteTemplate)));
    }, err => {
      console.error('System templates listener error:', err);
    });
    return unsub;
  }, []);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const handlePublish = async (t: SiteTemplate) => {
    setActionInProgress(t.id);
    try {
      if (t.status === 'published') {
        await SiteTemplatesService.archiveTemplate(t.id);
        toast.success('Template unpublished.');
      } else {
        await SiteTemplatesService.publishTemplate(t.id);
        toast.success('Template published.');
      }
    } catch {
      toast.error('Action failed. Please try again.');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleDuplicate = async (t: SiteTemplate) => {
    if (!user?.organizationId) return;
    setActionInProgress(t.id);
    try {
      const [fields, sections] = await Promise.all([
        SiteTemplatesService.getTemplateFields(t.id),
        SiteTemplatesService.getTemplateSections(t.id),
      ]);
      const newId = await SiteTemplatesService.createTemplate({
        orgId: user.organizationId,
        name: `Copy of ${t.name}`,
        siteType: t.siteType,
        sourceType: 'customized',
        status: 'draft',
        createdBy: user.uid,
        fieldCount: fields.length,
      });
      await Promise.all([
        SiteTemplatesService.batchSaveSections(newId, sections),
        SiteTemplatesService.batchSaveFields(newId, fields),
      ]);
      toast.success('Template duplicated.');
      navigate(`/templates/${newId}/edit`);
    } catch {
      toast.error('Duplicate failed. Please try again.');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await SiteTemplatesService.deleteTemplate(deleteTarget.id);
      toast.success('Template deleted.');
    } catch (e: any) {
      toast.error(e.message ?? 'Delete failed.');
    } finally {
      setDeleteTarget(null);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <ResponsiveLayout>
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Form Templates</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {loading ? '…' : `${templates.length + systemTemplates.length} template${templates.length + systemTemplates.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <Button onClick={() => setIsNewModalOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          New Template
        </Button>
      </div>

      {/* Loading skeletons */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-4 p-4 border rounded-xl">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-20 ml-auto" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state — only when no org templates AND no system templates */}
      {!loading && templates.length === 0 && systemTemplates.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed rounded-xl">
          <FileText className="h-12 w-12 text-muted-foreground mb-3" />
          <p className="font-medium">No templates yet</p>
          <p className="text-sm text-muted-foreground mb-4">
            Upload a PDF or start from a blank canvas.
          </p>
          <Button onClick={() => setIsNewModalOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            New Template
          </Button>
        </div>
      )}

      {/* Template table */}
      {!loading && (templates.length > 0 || systemTemplates.length > 0) && (
        <div className="border rounded-xl overflow-hidden">
          {/* Column headers */}
          <div className="grid grid-cols-[1fr_120px_100px_90px_80px_44px] gap-3 px-4 py-2.5 bg-muted/50 text-xs font-medium text-muted-foreground border-b">
            <span>Name</span>
            <span>Site Type</span>
            <span>Source</span>
            <span>Status</span>
            <span>Updated</span>
            <span />
          </div>

          {/* System (default) templates first */}
          {systemTemplates.map(t => (
            <div
              key={t.id}
              className="grid grid-cols-[1fr_120px_100px_90px_80px_44px] gap-3 items-center px-4 py-3 border-b last:border-0 bg-amber-50/40 hover:bg-amber-50/60 transition-colors"
            >
              {/* Name */}
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <Lock className="h-3 w-3 text-amber-600 shrink-0" />
                  <p
                    className="font-medium text-sm truncate cursor-pointer hover:text-primary"
                    onClick={() => navigate(`/templates/${t.id}/edit`)}
                  >
                    {t.name}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground pl-4.5">{t.fieldCount} fields</p>
              </div>

              {/* Site Type */}
              <span className="text-sm truncate">{t.siteType}</span>

              {/* Source — show "System Default" */}
              <Badge variant="outline" className="text-xs w-fit border-amber-400 text-amber-700">
                System Default
              </Badge>

              {/* Status */}
              <Badge variant="default" className="text-xs w-fit">
                Published
              </Badge>

              {/* Updated */}
              <span className="text-xs text-muted-foreground">{formatUpdated(t.updatedAt)}</span>

              {/* Actions — system templates can only be duplicated */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => navigate(`/templates/${t.id}/edit`)}>
                    <Edit className="h-3.5 w-3.5 mr-2" />
                    View / Edit Fields
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleDuplicate(t)}>
                    <Copy className="h-3.5 w-3.5 mr-2" />
                    Duplicate as Custom
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}

          {/* Org templates */}
          {templates.map(t => {
            const busy = actionInProgress === t.id;
            return (
              <div
                key={t.id}
                className="grid grid-cols-[1fr_120px_100px_90px_80px_44px] gap-3 items-center px-4 py-3 border-b last:border-0 hover:bg-muted/30 transition-colors"
              >
                {/* Name */}
                <div className="min-w-0">
                  <p
                    className="font-medium text-sm truncate cursor-pointer hover:text-primary"
                    onClick={() => navigate(`/templates/${t.id}/edit`)}
                  >
                    {t.name}
                  </p>
                  <p className="text-xs text-muted-foreground">{t.fieldCount} fields</p>
                </div>

                {/* Site Type */}
                <span className="text-sm truncate">{t.siteType}</span>

                {/* Source */}
                <Badge variant={SOURCE_VARIANTS[t.sourceType] ?? 'outline'} className="text-xs w-fit">
                  {SOURCE_LABELS[t.sourceType] ?? t.sourceType}
                </Badge>

                {/* Status */}
                <Badge
                  variant={t.status === 'published' ? 'default' : 'secondary'}
                  className="text-xs w-fit"
                >
                  {t.status === 'published' ? 'Published' : 'Draft'}
                </Badge>

                {/* Updated */}
                <span className="text-xs text-muted-foreground">{formatUpdated(t.updatedAt)}</span>

                {/* Actions */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8" disabled={busy}>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => navigate(`/templates/${t.id}/edit`)}>
                      <Edit className="h-3.5 w-3.5 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDuplicate(t)}>
                      <Copy className="h-3.5 w-3.5 mr-2" />
                      Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handlePublish(t)}>
                      {t.status === 'published'
                        ? <><EyeOff className="h-3.5 w-3.5 mr-2" />Unpublish</>
                        : <><Globe className="h-3.5 w-3.5 mr-2" />Publish</>
                      }
                    </DropdownMenuItem>
                    {t.status === 'draft' && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDeleteTarget(t)}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}
        </div>
      )}

      {/* New Template choice modal */}
      <NewTemplateModal open={isNewModalOpen} onOpenChange={setIsNewModalOpen} />

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete template?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteTarget?.name}</strong> will be permanently deleted.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </ResponsiveLayout>
  );
}
