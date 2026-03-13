import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { SiteTemplatesService } from '@/services/siteTemplates';
import { useUser } from '@/hooks/use-user';
import type { SiteTemplate } from '@/types/siteTemplates';

// ---------------------------------------------------------------------------

interface CreateSiteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateSiteModal({ open, onOpenChange }: CreateSiteModalProps) {
  const navigate = useNavigate();
  const { organization } = useUser();

  const [templates, setTemplates] = useState<SiteTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('none');

  // Load published org templates + system default templates each time the modal opens
  useEffect(() => {
    if (!open || !organization?.id) return;
    setLoading(true);
    setSelectedTemplateId('none');
    Promise.all([
      SiteTemplatesService.listTemplates(organization.id).catch(() => [] as SiteTemplate[]),
      SiteTemplatesService.listSystemTemplates().catch(() => [] as SiteTemplate[]),
    ])
      .then(([orgTemplates, systemTemplates]) => {
        const published = orgTemplates.filter(t => t.status === 'published');
        // System templates first, then org templates
        setTemplates([...systemTemplates, ...published]);
      })
      .finally(() => setLoading(false));
  }, [open, organization?.id]);

  const handleContinue = () => {
    const params = selectedTemplateId !== 'none' ? `?templateId=${selectedTemplateId}` : '';
    onOpenChange(false);
    navigate(`/new-site${params}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Archaeological Site</DialogTitle>
          <DialogDescription>
            Choose a form template to use for this site, or skip and add one later.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 space-y-3">
          <Label htmlFor="template-select" className="text-sm font-medium leading-snug">
            What type of archaeological site would you like to create?
          </Label>

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading templates…
            </div>
          ) : (
            <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
              <SelectTrigger id="template-select">
                <SelectValue placeholder="Select a template" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No template</SelectItem>
                {templates.map(t => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.isSystemTemplate ? '⭐ ' : ''}{t.name}
                    {t.siteType ? ` — ${t.siteType}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {templates.length === 0 && !loading && (
            <p className="text-xs text-muted-foreground">
              No published templates yet.{' '}
              <button
                className="underline text-primary"
                onClick={() => { onOpenChange(false); navigate('/templates'); }}
              >
                Create one first
              </button>{' '}
              or continue without a template.
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleContinue} disabled={loading}>
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
