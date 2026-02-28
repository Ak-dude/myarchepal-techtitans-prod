import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  limit,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { SiteSubmission } from '@/types/siteSubmissions';

export class SiteSubmissionsService {
  private static submissionsRef(siteId: string) {
    if (!db) throw new Error('Firebase is not properly initialized');
    return collection(db, 'Sites', siteId, 'submissions');
  }

  static async createSubmission(
    siteId: string,
    data: Omit<SiteSubmission, 'id'>
  ): Promise<string> {
    const ref = this.submissionsRef(siteId);
    const docRef = await addDoc(ref, {
      ...data,
      lastSavedAt: Timestamp.now(),
    });
    return docRef.id;
  }

  static async getSubmission(
    siteId: string,
    submissionId: string
  ): Promise<SiteSubmission> {
    if (!db) throw new Error('Firebase is not properly initialized');
    const snap = await getDoc(doc(db, 'Sites', siteId, 'submissions', submissionId));
    if (!snap.exists()) throw new Error(`Submission ${submissionId} not found`);
    return { id: snap.id, ...snap.data() } as SiteSubmission;
  }

  /** Returns the first submission for a site, or null if none exists. */
  static async getSubmissionBySite(siteId: string): Promise<SiteSubmission | null> {
    const q = query(this.submissionsRef(siteId), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return { id: d.id, ...d.data() } as SiteSubmission;
  }

  static async updateSubmission(
    siteId: string,
    submissionId: string,
    data: Partial<SiteSubmission>
  ): Promise<void> {
    if (!db) throw new Error('Firebase is not properly initialized');
    await updateDoc(doc(db, 'Sites', siteId, 'submissions', submissionId), {
      ...data,
      lastSavedAt: Timestamp.now(),
    });
  }

  /** Marks the submission as submitted — sets isDraft: false, status: 'submitted', submittedAt. */
  static async submitForm(siteId: string, submissionId: string): Promise<void> {
    if (!db) throw new Error('Firebase is not properly initialized');
    await updateDoc(doc(db, 'Sites', siteId, 'submissions', submissionId), {
      isDraft: false,
      status: 'submitted',
      submittedAt: serverTimestamp(),
      lastSavedAt: Timestamp.now(),
    });
  }

  /** Returns all submissions for a given consultant across all sites. */
  static async getSubmissionsByConsultant(
    consultantId: string
  ): Promise<SiteSubmission[]> {
    if (!db) throw new Error('Firebase is not properly initialized');
    // Note: this is a collection group query — requires a Firestore composite index
    // firestore.indexes.json entry is added in Task 6.4
    const { collectionGroup } = await import('firebase/firestore');
    const q = query(
      collectionGroup(db, 'submissions'),
      where('consultantId', '==', consultantId)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as SiteSubmission));
  }
}
