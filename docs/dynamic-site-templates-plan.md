# Dynamic Archaeology Site Templates — Development Tasks
### Stack: React 18 · Vite · TypeScript · Firebase (Firestore · Auth · Storage) · FastAPI · Capacitor · Vercel

> **Feature:** A digital form management system for NC archaeology. Organization Admins create/manage
> site form templates (via PDF upload, editing, or blank canvas). Field Consultants (MEMBER role)
> fill out assigned forms on mobile/web with offline support.

---

## Project Conventions (Follow Throughout)

- **File locations:** `src/pages/` for pages · `src/components/` for components · `src/services/`
  for Firebase CRUD · `src/hooks/` for custom hooks · `src/types/` for TypeScript types
- **Routing:** `HashRouter` via React Router — add all new routes to `src/App.tsx`
- **Route protection:** Use existing `<ProtectedRoute>`, `<AdminRoute>`, `<SuperAdminRoute>`
  from `src/components/RoleProtectedRoute.tsx`
- **Firebase SDK v9+** modular imports only — no compat layer
- **Firestore** for all structured data
- **Firebase Storage** for PDFs, photos, map attachments
- **Auth + roles:** Firestore-based roles (`users/{uid}.role = 'ORG_ADMIN' | 'MEMBER'`) checked via
  existing `useUser()` hook (`isOrgAdmin`, `isMember`, `isAdmin`)
- **PDF parsing:** FastAPI in `api/` (Python) — Claude Sonnet 4.6 via Azure AI Foundry
- **React Hook Form + Zod** for all form validation
- **Env vars:** `VITE_*` prefix for client-side · plain names for backend `.env`

---

## User Roles (Existing System — No Changes Needed)

| Role | `users/{uid}.role` value | Template Access |
|---|---|---|
| Organization Admin | `ORG_ADMIN` | Full: create/edit/delete/publish templates, create sites, assign consultants, fill protected fields |
| Field Consultant | `MEMBER` | Fill assigned forms (non-protected fields only), view assignments, sync offline |
| Super Admin | `SUPER_ADMIN` | All of the above across all organizations |

> **Decision (resolved):** Use existing `MEMBER` role for Field Consultants. No new role needed.
> The UI gates assignment features behind `isOrgAdmin` and form-filling behind `isMember`.

---

## Reference Files

- `docs/Cemetery_Site_Form.pdf` — Canonical example: 5 sections, ~60 fields, checkboxes,
  coordinates, protected admin section
- `docs/Dynamic Archaeology Site Templates.pdf` — Full feature requirements

---

## Task Overview

### Phase Summary

| Phase | Name | Tasks | Description |
|---|---|---|---|
| 1 | Foundation | 1.1 – 1.5 | TypeScript types, Firestore rules, Storage rules, service layer, dynamic PDF → Claude pipeline |
| 2 | Admin: Template UI | 2.1 – 2.5 | Template list, new template modal, PDF import review UI, field editor, blank canvas builder |
| 3 | Admin: Site Management | 3.1 – 3.4 | Site list with form status, extend site creation, assign consultant, picker component |
| 4 | Consultant: Form Filling | 4.1 – 4.5 | My assignments page, form renderer, form fill page, offline support, file upload |
| 5 | FastAPI Backend | 5.1 – 5.5 | PDF export, CSV export, email notification (parse endpoint already built in 1.5) |
| 6 | Routing & Integration | 6.1 – 6.4 | App.tsx routes, nav updates, existing screen integration, Firestore indexes |
| 7 | Validation & Review | 7.1 – 7.3 | Reliability score, coordinate validation, submission detail page |

---

### All Tasks

| Task | Name | Key Output | Depends On | Who | Complexity |
|---|---|---|---|---|---|
| **1.1** | TypeScript Interfaces | `src/types/siteTemplates.ts` · `src/types/siteSubmissions.ts` | — | Dev | S |
| **1.2** | Firestore Security Rules | `firestore.rules` (new blocks for `siteTemplates` + `submissions`) | 1.1 | Dev | S |
| **1.3** | Firebase Storage Rules | `storage.rules` (template PDFs + submission attachments) | 1.1 | Dev | S |
| **1.4** | Service Layer | `src/services/siteTemplates.ts` · `siteSubmissions.ts` · `siteAssignments.ts` | 1.1, 1.2 | Dev | M |
| **1.5** | Dynamic PDF → Template Pipeline | `api/index.py` · `api/routers/pdf.py` · `api/services/claude_parser.py` · `src/services/pdfParser.ts` · `src/pages/TemplateImportPDF.tsx` | 1.1, 1.4 | Dev | L |
| **2.1** | Templates List Page | `src/pages/TemplateList.tsx` · SideNav update | 1.4 | Dev | S |
| **2.2** | New Template Choice Modal | `src/components/templates/NewTemplateModal.tsx` | 2.1 | Dev | S |
| **2.3** | Template Review & Edit UI | `src/pages/TemplateEditor.tsx` — review and refine Claude-parsed template | 1.5, 4.2 | Dev | M |
| **2.4** | Template Field Editor | `src/pages/TemplateEditor.tsx` · `src/components/templates/FieldEditor.tsx` | 1.4, 4.2 | Dev | L |
| **2.5** | Blank Canvas Form Builder | `src/pages/TemplateBuilder.tsx` | 2.4, 4.2 | Dev | L |
| **3.1** | Admin Site Assignments List | `src/pages/AdminSiteAssignments.tsx` | 1.4 | Dev | S |
| **3.2** | Extend Site Creation | Update `src/pages/NewSite.tsx` + `SiteDetails.tsx` + `src/services/sites.ts` | 1.4 | Dev | S |
| **3.3** | Assign Form to Consultant | `src/pages/AssignForm.tsx` | 1.4, 3.4, 5.5 | Dev | S |
| **3.4** | Consultant Picker Component | `src/components/templates/ConsultantPicker.tsx` | 1.1 | Dev | S |
| **4.1** | My Assignments Page | `src/pages/MyAssignments.tsx` · BottomNav + SideNav update | 1.4 | Dev | S |
| **4.2** | Dynamic Form Renderer | `src/components/DynamicFormRenderer.tsx` · `src/components/formFields/` (10 components) · `src/lib/conditionalLogic.ts` | 1.1 | Dev | L |
| **4.3** | Form Fill Page | `src/pages/FormFill.tsx` (auto-save, progress bar, submit) | 1.4, 4.2 | Dev | L |
| **4.4** | Offline Support | Update `src/lib/firebase.ts` · `src/components/OfflineStatusBanner.tsx` · `src/lib/mediaQueue.ts` | 4.3 | Dev | M |
| **4.5** | File Upload Field | `src/components/formFields/FileUploadField.tsx` (camera + gallery + offline queue) | 4.2, 4.4 | Dev | M |
| **5.1** | ~~FastAPI App Setup~~ | ✅ Done in Task 1.5 — `api/index.py` · `vercel.json` · `requirements.txt` | — | — | — |
| **5.2** | ~~PDF Parse Endpoint~~ | ✅ Done in Task 1.5 — `api/routers/pdf.py` · `api/services/claude_parser.py` | — | — | — |
| **5.3** | PDF Export Endpoint | `api/routers/export.py` · `api/services/pdf_builder.py` | 1.5 | Dev | M |
| **5.4** | CSV Export Endpoint | `api/routers/export.py` (burial table → CSV) | 5.1 | Dev | S |
| **5.5** | Consultant Notification | `api/routers/notify.py` (email via aiosmtplib) | 5.1 | Dev | S |
| **6.1** | Register Routes in App.tsx | 9 new routes added to `src/App.tsx` | All pages done | Dev | S |
| **6.2** | Update SideNav & BottomNav | `src/components/SideNav.tsx` · `src/components/BottomNav.tsx` | 6.1 | Dev | S |
| **6.3** | Integration with Existing Screens | Update `SiteDetails.tsx`, `SiteLists.tsx`, `OrgAdminDashboard.tsx` | 6.1 | Dev | M |
| **6.4** | Firestore Indexes | `firestore.indexes.json` (composite indexes for `siteTemplates` + `Sites`) | 1.2 | Dev | S |
| **7.1** | Reliability Score | `src/lib/reliabilityScore.ts` · progress bar in FormFill + SubmissionDetail | 4.2 | Dev | S |
| **7.2** | Coordinate Validation | `src/lib/coordinateSchemas.ts` (Zod schemas for LatLng + UTM) | 1.1 | Dev | S |
| **7.3** | Submission Detail Page | `src/pages/SubmissionDetail.tsx` (review, admin edit, PDF/CSV export) | 4.3, 5.3, 5.4, 7.1 | Dev | M |

