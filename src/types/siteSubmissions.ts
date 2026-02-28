import { Timestamp } from 'firebase/firestore';

export type SubmissionStatus = 'assigned' | 'in_progress' | 'submitted' | 'reviewed';

export interface MediaAttachment {
  id: string;
  storagePath: string;
  downloadUrl: string;
  linkedFieldId?: string;
  fileName: string;
  fileSize: number;
  uploadedAt: Timestamp;
}

export interface SiteSubmission {
  id: string;
  siteId: string;
  templateId: string;
  consultantId: string;        // Firebase Auth UID of the MEMBER
  organizationId: string;
  formData: Record<string, unknown>;   // fieldId → value
  mediaAttachments: MediaAttachment[];
  status: SubmissionStatus;
  submittedAt?: Timestamp;
  lastSavedAt: Timestamp;
  isDraft: boolean;
}
