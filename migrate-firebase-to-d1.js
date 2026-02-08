/**
 * Firebase to Cloudflare D1 Migration Script
 * 
 * This script helps migrate existing valentine data from Firebase
 * Realtime Database to Cloudflare D1.
 * 
 * ============================================================================
 * HOW TO USE
 * ============================================================================
 * 
 * Step 1: Export Firebase data
 *   - Go to Firebase Console -> Realtime Database
 *   - Click the three dots menu (⋮) at the top of the data tree
 *   - Select "Export JSON"
 *   - Save as "firebase-export.json" in this directory
 * 
 * Step 2: Run this script to generate SQL
 *   node migrate-firebase-to-d1.js
 * 
 * Step 3: Execute the generated SQL in Cloudflare D1
 *   - Go to Cloudflare Dashboard -> D1 -> valentine-db -> Console
 *   - Copy and paste the SQL from "d1-import.sql" 
 *   - Execute it (you may need to run in batches if there are many records)
 * 
 * OR use Wrangler CLI:
 *   npx wrangler d1 execute valentine-db --file=d1-import.sql
 */

const fs = require('fs');
const path = require('path');

const EXPORT_FILE = path.join(__dirname, 'firebase-export.json');
const OUTPUT_FILE = path.join(__dirname, 'd1-import.sql');

function escapeSQL(str) {
    if (str === null || str === undefined) return 'NULL';
    return "'" + String(str).replace(/'/g, "''") + "'";
}

function main() {
    // Check if export file exists
    if (!fs.existsSync(EXPORT_FILE)) {
        console.log('');
        console.log('firebase-export.json not found!');
        console.log('');
        console.log('To export your Firebase data:');
        console.log('1. Go to Firebase Console -> Realtime Database');
        console.log('2. Click the three dots menu at the top of the data tree');
        console.log('3. Select "Export JSON"');
        console.log('4. Save as "firebase-export.json" in this directory');
        console.log('');
        process.exit(1);
    }

    console.log('Reading Firebase export...');
    const data = JSON.parse(fs.readFileSync(EXPORT_FILE, 'utf8'));

    // Firebase structure: { valentines: { trackingId: { ... }, ... } }
    const valentines = data.valentines || data;
    const entries = Object.entries(valentines);

    console.log(`Found ${entries.length} entries to migrate.`);

    let sql = '-- Firebase to D1 Migration\n';
    sql += '-- Generated: ' + new Date().toISOString() + '\n';
    sql += '-- Total entries: ' + entries.length + '\n\n';

    let valentineCount = 0;
    let ecardCount = 0;

    for (const [id, entry] of entries) {
        if (!entry || typeof entry !== 'object') continue;

        // Detect if this is an e-card (has 'from' and 'to' fields) or a valentine (has 'senderName')
        if (entry.from && entry.to) {
            // E-card entry
            ecardCount++;
            sql += `INSERT OR IGNORE INTO ecards (ecard_id, from_name, to_name, theme, message, created_at, viewed, responded, responded_at) VALUES (\n`;
            sql += `  ${escapeSQL(id)},\n`;
            sql += `  ${escapeSQL(entry.from)},\n`;
            sql += `  ${escapeSQL(entry.to)},\n`;
            sql += `  ${escapeSQL(entry.theme || 'classic')},\n`;
            sql += `  ${escapeSQL(entry.message || '')},\n`;
            sql += `  ${entry.createdAt ? (typeof entry.createdAt === 'string' ? new Date(entry.createdAt).getTime() : entry.createdAt) : Date.now()},\n`;
            sql += `  ${entry.viewed ? 1 : 0},\n`;
            sql += `  ${entry.responded ? 1 : 0},\n`;
            sql += `  ${entry.respondedAt ? (typeof entry.respondedAt === 'string' ? new Date(entry.respondedAt).getTime() : entry.respondedAt) : 'NULL'}\n`;
            sql += `);\n\n`;
        } else if (entry.senderName) {
            // Valentine entry
            valentineCount++;
            sql += `INSERT OR IGNORE INTO valentines (tracking_id, sender_name, created_at, views, yes_clicked, yes_clicked_at) VALUES (\n`;
            sql += `  ${escapeSQL(id)},\n`;
            sql += `  ${escapeSQL(entry.senderName)},\n`;
            sql += `  ${entry.createdAt || Date.now()},\n`;
            sql += `  ${entry.views || 0},\n`;
            sql += `  ${entry.yesClicked ? 1 : 0},\n`;
            sql += `  ${entry.yesClickedAt || 'NULL'}\n`;
            sql += `);\n\n`;
        } else {
            console.log(`  Skipping unknown entry: ${id}`);
        }
    }

    fs.writeFileSync(OUTPUT_FILE, sql);

    console.log('');
    console.log('Migration SQL generated successfully!');
    console.log(`  Valentines: ${valentineCount}`);
    console.log(`  E-cards:    ${ecardCount}`);
    console.log(`  Output:     ${OUTPUT_FILE}`);
    console.log('');
    console.log('Next steps:');
    console.log('  Option A: Go to Cloudflare D1 Console and paste the SQL');
    console.log('  Option B: Run: npx wrangler d1 execute valentine-db --file=d1-import.sql');
    console.log('');
}

main();