**Complexity:** S = Small < 1 day · M = Medium 1–2 days · L = Large 2–4 days

---

### Recommended Build Order

```
1.1 → 1.2 → 1.3 → 1.4 → 1.5 ✅  (Foundation + PDF pipeline — COMPLETE)
                        ↓
                      4.2          (DynamicFormRenderer — build next, unblocks Phase 2 + 4)
                        ↓
             2.1 → 2.2 → 2.3 → 2.4 → 2.5   (Admin template UI)
             3.1 → 3.2 → 3.4 → 3.3          (Site management + assignment)
             4.1 → 4.3 → 4.4 → 4.5          (Consultant form filling)
             5.3 → 5.4 → 5.5                 (Remaining backend: PDF export, CSV, email)
             6.1 → 6.2 → 6.3 → 6.4          (Routing + integration)
             7.1 → 7.2 → 7.3                 (Validation + submission review)
```

---

## Firestore Collection Structure

New collections follow the existing top-level pattern. The existing `Sites` collection is extended
(not replaced). Submissions are a subcollection of `Sites`.

```
/siteTemplates/{templateId}               ← NEW top-level collection
/siteTemplates/{templateId}/fields/{fieldId}     ← subcollection
/siteTemplates/{templateId}/sections/{sectionId} ← subcollection

/Sites/{siteId}                           ← EXISTING — extended with 3 new fields:
                                              linkedTemplateId, assignedConsultantId,
                                              assignedConsultantEmail, submissionStatus
/Sites/{siteId}/submissions/{submissionId}       ← NEW subcollection under existing Sites

/users/{userId}                           ← EXISTING — unchanged
/organizations/{orgId}                    ← EXISTING — unchanged
```

---

## PHASE 1 — TypeScript Types, Firestore Rules & Seed Data

### Task 1.1 — TypeScript Interfaces

**File:** `src/types/siteTemplates.ts`

```typescript
import { Timestamp } from 'firebase/firestore';

export type FieldType =
  | 'text' | 'textarea' | 'number' | 'date'
  | 'select' | 'multiselect' | 'radio' | 'checkbox'
  | 'coordinates_latlong' | 'coordinates_utm'
  | 'file_upload' | 'repeating_group'
  | 'section_header' | 'divider';

export type ConditionalAction = 'show' | 'hide' | 'require';

export interface ConditionalRule {
  triggerFieldId: string;
  triggerValue: string | boolean | string[];
  action: ConditionalAction;
}

export interface TemplateField {
  id: string;
  sectionId: string;
  label: string;
  fieldType: FieldType;
  order: number;
  isRequired: boolean;
  isHidden: boolean;
  isProtected: boolean;        // hidden from MEMBER role entirely
  defaultValue?: unknown;
  options?: string[];          // for select/multiselect/radio/checkbox
  conditionalLogic?: ConditionalRule;
  placeholder?: string;
  helpText?: string;
  groupFields?: Omit<TemplateField, 'groupFields'>[];  // for repeating_group
}

export interface TemplateSection {
  id: string;
  title: string;
  order: number;
  isCollapsible: boolean;
  isProtected: boolean;        // e.g. "Office of State Archaeology Use"
}

export type TemplateSourceType = 'pdf_digitized' | 'customized' | 'blank_canvas';
export type TemplateStatus = 'draft' | 'published';

export interface SiteTemplate {
  id: string;
  orgId: string;
  name: string;
  siteType: string;
  sourceType: TemplateSourceType;
  status: TemplateStatus;
  sourcePdfStoragePath?: string;
  createdBy: string;           // Firebase Auth UID
  createdAt: Timestamp;
  updatedAt: Timestamp;
  fieldCount: number;          // denormalized for list views
}
```

**File:** `src/types/siteSubmissions.ts`

