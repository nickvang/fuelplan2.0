// Generates placeholder GPX waypoint files for all races that have a gpx_path.
// Each file contains the race start point, name, and key stats.
// Replace with real course GPX data when available.

import { races } from '../src/data/racesDatabase.js';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GPX_DIR = join(__dirname, '../public/gpx');

mkdirSync(GPX_DIR, { recursive: true });

let created = 0;
let skipped = 0;

for (const race of races) {
  if (!race.gpx_path) { skipped++; continue; }

  const filename = race.gpx_path.replace('/gpx/', '');
  const filePath = join(GPX_DIR, filename);

  const desc = [
    `Distance: ${race.distance_km} km`,
    `Elevation gain: ${race.elevation_gain_m} m`,
    race.course_profile ? `Profile: ${race.course_profile}` : null,
    race.surface ? `Surface: ${race.surface}` : null,
    race.date_typical ? `Typical date: ${race.date_typical}` : null,
    race.notes ?? null,
  ].filter(Boolean).join(' | ');

  const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="supplme.app"
  xmlns="http://www.topografix.com/GPX/1/1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${escapeXml(race.name)}</name>
    <desc>${escapeXml(desc)}</desc>
    <link href="https://supplme.app"><text>Supplme</text></link>
  </metadata>
  <wpt lat="${race.lat}" lon="${race.lng}">
    <ele>${race.altitude_start_m}</ele>
    <name>${escapeXml(race.name)} — Start</name>
    <desc>${escapeXml(desc)}</desc>
    <sym>Flag</sym>
  </wpt>
</gpx>
`;

  writeFileSync(filePath, gpx, 'utf8');
  created++;
}

console.log(`✓ Created ${created} GPX files in public/gpx/`);
console.log(`  Skipped ${skipped} races without gpx_path`);

function escapeXml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
