import {
  collection,
  doc,
  getDocs,
  updateDoc,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Site } from '@/services/sites';

export class SiteAssignmentsService {
  /**
   * Assigns a field consultant to a site and triggers an email notification.
   * Updates Sites/{siteId}: assignedConsultantId, assignedConsultantEmail, submissionStatus='assigned'.
   */
  static async assignConsultant(
    siteId: string,
    consultantId: string,
    consultantEmail: string
  ): Promise<void> {
    if (!db) throw new Error('Firebase is not properly initialized');
    await updateDoc(doc(db, 'Sites', siteId), {
      assignedConsultantId: consultantId,
      assignedConsultantEmail: consultantEmail,
      submissionStatus: 'assigned',
      updatedAt: Timestamp.now(),
    });

    // Fire-and-forget — notify backend to send email (Task 5.5)
    try {
      await fetch('/api/notify-consultant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, consultantId, consultantEmail }),
      });
    } catch {
      // Non-critical — assignment already saved; notification can be retried
      console.warn('Consultant notification request failed — will not block assignment.');
    }
  }

  /**
   * Returns all sites assigned to a specific consultant within an organization.
   * Queries Sites where assignedConsultantId == consultantId && organizationId == orgId.
   */
  static async getMemberAssignments(
    consultantId: string,
    orgId: string
  ): Promise<Site[]> {
    if (!db) throw new Error('Firebase is not properly initialized');
    const q = query(
      collection(db, 'Sites'),
      where('assignedConsultantId', '==', consultantId),
      where('organizationId', '==', orgId)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Site));
  }
}