```typescript
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
```

> **Note:** The existing `Site` type in `src/services/sites.ts` gains 4 new fields:
> `linkedTemplateId?: string`, `assignedConsultantId?: string`,
> `assignedConsultantEmail?: string`, `submissionStatus?: SubmissionStatus`

---

### Task 1.2 — Update Firestore Security Rules

**File:** `firestore.rules`

Add the following blocks **before** the catch-all deny rule at the bottom. Uses existing helper
functions (`isSuperAdmin()`, `isOrgAdmin()`, `isAnyAdmin()`, `belongsToOrg()`, `canAccessOrg()`,
`getUserData()`) — no new helper functions needed.

```
// ========================================================================
// SITE TEMPLATES — ORG_ADMIN manages, MEMBER reads published only
// ========================================================================

match /siteTemplates/{templateId} {
  // ORG_ADMIN (or SUPER_ADMIN) in the same org can read all; MEMBER reads published
  allow read: if canAccessOrg(resource.data.orgId)
               && (isAnyAdmin() || resource.data.status == 'published');
  // Only ORG_ADMIN or SUPER_ADMIN can create/edit/delete
  allow create: if request.auth != null && isAnyAdmin()
                && request.resource.data.orgId == getUserData().organizationId;
  allow update, delete: if request.auth != null && isAnyAdmin()
                && resource.data.orgId == getUserData().organizationId;

  match /fields/{fieldId} {
    allow read: if canAccessOrg(get(/databases/$(database)/documents/siteTemplates/$(templateId)).data.orgId);
    allow write: if request.auth != null && isAnyAdmin();
  }
  match /sections/{sectionId} {
    allow read: if canAccessOrg(get(/databases/$(database)/documents/siteTemplates/$(templateId)).data.orgId);
    allow write: if request.auth != null && isAnyAdmin();
  }
}

// ========================================================================
// SITE SUBMISSIONS — subcollection of existing Sites collection
// ========================================================================

match /Sites/{siteId}/submissions/{submissionId} {
  // ORG_ADMIN reads all submissions for their org's sites
  // MEMBER reads only their own submission
  allow read: if request.auth != null
               && (isAnyAdmin()
                   || (getUserData().role == 'MEMBER'
                       && resource.data.consultantId == request.auth.uid));
  // Only the assigned MEMBER consultant can create a submission
  allow create: if request.auth != null
                 && getUserData().role == 'MEMBER'
                 && request.resource.data.consultantId == request.auth.uid;
  // MEMBER can update only their own draft; ORG_ADMIN can update any (for protected fields)
  allow update: if request.auth != null
                 && (isAnyAdmin()
                     || (getUserData().role == 'MEMBER'
                         && resource.data.consultantId == request.auth.uid
                         && resource.data.isDraft == true));
}
```

---

### Task 1.3 — Update Firebase Storage Rules

**File:** `storage.rules`

Add to the existing rules file:

```
match /orgs/{orgId}/templates/{allPaths=**} {
  allow read, write: if request.auth != null
                      && request.auth.token != null
                      && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.organizationId == orgId
                      && (get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'ORG_ADMIN'
                          || get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'SUPER_ADMIN');
}
match /orgs/{orgId}/sites/{siteId}/submissions/{allPaths=**} {
  allow read, write: if request.auth != null
                      && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.organizationId == orgId;
}
```

---

### Task 1.4 — Firebase Service Layer (3 new files)

Follow the exact same pattern used in `src/services/sites.ts`, `src/services/artifacts.ts`, etc.

**File:** `src/services/siteTemplates.ts`

```typescript
// Functions to implement:
createTemplate(orgId: string, data: Omit<SiteTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<string>
getTemplate(templateId: string): Promise<SiteTemplate>
listTemplates(orgId: string): Promise<SiteTemplate[]>
updateTemplate(templateId: string, data: Partial<SiteTemplate>): Promise<void>
publishTemplate(templateId: string): Promise<void>   // sets status = 'published'
archiveTemplate(templateId: string): Promise<void>   // sets status = 'draft'
deleteTemplate(templateId: string): Promise<void>    // draft only

// Field + section subcollection helpers
getTemplateFields(templateId: string): Promise<TemplateField[]>
getTemplateSections(templateId: string): Promise<TemplateSection[]>
batchSaveFields(templateId: string, fields: TemplateField[]): Promise<void>
batchSaveSections(templateId: string, sections: TemplateSection[]): Promise<void>
```

**File:** `src/services/siteSubmissions.ts`

```typescript
createSubmission(siteId: string, data: Omit<SiteSubmission, 'id'>): Promise<string>
getSubmission(siteId: string, submissionId: string): Promise<SiteSubmission>
getSubmissionBySite(siteId: string): Promise<SiteSubmission | null>
updateSubmission(siteId: string, submissionId: string, data: Partial<SiteSubmission>): Promise<void>
submitForm(siteId: string, submissionId: string): Promise<void>
// Sets isDraft: false, status: 'submitted', submittedAt: serverTimestamp()
```

**File:** `src/services/siteAssignments.ts`  _(thin wrapper around Sites updates)_

```typescript
assignConsultant(siteId: string, consultantId: string, consultantEmail: string): Promise<void>
// Updates Sites/{siteId}: assignedConsultantId, assignedConsultantEmail, submissionStatus='assigned'
// Also calls POST /api/notify-consultant on the FastAPI backend

getMemberAssignments(consultantId: string, orgId: string): Promise<Site[]>
// Queries Sites where assignedConsultantId == consultantId && organizationId == orgId
```

---

### Task 1.5 — Dynamic PDF → Template Pipeline ✅

> **Decision (updated):** Single-step pipeline using **Claude Opus 4.6 via Anthropic API**.
> The base64 PDF is sent directly as a native `document` content block — Claude reads the full
> layout including checkboxes, radio buttons, tables, and multi-column forms in one call.
> No separate OCR or text-extraction step required.

#### Pipeline overview

```
User uploads PDF
  → FileReader (browser) converts to base64
    → POST /api/parse-pdf  { base64_pdf, file_name, org_id }
      → Claude Opus 4.6 (Anthropic API)
          → Reads PDF natively as a document block
          → Returns { templateName, siteType, sections[], fields[] } JSON
    → TemplateImportPDF.tsx renders review UI (editable table)
      → Admin corrects labels / types / toggles
        → SiteTemplatesService.createTemplate()
        → batchSaveSections() + batchSaveFields()
          → /templates/:id/edit
```

