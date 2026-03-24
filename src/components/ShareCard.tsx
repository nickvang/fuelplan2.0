import { HydrationPlan, HydrationProfile } from '@/types/hydration';

interface SelectedRace {
  name: string;
  distance_km: number;
  typical_temp_c: { min: number; max: number };
  course_profile?: string;
}

const safeNumber = (value: number | null | undefined, fallback: number = 0): number => {
  if (value === null || value === undefined || isNaN(value) || !isFinite(value)) return fallback;
  return value;
};

const formatDuration = (hours: number): string => {
  const h = Math.floor(hours);
  const m = Math.floor((hours - h) * 60);
  const s = Math.round(((hours - h) * 60 - m) * 60);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

// ── Canvas drawing helpers ──

function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  font: string,
  color: string,
  align: CanvasTextAlign = 'left',
) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.fillText(text, x, y);
}

function drawLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  width: number = 1,
) {
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

// ── Colors (monochrome, white bg) ──
const BG = '#ffffff';
const BLACK = '#0a0a0a';
const GRAY = '#6b7280';
const LIGHT_GRAY = '#d1d5db';
const LABEL_GRAY = '#9ca3af';

// ── Fonts ──
const SANS = (weight: string, size: number) => `${weight} ${size}px system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif`;

/**
 * Generates a 1080x1920 PNG Blob of the fuel plan — white background, black text, clean monochrome.
 */
export async function generateFuelPlanImage(
  plan: HydrationPlan,
  profile: HydrationProfile,
  distance: number,
  selectedRace: SelectedRace | null,
): Promise<Blob> {
  const W = 1080;
  const H = 1920;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.textBaseline = 'top';

  // ── Background ──
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  // ── Derived data ──
  const totalSachets =
    plan.preActivity.electrolytes +
    plan.duringActivity.totalElectrolytes +
    plan.postActivity.electrolytes;
  const totalFluid =
    plan.preActivity.water +
    Math.round(safeNumber(plan.duringActivity.waterPerHour) * profile.sessionDuration) +
    plan.postActivity.water;
  const isSwimOnly =
    profile.disciplines?.includes('Swimming') && !profile.disciplines?.includes('Triathlon');

  const raceName = selectedRace?.name || profile.disciplines?.[0] || 'Activity';
  const raceSubtitle = selectedRace
    ? `${selectedRace.distance_km % 1 === 0 ? selectedRace.distance_km : selectedRace.distance_km.toFixed(1)} km`
    : `${distance} km`;

  // Sachet markers for in-race
  const sachetCount = Math.min(plan.duringActivity.totalElectrolytes, 6);
  const inRaceSachets: { number: number; km: number }[] = [];
  if (sachetCount > 0 && distance > 0) {
    const totalMin = Math.round(profile.sessionDuration * 60);
    const startOffset = Math.round(totalMin * 0.2);
    const endCutoff = Math.max(0, totalMin - 20);
    const usableWindow = Math.max(1, endCutoff - startOffset);
    const rawInterval = sachetCount > 1 ? Math.round(usableWindow / (sachetCount - 1)) : usableWindow;
    const interval = Math.max(rawInterval, 20);
    const pacePerKm = totalMin / distance;
    for (let i = 0; i < sachetCount; i++) {
      const minuteMark = Math.min(startOffset + Math.round(interval * i), endCutoff);
      const km = Math.round((minuteMark / pacePerKm) * 10) / 10;
      inRaceSachets.push({ number: i + 1, km });
    }
  }

  const PAD = 72;
  const CW = W - PAD * 2; // content width
  let y = PAD;

  // ════════════════════════════════════════
  // SUPPLME LOGO (text-based)
  // ════════════════════════════════════════
  drawText(ctx, 'SUPPLME', PAD, y, SANS('800', 32), BLACK);
  y += 50;

  // ════════════════════════════════════════
  // ACTIVITY LABEL
  // ════════════════════════════════════════
  const activityParts: string[] = [];
  if (profile.disciplines?.[0]) activityParts.push(profile.disciplines[0]);
  if (profile.raceDistance) activityParts.push(profile.raceDistance);
  if (profile.terrain) activityParts.push(profile.terrain);
  const activityLabel = activityParts.join('  /  ') || 'Activity';
  drawText(ctx, activityLabel.toUpperCase(), PAD, y, SANS('600', 16), LABEL_GRAY);
  y += 32;

  // ════════════════════════════════════════
  // TITLE
  // ════════════════════════════════════════
  drawText(ctx, 'Your Race Day', PAD, y, SANS('700', 52), BLACK);
  y += 60;
  drawText(ctx, 'Hydration Plan', PAD, y, SANS('700', 52), BLACK);
  y += 80;

  // ════════════════════════════════════════
  // STATS GRID (4 columns)
  // ════════════════════════════════════════
  const statW = Math.floor(CW / 4);
  const stats = [
    { label: 'DISTANCE', value: `${distance}`, unit: 'km' },
    { label: 'TARGET TIME', value: formatDuration(profile.sessionDuration), unit: '' },
    { label: 'FLUID LOSS', value: `${(safeNumber(plan.totalFluidLoss) / 1000).toFixed(1)}`, unit: 'L' },
    { label: 'SACHETS', value: `${totalSachets}`, unit: 'total' },
  ];

  // Grid background
  ctx.fillStyle = '#f9fafb';
  ctx.beginPath();
  ctx.roundRect(PAD, y, CW, 100, 12);
  ctx.fill();
  ctx.strokeStyle = LIGHT_GRAY;
  ctx.lineWidth = 1;
  ctx.stroke();

  stats.forEach((stat, i) => {
    const sx = PAD + statW * i;
    if (i > 0) drawLine(ctx, sx, y + 16, sx, y + 84, LIGHT_GRAY);
    drawText(ctx, stat.label, sx + statW / 2, y + 16, SANS('600', 13), LABEL_GRAY, 'center');
    const valueText = stat.unit ? `${stat.value} ${stat.unit}` : stat.value;
    drawText(ctx, valueText, sx + statW / 2, y + 42, SANS('700', 28), BLACK, 'center');
  });
  y += 130;

  // ════════════════════════════════════════
  // SACHET SUMMARY (3 columns)
  // ════════════════════════════════════════
  drawText(ctx, `SACHET SUMMARY  /  ${totalSachets} total`.toUpperCase(), PAD, y, SANS('600', 14), LABEL_GRAY);
  y += 30;

  const colW = Math.floor(CW / 3);
  ctx.fillStyle = '#f9fafb';
  ctx.beginPath();
  ctx.roundRect(PAD, y, CW, 110, 12);
  ctx.fill();
  ctx.strokeStyle = LIGHT_GRAY;
  ctx.lineWidth = 1;
  ctx.stroke();

  const sachetCols = [
    { count: plan.preActivity.electrolytes, label: 'PRE-RACE', sub: 'T-2 h' },
    { count: plan.duringActivity.totalElectrolytes, label: 'DURING', sub: profile.sessionDuration >= 2 ? `at ${Math.round(distance / 2 * 10) / 10} km` : 'None' },
    { count: plan.postActivity.electrolytes, label: 'POST-RACE', sub: 'at finish' },
  ];

  sachetCols.forEach((col, i) => {
    const cx = PAD + colW * i;
    if (i > 0) drawLine(ctx, cx, y + 16, cx, y + 94, LIGHT_GRAY);
    drawText(ctx, `${col.count}`, cx + colW / 2, y + 16, SANS('700', 36), BLACK, 'center');
    drawText(ctx, col.label, cx + colW / 2, y + 60, SANS('600', 13), LABEL_GRAY, 'center');
    drawText(ctx, col.sub, cx + colW / 2, y + 80, SANS('400', 13), LABEL_GRAY, 'center');
  });
  y += 140;

  // ════════════════════════════════════════
  // 48-HOUR PROTOCOL
  // ════════════════════════════════════════
  drawText(ctx, '48-HOUR RACE DAY PROTOCOL', PAD, y, SANS('700', 18), BLACK);
  y += 40;

  const dotX = PAD + 12;
  const contentX = PAD + 48;
  const lineX = dotX;

  const drawPhase = (timeLabel: string, name: string, rows: [string, string][], isLast = false) => {
    // Dot
    ctx.beginPath();
    ctx.arc(dotX, y + 10, 8, 0, Math.PI * 2);
    ctx.strokeStyle = LIGHT_GRAY;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Time label + name
    drawText(ctx, timeLabel.toUpperCase(), contentX, y, SANS('600', 13), LABEL_GRAY);
    y += 22;
    drawText(ctx, name, contentX, y, SANS('700', 24), BLACK);
    y += 38;

    // Rows
    rows.forEach(([left, right]) => {
      drawText(ctx, left, contentX, y, SANS('400', 18), GRAY);
      drawText(ctx, right, W - PAD, y, SANS('600', 18), BLACK, 'right');
      y += 32;
    });

    // Vertical line to next phase
    if (!isLast) {
      drawLine(ctx, lineX, y - rows.length * 32 - 50 + 24, lineX, y + 10, LIGHT_GRAY);
      y += 28;
    }
  };

  // Phase 1: Day Before
  drawPhase('T-24 hours', 'Day Before', [
    ['Water throughout the day', '2-3 L'],
    ['With dinner', '500 ml'],
  ]);

  // Phase 2: Race Morning
  drawPhase('Race morning', 'Race Morning', [
    ['-3h: Wake up', `${plan.preActivity.water}ml + breakfast`],
    ['-2h: Pre-load', `200ml + ${plan.preActivity.electrolytes} sachet${plan.preActivity.electrolytes !== 1 ? 's' : ''}`],
    ['-30min: Final', 'Sips only'],
  ]);

  // Phase 3: During Race
  if (!isSwimOnly) {
    const duringRows: [string, string][] = [];
    if (profile.sessionDuration < 2) {
      duringRows.push(['No sachet needed', 'Under 2 hours']);
      duringRows.push(['Water per hour', `${safeNumber(plan.duringActivity.waterPerHour)}ml`]);
    } else {
      // Show each sachet marker
      for (const s of inRaceSachets) {
        duringRows.push([`Sachet #${s.number}`, `km ${s.km}`]);
      }
      if (plan.duringActivity.totalElectrolytes > 6) {
        duringRows.push([`+${plan.duringActivity.totalElectrolytes - 6} more sachets`, 'Spread evenly']);
      }
      duringRows.push(['Water per hour', `${safeNumber(plan.duringActivity.waterPerHour)}ml`]);
    }
    drawPhase('Race start', 'During Race', duringRows);
  }

  // Phase 4: Recovery
  drawPhase('Finish line', 'Recovery', [
    ['0h: Immediately', `500ml + ${safeNumber(plan.postActivity.electrolytes)} sachet${safeNumber(plan.postActivity.electrolytes) !== 1 ? 's' : ''}`],
    ['1-2h: Recover', '250ml + protein meal'],
    ['2-6h: Rehydrate', '750ml, pale urine'],
  ], true);

  // ════════════════════════════════════════
  // FOOTER
  // ════════════════════════════════════════
  y = H - 80;
  drawLine(ctx, PAD, y, W - PAD, y, LIGHT_GRAY);
  y += 20;
  drawText(ctx, 'SUPPLME', PAD, y, SANS('800', 18), BLACK);
  drawText(ctx, 'supplme.com', W - PAD, y, SANS('400', 16), LABEL_GRAY, 'right');
  y += 28;
  drawText(ctx, 'This plan is for educational purposes only. Consult a healthcare provider.', PAD, y, SANS('400', 13), LABEL_GRAY);

  // ── Export as Blob ──
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas toBlob returned null'));
      },
      'image/png',
      1,
    );
  });
}
