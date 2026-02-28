import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  DocumentData,
  QuerySnapshot,
  DocumentReference,
  CollectionReference
} from 'firebase/firestore';
import { db, storage } from '@/lib/firebase';
import type { SubmissionStatus } from '@/types/siteSubmissions';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

// Site interface matching your Firestore document structure
export interface Site {
  id?: string;
  name: string;
  location: {
    latitude: number;
    longitude: number;
    address?: string;
    country?: string;
    region?: string;
  };
  description: string;
  researchAnalysis?: string;
  dateDiscovered: Date | Timestamp;
  period?: string;
  artifacts?: string[];
  images?: string[];
  status: 'draft' | 'active' | 'inactive' | 'archived';
  createdAt?: Date | Timestamp;
  updatedAt?: Date | Timestamp;
  createdBy?: string;
  organizationId?: string; // Organization that owns this site
  visibility?: 'public' | 'private'; // Visibility setting (Pro/Enterprise orgs only)
  siteAdmins?: string[]; // User IDs who are admins of this site (can edit site and its artifacts)
  // NC archaeology form fields (Task 3.2)
  siteType?: string;           // Cemetery, Habitation, Rock Art, etc.
  stateSiteNumber?: string;    // NC state site number e.g. "31-AB-123"
  // Dynamic form template fields (Task 1.1)
  linkedTemplateId?: string;
  assignedConsultantId?: string;
  assignedConsultantEmail?: string;
  submissionStatus?: SubmissionStatus;
}

// Collection reference - with error handling
let sitesCollection: CollectionReference<DocumentData> | undefined;
try {
  if (db) {
    sitesCollection = collection(db, 'Sites');
  }
} catch (error) {
  console.error('Failed to create Sites collection reference:', error);
}