#### Files implemented

| File | Role |
|---|---|
| `api/index.py` | FastAPI app with CORS; mounts all routers under `/api` |
| `api/routers/pdf.py` | `POST /api/parse-pdf` endpoint — validates request, calls claude_parser, returns typed response |
| `api/services/claude_parser.py` | Sends base64 PDF to Claude Opus 4.6 as a native document block; returns structured `SiteTemplate` JSON; includes truncation repair helper |
| `src/services/pdfParser.ts` | `parsePdfTemplate(file, orgId)` — `FileReader` → base64 → fetch `/api/parse-pdf` → typed `ParsedTemplate` |
| `src/pages/TemplateImportPDF.tsx` | 3-step UI: **Upload** (drag-and-drop) → **Parsing** (skeleton) → **Review** (editable sections/fields table) → save |
| `requirements.txt` | `fastapi uvicorn openai anthropic python-multipart firebase-admin aiosmtplib python-dotenv reportlab` |
| `vercel.json` | `/api/(.*)` → `api/index.py` rewrite added before SPA catch-all |

#### Environment variables used (from root `.env`)

| Variable | Purpose |
|---|---|
| `CLAUDE_API_KEY` | Anthropic API key for Claude Opus 4.6 PDF extraction |

#### Claude Opus 4.6 call

```
POST https://api.anthropic.com/v1/messages
Model:      claude-opus-4-6
Max tokens: 16000
Content:    [ { type: "document", source: { type: "base64", media_type: "application/pdf", data: <base64> } },
              { type: "text", text: <PARSE_PROMPT> } ]
```

Claude is instructed to:
- Identify all sections top-to-bottom, marking `isProtected: true` for "Office Use Only" sections
- Map every input to the correct `FieldType` (text, textarea, radio, multiselect, coordinates_latlong, repeating_group, etc.)
- Wire `conditionalLogic` for fields that conditionally appear (e.g. "If Yes, explain")
- Return `groupFields[]` inside `repeating_group` fields (e.g. burial record rows)
- Output **only valid JSON** — no markdown, no explanation
- Extract **every single field** — no skipping, no placeholders

#### Review UI (TemplateImportPDF.tsx)

- Editable `label` (Input) per field
- `fieldType` Select dropdown (all 14 FieldType values)
- `isRequired` / `isProtected` Switches per field
- Add / delete fields per section
- Collapse / expand sections
- Template Name + Site Type editable at the top
- "Save as Draft" → `createTemplate()` + `batchSaveSections()` + `batchSaveFields()` → redirects to `/templates/:id/edit`

> **Note:** Tasks 5.1 (FastAPI App Setup) and 5.2 (PDF Parse Endpoint) were completed
> as part of this task. They are marked done in the All Tasks table.

---

## PHASE 2 — Admin: Template Management UI

### Task 2.1 — Templates List Page

**File:** `src/pages/TemplateList.tsx`
**Route:** `/templates` — wrapped in `<AdminRoute>` in `App.tsx`

- Query `siteTemplates` where `orgId == user.organizationId` ordered by `updatedAt desc`
  using `onSnapshot` (real-time) following the pattern in existing hooks
- Table columns: Name, Site Type, Source badge, Status badge, Field Count, Updated, Actions
- Actions: Edit, Duplicate (clone Firestore docs), Delete (draft only), Publish/Unpublish
- "New Template" button → `NewTemplateModal`
- Add "Templates" link to `SideNav.tsx` under the Admin collapsible section

### Task 2.2 — New Template Choice Modal

**Component:** `src/components/templates/NewTemplateModal.tsx`

Three cards with icons:
1. **Upload PDF** → navigate to `/templates/new/pdf`
2. **Edit Existing** → searchable list of published templates → duplicate + open editor
3. **Blank Canvas** → navigate to `/templates/new/blank`

### Task 2.3 — PDF Upload & Claude-Powered Parse

**Files:**
- `src/pages/TemplateImportPDF.tsx` — frontend upload UI
- `src/services/pdfParser.ts` — client that POSTs to FastAPI

**Route:** `/templates/new/pdf` — wrapped in `<AdminRoute>`

**Upload step (frontend):**
- Drag-and-drop or file picker → upload to Firebase Storage:
  `orgs/{orgId}/templates/tmp/{filename}`
- Show progress bar during upload using the existing Storage upload pattern

**Parse step (calls FastAPI backend):**
- After upload, call `POST http://localhost:8000/api/parse-pdf` with
  `{ base64_pdf, file_name, orgId }` JSON body
- Backend sends the PDF directly to **Claude Opus 4.6** (Anthropic API) as a native document block
- Returns `{ templateName, siteType, sections: TemplateSection[], fields: TemplateField[] }`

**Review step (frontend):**
- Side-by-side: PDF `<iframe>` + detected fields table
- Admin can click any field row to correct label, type, required status inline
- "Save as Draft" → `batchSaveFields()` + `batchSaveSections()` to Firestore subcollections

### Task 2.4 — Template Field Editor

**File:** `src/pages/TemplateEditor.tsx`
**Route:** `/templates/:templateId/edit` — wrapped in `<AdminRoute>`

**Two-panel layout:**
- **Left (60%):** Live preview using `DynamicFormRenderer` (Phase 4) in `preview` mode
  with `userRole="admin"` so protected sections are visible
- **Right (40%):** Property panel — appears on field click

**Property panel controls:**
- Label (text)
- Field Type (select, all `FieldType` values)
- Required toggle · Hidden toggle · Protected toggle
- Placeholder, Help Text
- Options editor (add/remove/reorder) — shown for select/multiselect/radio/checkbox
- Conditional Logic builder: pick trigger field → pick trigger value → pick action (show/hide/require)

**Section management:** Add section, drag to reorder (using `@dnd-kit/sortable`), collapse/expand

**Field management:**
- "+ Add Field" at bottom of each section
- Drag to reorder within section (using `@dnd-kit/sortable`)
- Click to edit in property panel
- Delete with confirmation dialog (shadcn `AlertDialog`)

