import { useRef, useState, useContext } from 'react';
import { Controller } from 'react-hook-form';
import {
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { Timestamp } from 'firebase/firestore';
import { storage } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Paperclip, X, Loader2, Image as ImageIcon, FileText } from 'lucide-react';
import { toast } from 'sonner';
import type { FieldComponentProps } from './_types';
import type { MediaAttachment } from '@/types/siteSubmissions';
import { FormFillContext } from '@/contexts/FormFillContext';
import { SiteSubmissionsService } from '@/services/siteSubmissions';

const MAX_MB = Number(import.meta.env.VITE_MAX_UPLOAD_MB ?? '20');
const MAX_BYTES = MAX_MB * 1024 * 1024;

interface UploadingFile {
  tempId: string;
  name: string;
  progress: number; // 0–100
}

function isImageFile(fileName: string) {
  return /\.(jpe?g|png|gif|webp|svg|heic)$/i.test(fileName);
}

export default function FileUploadField({ field, control, mode }: FieldComponentProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const ctx = useContext(FormFillContext);
  // Upload is only available when filling (not preview) and context+storage are present
  const canUpload = mode === 'fill' && ctx !== null && storage !== undefined;
  const disabled = mode === 'preview';

  const [uploading, setUploading] = useState<UploadingFile[]>([]);

  // Keep a ref to the latest uploaded attachments so async upload callbacks
  // always append to the most current list rather than a stale closure.
  const latestAttachmentsRef = useRef<MediaAttachment[]>([]);

  return (
    <Controller
      name={field.id}
      control={control}
      defaultValue={field.defaultValue ?? []}
      render={({ field: rhf }) => {
        const attachments: MediaAttachment[] = Array.isArray(rhf.value)
          ? (rhf.value as MediaAttachment[])
          : [];

        // Keep the ref in sync on every render so async callbacks stay current
        latestAttachmentsRef.current = attachments;

        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
          const picked = Array.from(e.target.files ?? []);
          e.target.value = '';
          if (!canUpload || !ctx || !storage) return;

          for (const file of picked) {
            if (file.size > MAX_BYTES) {
              toast.error(`"${file.name}" exceeds the ${MAX_MB} MB limit.`);
              continue;
            }

            const tempId = crypto.randomUUID();
            setUploading(prev => [...prev, { tempId, name: file.name, progress: 0 }]);

            const path = `orgs/${ctx.orgId}/sites/${ctx.siteId}/submissions/${ctx.submissionId}/${field.id}/${file.name}`;
            const fileRef = storageRef(storage, path);
            const task = uploadBytesResumable(fileRef, file);

            task.on(
              'state_changed',
              snapshot => {
                const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
                setUploading(prev =>
                  prev.map(u => (u.tempId === tempId ? { ...u, progress: pct } : u))
                );
              },
              err => {
                console.error('Upload error:', err);
                toast.error(`Failed to upload "${file.name}"`);
                setUploading(prev => prev.filter(u => u.tempId !== tempId));
              },
              async () => {
                try {
                  const downloadUrl = await getDownloadURL(task.snapshot.ref);
                  const attachment: MediaAttachment = {
                    id: crypto.randomUUID(),
                    storagePath: path,
                    downloadUrl,
                    linkedFieldId: field.id,
                    fileName: file.name,
                    fileSize: file.size,
                    uploadedAt: Timestamp.now(),
                  };

                  // Use the ref (kept in sync every render) to avoid stale closure
                  const next = [...latestAttachmentsRef.current, attachment];
                  latestAttachmentsRef.current = next;

                  rhf.onChange(next);

                  await SiteSubmissionsService.updateSubmission(ctx.siteId, ctx.submissionId, {
                    mediaAttachments: next,
                  });
                } catch (err) {
                  console.error('Post-upload error:', err);
                  toast.error(`Error finishing upload for "${file.name}"`);
                } finally {
                  setUploading(prev => prev.filter(u => u.tempId !== tempId));
                }
              }
            );
          }
        };

        const handleDelete = async (attachment: MediaAttachment) => {
          if (!ctx || !storage) return;
          try {
            await deleteObject(storageRef(storage, attachment.storagePath));
          } catch (err) {
            // File may already be deleted from Storage — still clean up local state
            console.warn('Storage delete failed (may already be gone):', err);
          }
          const next = attachments.filter(a => a.id !== attachment.id);
          rhf.onChange(next);
          try {
            await SiteSubmissionsService.updateSubmission(ctx.siteId, ctx.submissionId, {
              mediaAttachments: next,
            });
          } catch (err) {
            console.error('Failed to update mediaAttachments after delete:', err);
          }
        };

        return (
          <div className="space-y-2">
            <Label>
              {field.label}
              {field.isRequired && <span className="text-destructive ml-1">*</span>}
            </Label>

            {/* Uploaded attachments */}
            {attachments.length > 0 && (
              <ul className="space-y-1">
                {attachments.map(a => (
                  <li
                    key={a.id}
                    className="flex items-center gap-2 text-sm bg-muted rounded px-2 py-1.5"
                  >
                    {isImageFile(a.fileName) ? (
                      <ImageIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    ) : (
                      <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    )}
                    <a
                      href={a.downloadUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 truncate text-primary hover:underline"
                    >
                      {a.fileName}
                    </a>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {(a.fileSize / 1024).toFixed(0)} KB
                    </span>
                    {!disabled && canUpload && (
                      <button type="button" onClick={() => handleDelete(a)}>
                        <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {/* In-progress uploads */}
            {uploading.length > 0 && (
              <ul className="space-y-2">
                {uploading.map(u => (
                  <li key={u.tempId} className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                      <span className="flex-1 truncate">{u.name}</span>
                      <span className="text-xs shrink-0">{u.progress}%</span>
                    </div>
                    <Progress value={u.progress} className="h-1" />
                  </li>
                ))}
              </ul>
            )}

            {/* Upload trigger */}
            {!disabled && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => inputRef.current?.click()}
                  disabled={!canUpload}
                >
                  <Paperclip className="h-3.5 w-3.5 mr-1.5" />
                  {attachments.length > 0 || uploading.length > 0 ? 'Add more' : 'Attach file'}
                </Button>
                <input
                  ref={inputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleChange}
                />
              </>
            )}

            {field.helpText && (
              <p className="text-xs text-muted-foreground">{field.helpText}</p>
            )}
          </div>
        );
      }}
    />
  );
}
