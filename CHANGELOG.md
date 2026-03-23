## Week of Mar 23, 2026

## ArchePal Developer Changelog (Mar 16 – Mar 23, 2026)

### Frontend
*   Added a new 5-step wizard for uploading and parsing filled paper forms (PDFs/images) using AI.
*   Enhanced the form-filling interface with a new scan-to-fill feature and a site photos panel for media attachments.
*   Updated navigation and the admin dashboard to include the new upload feature and a template review status card.
*   Improved the file upload component with image previews and shared media context.
*   Added a sticky save bar and better state management to the form UI.

### Backend
*   Introduced a new AI service for parsing filled forms and extracting structure and values.
*   Added template matching logic to suggest existing templates during uploads, with a new admin review workflow for unmatched forms.
*   Implemented rate limiting across several API endpoints for improved stability.
*   Added new backend services and routers to support the filled form upload and parsing flow.
*   Fixed Firestore permissions for MEMBER users filling out forms.

### Infrastructure
*   Updated Firestore security rules to support the new upload permissions and workflows.
*   Improved Firebase initialization with better error handling.

### Docs
*   Added internal documentation for the new filled form upload feature.

---

# Changelog

## Week of Mar 16, 2026

**Changelog – Mar 9 to Mar 16, 2026**

**Frontend**
*   Added a help button to the user interface.
*   Implemented a new dynamic form feature.

**Backend**
*   Fixed a critical startup error by adding missing stubs for crash logging and middleware modules, resolving Vercel deployment failures.

**Infrastructure**
*   No changes this week.

**Documentation**
*   No changes this week.