**Save behavior:**
- Auto-save on property panel blur → `setDoc` to `siteTemplates/{id}/fields/{fieldId}`
- Manual "Save" button → `batchSaveFields()`
- "Publish" → `publishTemplate(templateId)`

### Task 2.5 — Blank Canvas Form Builder

**File:** `src/pages/TemplateBuilder.tsx`
**Route:** `/templates/new/blank` — wrapped in `<AdminRoute>`

- Same two-panel layout as Task 2.4 but starts empty
- Left sidebar: palette of draggable field types (click or drag to add to canvas)
- Pre-built archaeological module blocks (click to insert entire section):
  - "Environment & Condition Block" (elevation, soil, drainage, damage, threatened)
  - "Coordinates Block" (lat/long + UTM + datum radio)
  - "Damage Assessment Block"
- Template Name + Site Type inputs required before first save

---

## PHASE 3 — Admin: Site Management

### Task 3.1 — Sites List (Admin View with Form Status)

**File:** Update `src/pages/SiteLists.tsx` (existing) OR create
`src/pages/AdminSiteAssignments.tsx` (new)
**Route:** `/admin-assignments` — wrapped in `<AdminRoute>`

- Query existing `Sites` collection where `organizationId == user.organizationId`
- Table: Site ID, Name, Type, Template, Consultant, submissionStatus badge, Updated
- Filters: submissionStatus, assignedConsultantId dropdowns
- "Assign Form" action per row → `AssignForm` page

### Task 3.2 — Extend Site Creation / Detail

**File:** Update `src/pages/NewSite.tsx` (existing)

Add 3 new fields to the existing create form:
- **State Site Number** — text, `placeholder: "31-___"`
- **Site Type** — select (Cemetery, Habitation, Rock Art, etc.) — drives template suggestions
- **Template** — select, filtered by `siteType` from published templates in the org

Update `src/services/sites.ts` to persist `linkedTemplateId`, `siteType`, `stateSiteNumber`
on the `Sites` document.

In `src/pages/SiteDetails.tsx` (existing): show linked template name + "Change Template" button
(ORG_ADMIN only).

### Task 3.3 — Assign Form to Consultant

**File:** `src/pages/AssignForm.tsx`
**Route:** `/assign-form/:siteId` — wrapped in `<AdminRoute>`

- Shows site name + linked template name
- Consultant picker: query `users` where `organizationId == orgId && role == 'MEMBER'`
  (searchable dropdown)
- Submit → calls `siteAssignments.assignConsultant()` which updates the `Sites` doc
  and calls the FastAPI notify endpoint
- Uses existing `Sonner` toast for success/error feedback

### Task 3.4 — Consultant Picker Component

**File:** `src/components/templates/ConsultantPicker.tsx`

- Queries `users` where `organizationId == orgId` and `role == 'MEMBER'`
- shadcn `Command` + `Popover` for searchable dropdown (same pattern used elsewhere)

---

## PHASE 4 — Consultant: Mobile Form Filling

### Task 4.1 — My Assignments Page

**File:** `src/pages/MyAssignments.tsx`
**Route:** `/my-assignments` — wrapped in `<ProtectedRoute>`

- Query `Sites` where `assignedConsultantId == auth.uid` using `siteAssignments.getMemberAssignments()`
- Cards: Site Name, Template Name, `submissionStatus` badge, Last saved timestamp
- Tap card → navigate to `/form/:siteId`
- Badge counts at top: Pending · In Progress · Submitted
- Add "My Assignments" to `BottomNav.tsx` (MEMBER only) and `SideNav.tsx`

### Task 4.2 — Dynamic Form Renderer (Core Shared Component)

**File:** `src/components/DynamicFormRenderer.tsx`

This is the most critical shared component — used for both admin preview and consultant fill.

```typescript
interface DynamicFormRendererProps {
  sections: TemplateSection[];
  fields: TemplateField[];
  initialValues?: Record<string, unknown>;
  userRole: 'admin' | 'member';
  mode: 'fill' | 'preview';
  onSave?: (values: Record<string, unknown>) => Promise<void>;
  onSubmit?: (values: Record<string, unknown>) => Promise<void>;
}
```

**Role filtering (apply before render):**
- Filter out fields where `isProtected === true` when `userRole === 'member'`
- Filter out sections where `isProtected === true` when `userRole === 'member'`

**Field renderer components** — one file per type in `src/components/formFields/`:

| File | Handles fieldType(s) |
|---|---|
| `TextField.tsx` | text, textarea, number |
| `DateField.tsx` | date |
| `SelectField.tsx` | select |
| `MultiSelectField.tsx` | multiselect, checkbox |
| `RadioField.tsx` | radio |
| `CoordinatesLatLngField.tsx` | coordinates_latlong — two inputs + GPS button (`navigator.geolocation`) using existing Capacitor Geolocation plugin |
| `CoordinatesUTMField.tsx` | coordinates_utm — Zone + Easting + Northing + Datum radio |
| `FileUploadField.tsx` | file_upload — camera (`capture="environment"`) + gallery, local preview, Firebase Storage upload |
| `RepeatingGroupField.tsx` | repeating_group — add/remove/edit rows (burial table) |
| `SectionHeaderField.tsx` | section_header, divider |

**Conditional logic engine:**

**File:** `src/lib/conditionalLogic.ts`

```typescript
export function evaluateVisibility(
  fields: TemplateField[],
  values: Record<string, unknown>
): Record<string, boolean>   // fieldId → isVisible
```

- Called via `useMemo` on every form value change through React Hook Form `watch()`
- Renderer checks this map before rendering each field

### Task 4.3 — Form Fill Page

**File:** `src/pages/FormFill.tsx`
**Route:** `/form/:siteId` — wrapped in `<ProtectedRoute>`

1. Fetch site doc + load `siteTemplates/{linkedTemplateId}/fields` + `sections`
2. Fetch or create draft `Sites/{siteId}/submissions/` doc
3. Initialize React Hook Form with `submission.formData` as `defaultValues`
4. Render `DynamicFormRenderer` in `fill` mode with `userRole="member"`
5. **Auto-save:** debounced 2s after field change + `onBlur` → `updateSubmission()` with updated
   `formData` + `lastSavedAt: serverTimestamp()`
