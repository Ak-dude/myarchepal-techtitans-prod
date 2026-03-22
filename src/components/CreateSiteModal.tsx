import { useNavigate } from 'react-router-dom';
import { Upload, Plus } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface CreateSiteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateSiteModal({ open, onOpenChange }: CreateSiteModalProps) {
  const navigate = useNavigate();

  const go = (path: string) => {
    onOpenChange(false);
    navigate(path);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New Archaeological Site</DialogTitle>
          <DialogDescription>
            Create a new site and fill out its form, or digitize an existing paper form.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 space-y-3">
          <Button
            variant="outline"
            className="w-full justify-start gap-3 h-14 text-left"
            onClick={() => go('/new-site')}
          >
            <Plus className="h-5 w-5 text-primary shrink-0" />
            <div>
              <p className="font-medium text-sm">Create New Site</p>
              <p className="text-xs text-muted-foreground">Fill in site details and choose a form template</p>
            </div>
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start gap-3 h-14 text-left"
            onClick={() => go('/upload-filled-form')}
          >
            <Upload className="h-5 w-5 text-primary shrink-0" />
            <div>
              <p className="font-medium text-sm">Upload Filled Paper Form</p>
              <p className="text-xs text-muted-foreground">Digitize an already-completed paper form using AI</p>
            </div>
          </Button>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
