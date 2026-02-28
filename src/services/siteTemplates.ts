import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { SiteTemplate, TemplateField, TemplateSection } from '@/types/siteTemplates';

export class SiteTemplatesService {
  // -------------------------------------------------------------------------
  // Template CRUD
  // -------------------------------------------------------------------------

  static async createTemplate(
    data: Omit<SiteTemplate, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    if (!db) throw new Error('Firebase is not properly initialized');
    const ref = collection(db, 'siteTemplates');
    // Strip undefined values — Firestore rejects them
    const clean = Object.fromEntries(
      Object.entries({ ...data, createdAt: Timestamp.now(), updatedAt: Timestamp.now() })
        .filter(([, v]) => v !== undefined)
    );
    const docRef = await addDoc(ref, clean);
    return docRef.id;
  }

  static async getTemplate(templateId: string): Promise<SiteTemplate> {
    if (!db) throw new Error('Firebase is not properly initialized');
    const snap = await getDoc(doc(db, 'siteTemplates', templateId));
    if (!snap.exists()) throw new Error(`Template ${templateId} not found`);
    return { id: snap.id, ...snap.data() } as SiteTemplate;
  }

  static async listTemplates(orgId: string): Promise<SiteTemplate[]> {
    if (!db) throw new Error('Firebase is not properly initialized');
    const q = query(
      collection(db, 'siteTemplates'),
      where('orgId', '==', orgId),
      orderBy('updatedAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as SiteTemplate));
  }

  static async updateTemplate(
    templateId: string,
    data: Partial<SiteTemplate>
  ): Promise<void> {
    if (!db) throw new Error('Firebase is not properly initialized');
    await updateDoc(doc(db, 'siteTemplates', templateId), {
      ...data,
      updatedAt: Timestamp.now(),
    });
  }

  static async publishTemplate(templateId: string): Promise<void> {
    if (!db) throw new Error('Firebase is not properly initialized');
    await updateDoc(doc(db, 'siteTemplates', templateId), {
      status: 'published',
      updatedAt: Timestamp.now(),
    });
  }

  static async archiveTemplate(templateId: string): Promise<void> {
    if (!db) throw new Error('Firebase is not properly initialized');
    await updateDoc(doc(db, 'siteTemplates', templateId), {
      status: 'draft',
      updatedAt: Timestamp.now(),
    });
  }

  /** Only draft templates can be deleted. */
  static async deleteTemplate(templateId: string): Promise<void> {
    if (!db) throw new Error('Firebase is not properly initialized');
    const template = await this.getTemplate(templateId);
    if (template.status !== 'draft') {
      throw new Error('Only draft templates can be deleted. Archive the template first.');
    }
    await deleteDoc(doc(db, 'siteTemplates', templateId));
  }

  // -------------------------------------------------------------------------
  // Fields subcollection
  // -------------------------------------------------------------------------

  static async getTemplateFields(templateId: string): Promise<TemplateField[]> {
    if (!db) throw new Error('Firebase is not properly initialized');
    const q = query(
      collection(db, 'siteTemplates', templateId, 'fields'),
      orderBy('order', 'asc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as TemplateField));
  }

  /** Upserts a single field document (for auto-save on blur). */
  static async saveField(templateId: string, field: TemplateField): Promise<void> {
    if (!db) throw new Error('Firebase is not properly initialized');
    const { id, ...data } = field;
    await setDoc(doc(db, 'siteTemplates', templateId, 'fields', id), data);
  }

  /** Deletes a single field document. */
  static async deleteField(templateId: string, fieldId: string): Promise<void> {
    if (!db) throw new Error('Firebase is not properly initialized');
    await deleteDoc(doc(db, 'siteTemplates', templateId, 'fields', fieldId));
  }

  /** Replaces all fields for the template in a single batch write. */
  static async batchSaveFields(
    templateId: string,
    fields: TemplateField[]
  ): Promise<void> {
    if (!db) throw new Error('Firebase is not properly initialized');
    const batch = writeBatch(db);
    const fieldsCol = collection(db, 'siteTemplates', templateId, 'fields');
    for (const field of fields) {
      const { id, ...data } = field;
      batch.set(doc(fieldsCol, id), data);
    }
    await batch.commit();
  }

  // -------------------------------------------------------------------------
  // Sections subcollection
  // -------------------------------------------------------------------------

  static async getTemplateSections(templateId: string): Promise<TemplateSection[]> {
    if (!db) throw new Error('Firebase is not properly initialized');
    const q = query(
      collection(db, 'siteTemplates', templateId, 'sections'),
      orderBy('order', 'asc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as TemplateSection));
  }

  /** Upserts a single section document (for auto-save on blur). */
  static async saveSection(templateId: string, section: TemplateSection): Promise<void> {
    if (!db) throw new Error('Firebase is not properly initialized');
    const { id, ...data } = section;
    await setDoc(doc(db, 'siteTemplates', templateId, 'sections', id), data);
  }

  /** Replaces all sections for the template in a single batch write. */
  static async batchSaveSections(
    templateId: string,
    sections: TemplateSection[]
  ): Promise<void> {
    if (!db) throw new Error('Firebase is not properly initialized');
    const batch = writeBatch(db);
    const sectionsCol = collection(db, 'siteTemplates', templateId, 'sections');
    for (const section of sections) {
      const { id, ...data } = section;
      batch.set(doc(sectionsCol, id), data);
    }
    await batch.commit();
  }
}