6. Show sync status: "Saving..." → "Saved [time]" in the top bar
7. Progress bar showing `% of required fields filled` (uses `calculateReliability()`)
8. **Submit button:** Zod validation of all required fields → shadcn `AlertDialog` confirmation
   → `submitForm()` sets `isDraft: false`, `status: 'submitted'`, `submittedAt: serverTimestamp()`

### Task 4.4 — Offline Support

**Strategy:** Firestore built-in offline persistence (already partially configured in
`src/lib/firebase.ts`) + `localforage` for pending media uploads.

**Fix in `src/lib/firebase.ts`:** Replace any deprecated `enableMultiTabIndexedDbPersistence`
call with the v12-compatible approach:

```typescript
// Replace old offline persistence init with:
import { initializeFirestore, persistentLocalCache } from 'firebase/firestore';
const db = initializeFirestore(app, {
  localCache: persistentLocalCache()
});
// Firestore automatically queues writes offline and syncs on reconnect
```

**File:** `src/components/OfflineStatusBanner.tsx`
- Detect online/offline: `window.addEventListener('online' | 'offline')`
- Show banner (shadcn `Alert`): "You are offline. Changes will sync automatically when connected."
- Use existing `useNetworkStatus` hook or Capacitor `Network` plugin already in the project

**Media offline queue:**
**File:** `src/lib/mediaQueue.ts`
- If offline when uploading photo: save blob to `localforage` with key `pending-upload-{uuid}`
- On reconnect: iterate pending keys, upload to Firebase Storage, update submission
  `mediaAttachments`, clear from `localforage`

### Task 4.5 — File Upload Field Detail

**Component:** `src/components/formFields/FileUploadField.tsx`

```
Upload flow:
1. User taps → native file picker with capture="environment" (uses Capacitor Camera on mobile)
2. Show local preview immediately via URL.createObjectURL()
3. Upload to Storage: orgs/{orgId}/sites/{siteId}/submissions/{submissionId}/{fieldId}/{filename}
4. On complete: get downloadURL → append MediaAttachment to submission.mediaAttachments
5. If offline: save file to localforage, upload on reconnect via mediaQueue
```

- Multiple files per field supported
- Progress bar per file (shadcn `Progress`)
- Delete: remove from Storage + update Firestore `mediaAttachments` array
- Max size: `import.meta.env.VITE_MAX_UPLOAD_MB` (default 20MB)

---

## PHASE 5 — FastAPI Backend (`api/`)

> **Vercel deployment:** Vercel serves the React frontend as a static site and the FastAPI
> backend as Python serverless functions from the `api/` directory. No separate server needed.
> The `backend/` directory name is replaced by `api/` to match Vercel's Python runtime convention.

### Task 5.1 — FastAPI App Setup

**Directory structure (all new):**

```
api/                        ← Vercel Python serverless root
  index.py                  # FastAPI app + router registration — Vercel entry point
  routers/
    pdf.py                  # POST /api/parse-pdf
    export.py               # GET /api/submissions/{id}/export-pdf
                            # GET /api/submissions/{id}/export-csv
    notify.py               # POST /api/notify-consultant
  services/
    claude_parser.py        # Claude Sonnet 4.6 via Azure AI Foundry
    fb_admin.py             # Firebase Admin SDK init (named fb_admin to avoid collision
                            # with the firebase_admin package)
    pdf_builder.py          # reportlab PDF export

requirements.txt            # ← PROJECT ROOT (not inside api/) — Vercel reads from here
vercel.json                 # ← PROJECT ROOT — routing + function config
```

