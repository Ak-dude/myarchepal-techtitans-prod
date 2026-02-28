import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';
import { FileUp, PenLine, LayoutTemplate, Search, Loader2 } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

import { useUser } from '@/hooks/use-user';
import { SiteTemplatesService } from '@/services/siteTemplates';
import type { SiteTemplate } from '@/types/siteTemplates';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface NewTemplateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ---------------------------------------------------------------------------
// Option card
// ---------------------------------------------------------------------------

function OptionCard({
  icon: Icon,
  title,
  description,
  onClick,
  disabled,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-start gap-3 w-full p-5 rounded-xl border border-border bg-card hover:bg-muted/50 hover:border-primary/40 transition-all duration-150 text-left disabled:opacity-50 disabled:pointer-events-none"
    >
      <span className="p-2.5 rounded-lg bg-primary/10">
        <Icon className="h-5 w-5 text-primary" />
      </span>
      <div>
        <p className="font-semibold text-sm">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function NewTemplateModal({ open, onOpenChange }: NewTemplateModalProps) {
  const navigate = useNavigate();
  const { user } = useUser();

  // "Edit Existing" panel state
  const [showExisting, setShowExisting] = useState(false);
  const [templates, setTemplates] = useState<SiteTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [search, setSearch] = useState('');
  const [duplicating, setDuplicating] = useState<string | null>(null);

  // Reset sub-panel when modal closes
  useEffect(() => {
    if (!open) {
      setShowExisting(false);
      setSearch('');
    }
  }, [open]);

  // Load published templates when "Edit Existing" panel opens
  useEffect(() => {
    if (!showExisting || !user?.organizationId || !db) return;
    setLoadingTemplates(true);
    getDocs(
      query(
        collection(db, 'siteTemplates'),
        where('orgId', '==', user.organizationId),
        where('status', '==', 'published'),
        orderBy('updatedAt', 'desc'),
      ),
    )
      .then(snap => {
        setTemplates(snap.docs.map(d => ({ id: d.id, ...d.data() } as SiteTemplate)));
      })
      .catch(() => toast.error('Failed to load templates.'))
      .finally(() => setLoadingTemplates(false));
  }, [showExisting, user?.organizationId]);

  const filtered = templates.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.siteType.toLowerCase().includes(search.toLowerCase()),
  );

  const handleDuplicate = async (t: SiteTemplate) => {
    if (!user?.organizationId) return;
    setDuplicating(t.id);
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
      toast.success('Template duplicated — opening editor.');
      onOpenChange(false);
      navigate(`/templates/${newId}/edit`);
    } catch {
      toast.error('Duplicate failed. Please try again.');
    } finally {
      setDuplicating(null);
    }
  };

  const handleUploadPDF = () => {
    onOpenChange(false);
    navigate('/templates/new/pdf');
  };

  const handleBlankCanvas = () => {
    onOpenChange(false);
    navigate('/templates/new/blank');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {showExisting ? 'Choose a template to copy' : 'New Template'}
          </DialogTitle>
          <DialogDescription>
            {showExisting
              ? 'Select a published template. A copy will be created as a draft for you to edit.'
              : 'How would you like to start?'}
          </DialogDescription>
        </DialogHeader>

        {/* ---------------------------------------------------------------- */}
        {/* Main choice cards                                                */}
        {/* ---------------------------------------------------------------- */}
        {!showExisting && (
          <div className="flex flex-col gap-3 pt-1">
            <OptionCard
              icon={FileUp}
              title="Upload PDF"
              description="Digitize an existing paper form — Claude will extract fields automatically."
              onClick={handleUploadPDF}
            />
            <OptionCard
              icon={LayoutTemplate}
              title="Copy Existing Template"
              description="Duplicate a published template and customize it as a new draft."
              onClick={() => setShowExisting(true)}
            />
            <OptionCard
              icon={PenLine}
              title="Blank Canvas"
              description="Build a form from scratch using the drag-and-drop field editor."
              onClick={handleBlankCanvas}
            />
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* "Edit Existing" sub-panel                                        */}
        {/* ---------------------------------------------------------------- */}
        {showExisting && (
          <div className="space-y-3 pt-1">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search by name or site type…"
                className="pl-9"
                value={search}
                onChange={e => setSearch(e.target.value)}
                autoFocus
              />
            </div>

            {/* Template list */}
            <div className="max-h-72 overflow-y-auto space-y-1 rounded-lg border">
              {loadingTemplates && (
                <div className="p-3 space-y-2">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              )}

              {!loadingTemplates && filtered.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  {templates.length === 0
                    ? 'No published templates found.'
                    : 'No templates match your search.'}
                </p>
              )}

              {!loadingTemplates && filtered.map(t => (
                <button
                  key={t.id}
                  onClick={() => handleDuplicate(t)}
                  disabled={duplicating === t.id}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.fieldCount} fields</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className="text-xs">{t.siteType}</Badge>
                    {duplicating === t.id && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  </div>
                </button>
              ))}
            </div>

            {/* Back */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setShowExisting(false); setSearch(''); }}
            >
              ← Back
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