// Sites Service Class
export class SitesService {
  // Get all sites
  static async getAllSites(): Promise<Site[]> {
    try {
      console.log('📍 getAllSites: Starting fetch...');
      if (!sitesCollection || !db) {
        console.warn('📍 getAllSites: Firebase is not properly initialized');
        return [];
      }
      console.log('📍 getAllSites: Calling getDocs...');
      const querySnapshot: QuerySnapshot<DocumentData> = await getDocs(sitesCollection);
      console.log('📍 getAllSites: Got', querySnapshot.docs.length, 'documents');
      const sites = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Site));
      console.log('📍 getAllSites: Returning sites:', sites.length);
      return sites;
    } catch (error) {
      console.error('📍 getAllSites: Error fetching sites:', error);
      throw error;
    }
  }

  // Get a single site by ID
  static async getSiteById(siteId: string): Promise<Site | null> {
    try {
      if (!db) {
        console.warn('Firebase is not properly initialized');
        return null;
      }
      const siteDoc = doc(db, 'Sites', siteId);
      const siteSnapshot = await getDoc(siteDoc);

      if (siteSnapshot.exists()) {
        return {
          id: siteSnapshot.id,
          ...siteSnapshot.data()
        } as Site;
      }
      return null;
    } catch (error) {
      console.error('Error fetching site:', error);
      throw error;
    }
  }

  // Create a new site
  static async createSite(siteData: Omit<Site, 'id'>): Promise<string> {
    try {
      console.log('🏛️ Creating new site with data:', siteData);

      if (!sitesCollection) {
        console.error('❌ Sites collection is not initialized');
        console.error('Database instance:', db ? '✅ Available' : '❌ Missing');
        throw new Error('Firebase Firestore is not properly initialized');
      }

      if (!db) {
        console.error('❌ Firestore database is not initialized');
        throw new Error('Firebase database is not available');
      }

      const newSiteData = {
        ...siteData,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      console.log('📝 Attempting to save to Firestore Sites collection...');
      const docRef: DocumentReference = await addDoc(sitesCollection, newSiteData);
      console.log('✅ Site created successfully with ID:', docRef.id);

      return docRef.id;
    } catch (error: any) {
      console.error('❌ Error creating site:', error);
      console.error('Error details:', {
        message: error.message || 'Unknown error',
        code: error.code || 'No code',
        customData: error.customData || 'No custom data',
        sitesCollection: sitesCollection ? '✅ Available' : '❌ Missing',
        db: db ? '✅ Available' : '❌ Missing'
      });

      // Check for specific Firebase errors
      if (error.code === 'permission-denied') {
        throw new Error('Permission denied. Please make sure you are signed in and Firestore security rules allow this operation.');
      } else if (error.code === 'unavailable') {
        throw new Error('Firestore is currently unavailable. Please try again later.');
      } else if (error.code === 'unauthenticated') {
        throw new Error('You must be authenticated to create sites. Please sign in again.');
      } else {
        throw new Error(`Failed to create site: ${error.message || 'Unknown error'}`);
      }
    }
  }

  // Update an existing site
  static async updateSite(siteId: string, updates: Partial<Site>): Promise<void> {
    try {
      if (!db) {
        throw new Error('Firebase is not properly initialized');
      }
      const siteDoc = doc(db, 'Sites', siteId);
      const updateData = {
        ...updates,
        updatedAt: Timestamp.now()
      };

      await updateDoc(siteDoc, updateData);
    } catch (error) {
      console.error('Error updating site:', error);
      throw error;
    }
  }

  // Delete a site
  static async deleteSite(siteId: string): Promise<void> {
    try {
      if (!db) {
        throw new Error('Firebase is not properly initialized');
      }
      const siteDoc = doc(db, 'Sites', siteId);
      await deleteDoc(siteDoc);
    } catch (error) {
      console.error('Error deleting site:', error);
      throw error;
    }
  }

  // Search sites by location (country/region)
  static async searchSitesByLocation(location: string): Promise<Site[]> {
    try {
      if (!sitesCollection) {
        console.warn('Firebase is not properly initialized');
        return [];
      }
      const q = query(
        sitesCollection,
        where('location.country', '==', location)
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Site));
    } catch (error) {
      console.error('Error searching sites:', error);
      throw error;
    }
  }

  // Get recent sites
  static async getRecentSites(limitCount: number = 10): Promise<Site[]> {
    try {
      if (!sitesCollection) {
        console.warn('Firebase is not properly initialized');
        return [];
      }
      const q = query(
        sitesCollection,
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Site));
    } catch (error) {
      console.error('Error fetching recent sites:', error);
      throw error;
    }
  }

  // Get active sites
  static async getActiveSites(): Promise<Site[]> {
    try {
      if (!sitesCollection) {
        console.warn('Firebase is not properly initialized');
        return [];
      }
      const q = query(
        sitesCollection,
        where('status', '==', 'active')
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Site));
    } catch (error) {
      console.error('Error fetching active sites:', error);
      throw error;
    }
  }

  // Get sites by organization ID
  static async getSitesByOrganization(organizationId: string): Promise<Site[]> {
    try {
      if (!sitesCollection) {
        console.warn('Firebase is not properly initialized');
        return [];
      }
      const q = query(
        sitesCollection,
        where('organizationId', '==', organizationId)
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Site));
    } catch (error) {
      console.error('Error fetching sites by organization:', error);
      throw error;
    }
  }


  // Add a user as site admin
  static async addSiteAdmin(siteId: string, userId: string): Promise<void> {
    try {
      if (!db) {
        throw new Error('Firebase is not properly initialized');
      }
      const site = await this.getSiteById(siteId);
      if (!site) {
        throw new Error('Site not found');
      }

      const currentAdmins = site.siteAdmins || [];
      if (!currentAdmins.includes(userId)) {
        const siteDoc = doc(db, 'Sites', siteId);
        await updateDoc(siteDoc, {
          siteAdmins: [...currentAdmins, userId],
          updatedAt: Timestamp.now()
        });
        console.log('✅ Site admin added:', userId);
      }
    } catch (error) {
      console.error('Error adding site admin:', error);
      throw error;
    }
  }

  // Remove a user from site admins
  static async removeSiteAdmin(siteId: string, userId: string): Promise<void> {
    try {
      if (!db) {
        throw new Error('Firebase is not properly initialized');
      }
      const site = await this.getSiteById(siteId);
      if (!site) {
        throw new Error('Site not found');
      }

      const currentAdmins = site.siteAdmins || [];
      const updatedAdmins = currentAdmins.filter(id => id !== userId);

      const siteDoc = doc(db, 'Sites', siteId);
      await updateDoc(siteDoc, {
        siteAdmins: updatedAdmins,
        updatedAt: Timestamp.now()
      });
      console.log('✅ Site admin removed:', userId);
    } catch (error) {
      console.error('Error removing site admin:', error);
      throw error;
    }
  }

  // Check if a user is a site admin
  static async isSiteAdmin(siteId: string, userId: string): Promise<boolean> {
    try {
      const site = await this.getSiteById(siteId);
      if (!site) return false;

      // Site creator is always considered an admin
      if (site.createdBy === userId) return true;

      // Check siteAdmins array
      return site.siteAdmins?.includes(userId) || false;
    } catch (error) {
      console.error('Error checking site admin status:', error);
      return false;
    }
  }

  // Get all site admins for a site
  static async getSiteAdmins(siteId: string): Promise<string[]> {
    try {
      const site = await this.getSiteById(siteId);
      if (!site) return [];

      // Include site creator + explicit admins
      const admins = new Set<string>();
      if (site.createdBy) admins.add(site.createdBy);
      if (site.siteAdmins) {
        site.siteAdmins.forEach(id => admins.add(id));
      }

      return Array.from(admins);
    } catch (error) {
      console.error('Error getting site admins:', error);
      return [];
    }
  }

  // Upload site image
  static async uploadSiteImage(siteId: string, file: File): Promise<string> {
    try {
      console.log('🔄 Starting site image upload...');
      console.log('Storage instance:', storage ? '✅ Available' : '❌ Not available');
      console.log('File info:', { name: file.name, size: file.size, type: file.type });

      if (!storage) {
        console.error('❌ Firebase Storage is not initialized');
        throw new Error('Firebase Storage is not properly initialized');
      }

      // Create a unique filename
      const timestamp = Date.now();
      const filename = `sites/${siteId}/${timestamp}_${file.name}`;
      console.log('📁 Upload path:', filename);

      const storageRef = ref(storage, filename);
      console.log('🎯 Storage ref created:', storageRef.toString());

      // Upload the file
      console.log('⬆️ Uploading file...');
      const snapshot = await uploadBytes(storageRef, file);
      console.log('✅ Upload completed:', snapshot.metadata);

      // Get the download URL
      console.log('🔗 Getting download URL...');
      const downloadURL = await getDownloadURL(snapshot.ref);
      console.log('✅ Download URL obtained:', downloadURL);

      return downloadURL;
    } catch (error: any) {
      console.error('❌ Error uploading site image:');
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      console.error('Full error:', error);

      // Provide more specific error messages
      if (error.code === 'storage/unauthorized') {
        throw new Error('Upload unauthorized. Please check Firebase Storage security rules.');
      } else if (error.code === 'storage/quota-exceeded') {
        throw new Error('Storage quota exceeded. Please upgrade your Firebase plan.');
      } else if (error.code === 'storage/unauthenticated') {
        throw new Error('You must be signed in to upload images.');
      } else {
        throw new Error(`Upload failed: ${error.message || 'Unknown error'}`);
      }
    }
  }

  // Delete site image
  static async deleteSiteImage(imageUrl: string): Promise<void> {
    try {
      if (!storage) {
        throw new Error('Firebase Storage is not properly initialized');
      }

      // Create a reference from the URL
      const imageRef = ref(storage, imageUrl);

      // Delete the file
      await deleteObject(imageRef);
    } catch (error) {
      console.error('Error deleting site image:', error);
      // Don't throw error as image might already be deleted
    }
  }

  // Update site with image URLs
  static async updateSiteImages(siteId: string, imageUrls: string[]): Promise<void> {
    try {
      if (!db) {
        throw new Error('Firebase is not properly initialized');
      }
      const siteDoc = doc(db, 'Sites', siteId);

      await updateDoc(siteDoc, {
        images: imageUrls,
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      console.error('Error updating site images:', error);
      throw error;
    }
  }
}