**`api/index.py`** — FastAPI app Vercel reads to handle all `/api/*` requests:

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import pdf, export, notify
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ.get("VITE_APP_URL", "*")],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(pdf.router)
app.include_router(export.router)
app.include_router(notify.router)
```

**`vercel.json`** — routes all `/api/*` traffic to the FastAPI app:

```json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/index" }
  ],
  "functions": {
    "api/index.py": {
      "maxDuration": 60
    }
  }
}
```

> **Vercel plan note:** PDF parsing (pdfplumber + gpt-4o) can take 15–30 seconds.
> The **Pro plan** (300s max duration) is recommended. Hobby plan is capped at 60s.

**Local development** — update `package.json` `dev:backend` script:

```json
"dev:backend": "cd api && uvicorn index:app --reload --port 8000"
```

Add a local `api/.env` for secrets (git-ignored). In production, all secrets are set in the
**Vercel Environment Variables dashboard** — no `.env` file is deployed.

---

**Firebase Admin SDK init** — `api/services/fb_admin.py`

On Vercel the filesystem is read-only and ephemeral, so a service account key file cannot be
used. Instead, store the full service account JSON as a single environment variable
`FIREBASE_SERVICE_ACCOUNT_JSON` and parse it at runtime:

```python
import json, os, firebase_admin
from firebase_admin import credentials

_initialized = False

def get_firebase_app():
    global _initialized
    if not _initialized:
        cred_dict = json.loads(os.environ["FIREBASE_SERVICE_ACCOUNT_JSON"])
        cred = credentials.Certificate(cred_dict)
        firebase_admin.initialize_app(cred, {
            "storageBucket": os.environ["FIREBASE_STORAGE_BUCKET"]
        })
        _initialized = True
    return firebase_admin.get_app()
```

> To get `FIREBASE_SERVICE_ACCOUNT_JSON`: Firebase Console → Project Settings →
> Service Accounts → Generate new private key → copy the entire JSON content as one line
> and paste as the env var value in Vercel dashboard.

---

### Task 5.2 — PDF Parse Endpoint (gpt-4o)

**File:** `api/services/claude_parser.py`

```python
import anthropic, os, json

client = anthropic.Anthropic(
    base_url=os.environ["Azure_PROJECT_ENDPOINT"],
    api_key=os.environ["AZURE_PROJECT_API_KEY"],
)

SYSTEM_PROMPT = """You are an expert in NC archaeology site forms.
Extract all form fields from the provided PDF text and return structured JSON.
Map each field to one of: text, textarea, number, date, select, multiselect,
radio, checkbox, coordinates_latlong, coordinates_utm, file_upload,
repeating_group, section_header, divider.
Group fields into sections. Mark any section titled 'OFFICE OF STATE ARCHAEOLOGY'
as isProtected: true.
Return ONLY valid JSON with keys: sections (array), fields (array). No prose."""

def parse_pdf_to_template(pdf_text: str) -> dict:
    response = client.messages.create(
        model="claude-sonnet-4-6-20251001",
        max_tokens=4096,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": pdf_text}],
    )
    return json.loads(response.content[0].text)
```

**File:** `api/routers/pdf.py`

```python
# POST /api/parse-pdf
# Body: { "storagePath": "orgs/.../templates/tmp/form.pdf", "orgId": "..." }
# 1. Download PDF bytes from Firebase Storage via Admin SDK
# 2. Extract text with pdfplumber
# 3. Call claude_parser.parse_pdf_to_template(text)
# 4. Return { sections: [...], fields: [...] }
```

### Task 5.3 — PDF Export Endpoint

**File:** `api/routers/export.py` + `api/services/pdf_builder.py`

```python
# GET /api/submissions/{submissionId}/export-pdf
# 1. Fetch SiteSubmission + SiteTemplate from Firestore via Admin SDK
# 2. Use reportlab to render a styled PDF matching NC Cemetery form layout
# 3. Protected sections (isProtected: true) included only if caller is ORG_ADMIN
# 4. Stream PDF bytes in response with Content-Disposition: attachment
```

### Task 5.4 — CSV Export Endpoint

**File:** `api/routers/export.py`

```python
# GET /api/submissions/{submissionId}/export-csv
# Serializes repeating_group field (burial table) rows to CSV
# Returns Content-Disposition: attachment; filename="burials.csv"
```

### Task 5.5 — Consultant Notification Endpoint

**File:** `api/routers/notify.py`

```python
# POST /api/notify-consultant
# Body: { consultantEmail, consultantName, siteName, siteId, orgId }
# Sends email via aiosmtplib using SMTP_* env vars
# Email body includes deep link: {APP_URL}/#/form/{siteId}
```

---

## PHASE 6 — Routing, Navigation & ArchePal Integration

### Task 6.1 — Register New Routes in App.tsx

**File:** `src/App.tsx`

Add these imports and `<Route>` entries:

```typescript
// New imports
import TemplateList from './pages/TemplateList';
import TemplateImportPDF from './pages/TemplateImportPDF';
import TemplateBuilder from './pages/TemplateBuilder';
import TemplateEditor from './pages/TemplateEditor';
import AdminSiteAssignments from './pages/AdminSiteAssignments';
import AssignForm from './pages/AssignForm';
import MyAssignments from './pages/MyAssignments';
import FormFill from './pages/FormFill';
import SubmissionDetail from './pages/SubmissionDetail';

// New routes — add above the "*" catch-all:
<Route path="/templates" element={<AdminRoute><TemplateList /></AdminRoute>} />
<Route path="/templates/new/pdf" element={<AdminRoute><TemplateImportPDF /></AdminRoute>} />
<Route path="/templates/new/blank" element={<AdminRoute><TemplateBuilder /></AdminRoute>} />
<Route path="/templates/:templateId/edit" element={<AdminRoute><TemplateEditor /></AdminRoute>} />
<Route path="/admin-assignments" element={<AdminRoute><AdminSiteAssignments /></AdminRoute>} />
<Route path="/assign-form/:siteId" element={<AdminRoute><AssignForm /></AdminRoute>} />
<Route path="/my-assignments" element={<ProtectedRoute><MyAssignments /></ProtectedRoute>} />
<Route path="/form/:siteId" element={<ProtectedRoute><FormFill /></ProtectedRoute>} />
<Route path="/submission/:siteId/:submissionId" element={<ProtectedRoute><SubmissionDetail /></ProtectedRoute>} />
```

### Task 6.2 — Update SideNav and BottomNav

**File:** `src/components/SideNav.tsx`

Under the existing Admin collapsible section, add:
- "Templates" → `/templates` (ORG_ADMIN only)
- "Site Assignments" → `/admin-assignments` (ORG_ADMIN only)

Under Account section or a new "My Work" section, add:
- "My Assignments" → `/my-assignments` (MEMBER only, hide for ORG_ADMIN)

**File:** `src/components/BottomNav.tsx`

Add a "Assignments" tab for MEMBER role (shown/hidden based on `isMember` from `useUser()`).

### Task 6.3 — Integration with Existing Screens

- **Site Detail (`/site/:id`):** Show "Assign Form" button (ORG_ADMIN + `linkedTemplateId` set)
  and "Fill Form" CTA (MEMBER + `assignedConsultantId == auth.uid`)
- **Sites list (`/site-lists`):** Show "Form Pending" badge on sites with
  `submissionStatus: 'assigned' | 'in_progress'`
- **Org Admin Dashboard (`/org-dashboard`):** Add "Assignments" tab showing the same
  data as `/admin-assignments`

### Task 6.4 — Firestore Composite Indexes

**File:** `firestore.indexes.json`

```json
{
  "indexes": [
    {
      "collectionGroup": "siteTemplates",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "orgId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "updatedAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "Sites",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "organizationId", "order": "ASCENDING" },
        { "fieldPath": "assignedConsultantId", "order": "ASCENDING" },
        { "fieldPath": "updatedAt", "order": "DESCENDING" }
      ]
    }
  ]
}
```

---

## PHASE 7 — Validation & Reliability

### Task 7.1 — Form Completion / Reliability Score

**File:** `src/lib/reliabilityScore.ts`

```typescript
export function calculateReliability(
  fields: TemplateField[],
  formData: Record<string, unknown>
): { score: number; reliability: 'Complete' | 'Incomplete' | 'Unreliable' } {
  // score = filled required fields / total required fields
  // Complete: 100% | Incomplete: 50–99% | Unreliable: < 50%
}
```

Display as a `shadcn Progress` bar on:
- `FormFill.tsx` — live while filling
- `SubmissionDetail.tsx` — admin review
- `AdminSiteAssignments.tsx` — assignments table column

### Task 7.2 — Coordinate Validation (Zod)

**File:** `src/lib/coordinateSchemas.ts`

```typescript
export const LatLngSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const UTMSchema = z.object({
  datum: z.enum(['NAD27', 'NAD83']),
  zone: z.number().int().min(1).max(60),
  easting: z.number().min(100000).max(999999),
  northing: z.number().min(0).max(10000000),
});
```

Used inside `CoordinatesLatLngField.tsx` and `CoordinatesUTMField.tsx`.

### Task 7.3 — Submission Detail / Review Page

**File:** `src/pages/SubmissionDetail.tsx`
**Route:** `/submission/:siteId/:submissionId` — wrapped in `<ProtectedRoute>`

- Read-only view of all submitted fields grouped by section
- Protected section visible only when `isOrgAdmin`
- Media attachment thumbnails with lightbox
- ORG_ADMIN: editable protected fields (National Register Status, reliability) → saves back via `updateSubmission()`
- "Export PDF" button → `GET /api/submissions/{id}/export-pdf`
- "Export CSV" button (burial table) → `GET /api/submissions/{id}/export-csv`
- Reliability score bar

---

## PHASE 8 — Environment Variables

### Frontend — `.env` (existing file, append these lines)

```bash
# App URL — used in email deep links and CORS config
VITE_APP_URL=https://your-app.vercel.app   # update to real Vercel URL after first deploy

# Max upload size for file attachment fields
VITE_MAX_UPLOAD_MB=20
```

> `LLM_WHISPERER_API_KEY` is backend-only (no `VITE_` prefix) — never expose to the browser.

---

### Backend — Vercel Environment Variables Dashboard

All backend secrets are set in **Vercel Project → Settings → Environment Variables**.
No `backend/.env` or `api/.env` file is committed or deployed.

| Variable | Where to get it |
|---|---|
| `LLM_WHISPERER_API_KEY` | Unstract LLMWhisperer dashboard → API Keys |
| `LLMWHISPERER_BASE_URL_V2` | Optional — defaults to US-central region endpoint |
| `VITE_AZURE_OPENAI_ENDPOINT` | Azure AI Foundry project → Endpoints |
| `VITE_AZURE_OPENAI_API_KEY` | Azure AI Foundry project → Keys |
| `VITE_AZURE_OPENAI_DEPLOYMENT_NAME` | GPT-4o deployment name (e.g. `gpt-4o`) |
| `VITE_AZURE_OPENAI_API_VERSION` | e.g. `2024-02-15-preview` |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Firebase Console → Project Settings → Service Accounts → Generate new private key → paste full JSON as one line |
| `FIREBASE_STORAGE_BUCKET` | Firebase Console → Storage → copy the bucket name (e.g. `your-app.firebasestorage.app`) |
| `SMTP_HOST` | Your email provider (e.g. `smtp.sendgrid.net`) |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | SMTP username / API key |
| `SMTP_PASS` | SMTP password |
| `EMAIL_FROM` | `noreply@archepal.com` |
| `APP_URL` | `https://myarchepal.vercel.app/` (same as `VITE_APP_URL`) |

---

### Local Development — `api/.env` (git-ignored)

For running `npm run dev:backend` locally, create `api/.env` (never commit this file):

```bash
Azure_PROJECT_ENDPOINT=
AZURE_PROJECT_API_KEY=
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"..."}
FIREBASE_STORAGE_BUCKET=your-app.firebasestorage.app
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=noreply@archepal.com
APP_URL=http://localhost:8080
```

Add `api/.env` to `.gitignore`.

---

## Implementation Order

```
Phase 1  →  Types + Firestore rules + seed script              ← Start here
Phase 4  →  DynamicFormRenderer + field components             ← Core shared component, unblocks both admin + consultant
Phase 2  →  Template list + PDF upload UI + field editor       ← Validates data model with real UI
Phase 5  →  FastAPI backend (setup + Claude parse + export)    ← Can run in parallel with Phase 2
Phase 3  →  Site assignment UI + consultant picker
Phase 4  →  Form fill + offline support + file uploads         ← Consultant experience
Phase 6  →  Route registration + nav updates + integration
Phase 7  →  Reliability scoring + coordinate validation + submission detail
Phase 8  →  Env vars + Firestore indexes                       ← Configure before deploy
```

**Start with these 3 tasks in sequence:**
1. **Task 1.1** — TypeScript interfaces (all other tasks import from these)
2. **Task 1.5** — Seed script (validates schema against the real NC Cemetery form before building UI)
3. **Task 4.2** — `DynamicFormRenderer` (shared by admin preview + consultant fill, unblocks both phases simultaneously)

---

## npm Packages to Install (Frontend)

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities  # drag-and-drop field reordering
npm install localforage                                          # offline media queue
```

> All other packages (`firebase`, `react-hook-form`, `zod`, `@hookform/resolvers`, shadcn/ui
> components, `lucide-react`) are already installed in the project.

## pip Packages to Install (Backend)

Add to `requirements.txt` at the **project root**:

```
fastapi
uvicorn
pdfplumber
anthropic
python-multipart
firebase-admin
aiosmtplib
python-dotenv
reportlab
```

> `requirements.txt` must be at the project root — Vercel reads it from there for Python
> serverless functions. Do **not** put it inside `api/`.

---

## Resolved Decisions

| # | Decision | Resolution |
|---|---|---|
| 1 | PDF parsing approach | Claude Sonnet 4.6 via Azure AI Foundry (`Azure_PROJECT_ENDPOINT` + `AZURE_PROJECT_API_KEY`) in FastAPI backend |
| 2 | Drag-and-drop library | `@dnd-kit/sortable` — actively maintained, accessible, React 18 compatible |
| 3 | Offline conflict handling | Last-write-wins (Firestore built-in + `lastSavedAt` timestamp) |
| 4 | Template versioning | Freeze: `templateId` + `fieldCount` snapshot stored on submission at creation time |
| 5 | Consultant role | Use existing `MEMBER` role — no new role needed |
| 6 | Sites collection | Extend existing top-level `Sites` collection with 4 new fields; submissions in `Sites/{siteId}/submissions/` subcollection |

---

*ArchePal — FIRST LEGO League COMMUNICATE Challenge*
*Stack: React 18 · Vite · TypeScript · Firebase · FastAPI · Claude Sonnet 4.6 · Capacitor*
