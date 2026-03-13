/**
 * Seed Script: Default General Archaeological Survey Template
 *
 * Creates a system-wide default form template with 20 fields across 4 sections.
 * This template has orgId: 'SYSTEM' and isSystemTemplate: true — it cannot be deleted.
 * It is available to all organizations out-of-the-box when creating a new site.
 *
 * Setup:
 *   1. Go to Firebase Console → Project Settings → Service Accounts
 *   2. Click "Generate new private key" → Download JSON file
 *   3. Save it as: scripts/serviceAccountKey.json
 *
 * Run:
 *   node scripts/seed-default-template.js
 *   node scripts/seed-default-template.js --dry-run
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TEMPLATE_DOC_ID = 'default-archaeological-survey';

// ─── Firebase Admin Init ────────────────────────────────────────────────────

try {
  const serviceAccountPath = join(__dirname, 'serviceAccountKey.json');
  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  console.log('✅ Firebase Admin initialized');
} catch (error) {
  console.error('❌ Failed to initialize Firebase Admin');
  console.error('   Make sure scripts/serviceAccountKey.json exists');
  console.error('   Error:', error.message);
  process.exit(1);
}

const db = admin.firestore();
const now = admin.firestore.FieldValue.serverTimestamp();
const DRY_RUN = process.argv.includes('--dry-run');

// ─── Template Definition ────────────────────────────────────────────────────

const SECTIONS = [
  {
    id: 'sec_identification',
    title: 'Site Identification',
    order: 0,
    isCollapsible: false,
    isProtected: false,
  },
  {
    id: 'sec_location',
    title: 'Location & Setting',
    order: 1,
    isCollapsible: false,
    isProtected: false,
  },
  {
    id: 'sec_description',
    title: 'Site Description & Features',
    order: 2,
    isCollapsible: false,
    isProtected: false,
  },
  {
    id: 'sec_survey',
    title: 'Survey Information',
    order: 3,
    isCollapsible: false,
    isProtected: false,
  },
];

const FIELDS = [
  // ── Section 1: Site Identification ────────────────────────────────────────
  {
    id: 'fld_state_site_number',
    sectionId: 'sec_identification',
    label: 'State Site Number',
    fieldType: 'text',
    order: 0,
    isRequired: false,
    isHidden: false,
    isProtected: false,
    placeholder: 'e.g. 31BK123',
    helpText: 'Official number assigned by the Office of State Archaeology.',
  },
  {
    id: 'fld_site_name_official',
    sectionId: 'sec_identification',
    label: 'Official Site Name',
    fieldType: 'text',
    order: 1,
    isRequired: true,
    isHidden: false,
    isProtected: false,
    placeholder: 'e.g. Crowders Mountain Rockshelter',
  },
  {
    id: 'fld_site_type',
    sectionId: 'sec_identification',
    label: 'Site Type',
    fieldType: 'select',
    order: 2,
    isRequired: true,
    isHidden: false,
    isProtected: false,
    options: [
      'Prehistoric',
      'Historic',
      'Cemetery',
      'Shell Midden',
      'Rock Art',
      'Lithic Scatter',
      'Mound / Earthwork',
      'Habitation / Village',
      'Industrial / Mill Site',
      'Other',
    ],
  },
  {
    id: 'fld_county',
    sectionId: 'sec_identification',
    label: 'County',
    fieldType: 'text',
    order: 3,
    isRequired: true,
    isHidden: false,
    isProtected: false,
    placeholder: 'e.g. Mecklenburg',
  },
  // ── Section 2: Location & Setting ─────────────────────────────────────────
  {
    id: 'fld_gps_coordinates',
    sectionId: 'sec_location',
    label: 'GPS Coordinates',
    fieldType: 'coordinates_latlong',
    order: 5,
    isRequired: false,
    isHidden: false,
    isProtected: false,
    helpText: 'Decimal degrees (WGS 84). Use device GPS or enter manually.',
  },
  {
    id: 'fld_elevation_ft',
    sectionId: 'sec_location',
    label: 'Elevation (ft)',
    fieldType: 'number',
    order: 6,
    isRequired: false,
    isHidden: false,
    isProtected: false,
    placeholder: 'e.g. 720',
  },
  {
    id: 'fld_landform_type',
    sectionId: 'sec_location',
    label: 'Landform / Topographic Setting',
    fieldType: 'select',
    order: 7,
    isRequired: false,
    isHidden: false,
    isProtected: false,
    options: [
      'Floodplain',
      'River / Stream Terrace',
      'Upland Terrace',
      'Hilltop / Ridgeline',
      'Slope / Bluff',
      'Swamp / Wetland',
      'Coastal Plain',
      'Other',
    ],
  },
  {
    id: 'fld_soil_type',
    sectionId: 'sec_location',
    label: 'Soil Type / Description',
    fieldType: 'text',
    order: 8,
    isRequired: false,
    isHidden: false,
    isProtected: false,
    placeholder: 'e.g. Sandy loam, dark brown midden matrix',
  },
  {
    id: 'fld_vegetation',
    sectionId: 'sec_location',
    label: 'Vegetation Cover',
    fieldType: 'text',
    order: 9,
    isRequired: false,
    isHidden: false,
    isProtected: false,
    placeholder: 'e.g. Mixed hardwood forest, open pasture',
  },

  // ── Section 3: Site Description & Features ────────────────────────────────
  {
    id: 'fld_site_description',
    sectionId: 'sec_description',
    label: 'Site Description',
    fieldType: 'textarea',
    order: 10,
    isRequired: true,
    isHidden: false,
    isProtected: false,
    placeholder: 'Describe the site — boundaries, features, surface observations…',
    helpText: 'Include all visible cultural features, disturbances, and site boundaries.',
  },
  {
    id: 'fld_dimensions_length_m',
    sectionId: 'sec_description',
    label: 'Site Length (m)',
    fieldType: 'number',
    order: 11,
    isRequired: false,
    isHidden: false,
    isProtected: false,
    placeholder: 'e.g. 150',
  },
  {
    id: 'fld_dimensions_width_m',
    sectionId: 'sec_description',
    label: 'Site Width (m)',
    fieldType: 'number',
    order: 12,
    isRequired: false,
    isHidden: false,
    isProtected: false,
    placeholder: 'e.g. 80',
  },
  {
    id: 'fld_cultural_affiliation',
    sectionId: 'sec_description',
    label: 'Cultural Affiliation',
    fieldType: 'multiselect',
    order: 13,
    isRequired: false,
    isHidden: false,
    isProtected: false,
    options: [
      'Paleoindian',
      'Early Archaic',
      'Middle Archaic',
      'Late Archaic',
      'Early Woodland',
      'Middle Woodland',
      'Late Woodland',
      'Mississippian',
      'Contact Period',
      'Historic Native American',
      'Euro-American Historic',
      'Unknown',
    ],
  },
  {
    id: 'fld_estimated_date_range',
    sectionId: 'sec_description',
    label: 'Estimated Date Range',
    fieldType: 'text',
    order: 14,
    isRequired: false,
    isHidden: false,
    isProtected: false,
    placeholder: 'e.g. 1000–1400 AD or 8000–6000 BCE',
  },
  {
    id: 'fld_artifact_types',
    sectionId: 'sec_description',
    label: 'Artifact Types Observed',
    fieldType: 'multiselect',
    order: 15,
    isRequired: false,
    isHidden: false,
    isProtected: false,
    options: [
      'Ceramics / Pottery',
      'Chipped Stone / Lithics',
      'Ground Stone',
      'Faunal Remains (bone, shell)',
      'Floral Remains (seeds, charcoal)',
      'Metal / Iron',
      'Glass',
      'Brick / Mortar',
      'Human Remains',
      'None Observed',
    ],
  },

  // ── Section 4: Survey Information ─────────────────────────────────────────
  {
    id: 'fld_survey_date',
    sectionId: 'sec_survey',
    label: 'Survey Date',
    fieldType: 'date',
    order: 16,
    isRequired: true,
    isHidden: false,
    isProtected: false,
  },
  {
    id: 'fld_surveyor_name',
    sectionId: 'sec_survey',
    label: 'Surveyor Name',
    fieldType: 'text',
    order: 17,
    isRequired: true,
    isHidden: false,
    isProtected: false,
    placeholder: 'Full name of lead surveyor',
  },
  {
    id: 'fld_survey_method',
    sectionId: 'sec_survey',
    label: 'Survey Method',
    fieldType: 'select',
    order: 18,
    isRequired: false,
    isHidden: false,
    isProtected: false,
    options: [
      'Pedestrian Surface Survey',
      'Shovel Testing',
      'Backhoe / Machine Trenching',
      'Systematic Excavation',
      'Remote Sensing (LiDAR, GPR, etc.)',
      'Archival / Documentary Research',
      'Other',
    ],
  },
  {
    id: 'fld_site_condition',
    sectionId: 'sec_survey',
    label: 'Site Condition / Integrity',
    fieldType: 'radio',
    order: 19,
    isRequired: false,
    isHidden: false,
    isProtected: false,
    options: [
      'Excellent — Largely intact, minimal disturbance',
      'Good — Minor disturbance, integrity preserved',
      'Fair — Moderate disturbance, partial integrity',
      'Poor — Heavy disturbance, limited integrity',
      'Destroyed / Heavily Disturbed',
    ],
  },
  {
    id: 'fld_field_notes',
    sectionId: 'sec_survey',
    label: 'Field Notes / Additional Comments',
    fieldType: 'textarea',
    order: 20,
    isRequired: false,
    isHidden: false,
    isProtected: false,
    placeholder: 'Any additional observations, recommendations, or follow-up actions…',
  },
];

// ─── Seed Function ───────────────────────────────────────────────────────────

async function seedDefaultTemplate() {
  console.log('\n🌱 Seeding default archaeological survey template…');
  console.log(`   Doc ID : ${TEMPLATE_DOC_ID}`);
  console.log(`   Fields : ${FIELDS.length}`);
  console.log(`   Sections: ${SECTIONS.length}`);
  if (DRY_RUN) console.log('\n⚠️  DRY RUN — no writes will be made\n');

  const templateRef = db.collection('siteTemplates').doc(TEMPLATE_DOC_ID);
  const existing = await templateRef.get();

  if (existing.exists) {
    console.log('\n⏭️  Template already exists — skipping. To re-seed, delete the document first:');
    console.log(`   Firebase Console → Firestore → siteTemplates → ${TEMPLATE_DOC_ID}\n`);
    return;
  }

  const templateData = {
    orgId: 'SYSTEM',
    name: 'General Archaeological Survey',
    siteType: 'General',
    sourceType: 'blank_canvas',
    status: 'published',
    createdBy: 'system',
    createdAt: now,
    updatedAt: now,
    fieldCount: FIELDS.length,
    isSystemTemplate: true,
  };

  if (DRY_RUN) {
    console.log('Template document:');
    console.log(JSON.stringify({ id: TEMPLATE_DOC_ID, ...templateData }, null, 2));
    console.log(`\n${SECTIONS.length} sections and ${FIELDS.length} fields would be created.\n`);
    return;
  }

  // Write template document
  await templateRef.set(templateData);
  console.log('   ✅ Created template document');

  // Write sections (batch)
  const sectionsBatch = db.batch();
  const sectionsCol = templateRef.collection('sections');
  for (const section of SECTIONS) {
    const { id, ...data } = section;
    sectionsBatch.set(sectionsCol.doc(id), data);
  }
  await sectionsBatch.commit();
  console.log(`   ✅ Created ${SECTIONS.length} sections`);

  // Write fields (batch — Firestore limit is 500 writes/batch, 20 is safe)
  const fieldsBatch = db.batch();
  const fieldsCol = templateRef.collection('fields');
  for (const field of FIELDS) {
    const { id, ...data } = field;
    fieldsBatch.set(fieldsCol.doc(id), data);
  }
  await fieldsBatch.commit();
  console.log(`   ✅ Created ${FIELDS.length} fields`);

  console.log('\n✅ Default template seeded successfully!\n');
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═'.repeat(60));
  console.log('  SEED: DEFAULT ARCHAEOLOGICAL SURVEY TEMPLATE');
  console.log('═'.repeat(60));

  try {
    await seedDefaultTemplate();
  } catch (error) {
    console.error('\n❌ Seeding failed:', error);
    process.exit(1);
  }
}

main().then(() => process.exit(0));
