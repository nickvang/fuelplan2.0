import { HydrationPlan, HydrationProfile, SUPPLME_ELECTROLYTE_SPEC, SUPPLME_GEL_SPEC } from '@/types/hydration';
import { computeDuringSachetSchedule, computeGelSchedule } from '@/components/plan/planHelpers';
import { translations } from '@/contexts/LanguageContext';

type Language = 'en' | 'da';

function ti(lang: Language, key: string, params?: Record<string, string | number>): string {
  const langObj = translations[lang];
  const enObj = translations.en;
  let result = (langObj[key as keyof typeof enObj] ?? enObj[key as keyof typeof enObj] ?? key) as string;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      result = result.replace(`{${k}}`, String(v));
    }
  }
  return result;
}

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
  language: Language = 'en',
): Promise<Blob> {
  const t = (key: string, params?: Record<string, string | number>) => ti(language, key, params);
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
  // totalElectrolytes was missing from saved records before a schema fix —
  // fall back to electrolytesPerHour × effective duration for old records.
  const effectiveDur = Math.max(0, (profile.sessionDuration || 0) - 0.5);
  const duringSachets =
    plan.duringActivity.totalElectrolytes != null
      ? plan.duringActivity.totalElectrolytes
      : Math.round((plan.duringActivity.electrolytesPerHour || 0) * effectiveDur);
  const totalSachets =
    plan.preActivity.electrolytes +
    duringSachets +
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

  // Sachet + gel schedules using shared helpers (matches results page)
  const sachetSchedule = computeDuringSachetSchedule(plan, profile, distance);
  const gelSchedule = computeGelSchedule(plan, profile, distance);
  const gel = plan.energyGel;
  const gelIntervalMin = gel?.gelsPerHour > 0 ? Math.round(60 / gel.gelsPerHour) : 0;

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
  const targetStr = `${t('image.target')}  ·  ${formatDuration(profile.sessionDuration).slice(0, -3)}`;
  drawText(ctx, targetStr, W - PAD, y, SANS('600', 16), LABEL_GRAY, 'right');
  y += 32;

  // ════════════════════════════════════════
  // TITLE
  // ════════════════════════════════════════
  drawText(ctx, t('image.yourRaceDay'), PAD, y, SANS('700', 52), BLACK);
  y += 60;
  drawText(ctx, t('image.hydrationPlan'), PAD, y, SANS('700', 52), BLACK);
  y += 80;

  // ════════════════════════════════════════
  // STATS GRID (3 columns)
  // ════════════════════════════════════════
  const statW = Math.floor(CW / 3);
  const stats = [
    { label: t('image.electrolyteSachets'), value: `${totalSachets}`, unit: '' },
    { label: t('image.fluidLoss'), value: `${(safeNumber(plan.totalFluidLoss) / 1000).toFixed(1)}`, unit: 'L' },
    { label: t('image.totalSodium'), value: `${totalSachets * SUPPLME_ELECTROLYTE_SPEC.sodium}`, unit: 'mg' },
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
  drawText(ctx, `${t('image.sachetSummary')}  /  ${totalSachets} total`.toUpperCase(), PAD, y, SANS('600', 14), LABEL_GRAY);
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
    { count: plan.preActivity.electrolytes, label: t('image.preRace') },
    { count: duringSachets, label: t('image.during') },
    { count: plan.postActivity.electrolytes, label: t('image.postRace') },
  ];

  sachetCols.forEach((col, i) => {
    const cx = PAD + colW * i;
    if (i > 0) drawLine(ctx, cx, y + 16, cx, y + 84, LIGHT_GRAY);
    drawText(ctx, `${col.count}`, cx + colW / 2, y + 16, SANS('700', 36), BLACK, 'center');
    drawText(ctx, col.label, cx + colW / 2, y + 60, SANS('600', 13), LABEL_GRAY, 'center');
  });
  y += 120;

  // ════════════════════════════════════════
  // ENERGY GEL SUMMARY (always shown)
  // ════════════════════════════════════════
  if (gel) {
    const gelTotalLabel = gel.applicable ? `${gel.totalGels} total` : t('image.notRequired');
    drawText(ctx, `${t('image.energyGelSummary')}  /  ${gelTotalLabel}`.toUpperCase(), PAD, y, SANS('600', 14), LABEL_GRAY);
    y += 30;

    ctx.fillStyle = '#f9fafb';
    ctx.beginPath();
    ctx.roundRect(PAD, y, CW, 100, 12);
    ctx.fill();
    ctx.strokeStyle = LIGHT_GRAY;
    ctx.lineWidth = 1;
    ctx.stroke();

    if (gel.applicable) {
      const carbsPerHour = profile.sessionDuration > 0 ? Math.round(gel.totalCarbsG / profile.sessionDuration) : 0;
      const gelCols = [
        { value: `${gel.totalGels}`, label: t('image.totalGels') },
        { value: `${gel.totalCarbsG}g`, label: t('image.totalCarbs') },
        { value: `${carbsPerHour}g`, label: t('image.carbsPerHour') },
        { value: `${gel.totalKcal}`, label: t('image.fuelKcal') },
      ];
      const gelColW = Math.floor(CW / 4);
      gelCols.forEach((col, i) => {
        const cx = PAD + gelColW * i;
        if (i > 0) drawLine(ctx, cx, y + 16, cx, y + 84, LIGHT_GRAY);
        drawText(ctx, col.value, cx + gelColW / 2, y + 16, SANS('700', 30), BLACK, 'center');
        drawText(ctx, col.label, cx + gelColW / 2, y + 60, SANS('600', 12), LABEL_GRAY, 'center');
      });
    } else {
      drawText(ctx, gel.timing, PAD + CW / 2, y + 40, SANS('400', 16), GRAY, 'center');
    }

    y += 120;

    // Gel specs line
    drawText(ctx, `${SUPPLME_GEL_SPEC.carbsPerGel}g carbohydrates  ·  ${SUPPLME_GEL_SPEC.ratioLabel} ratio Glucose to Fructose  ·  Liposomal technology`, PAD, y, SANS('400', 15), LABEL_GRAY);
    y += 40;
  }

  // ════════════════════════════════════════
  // 48-HOUR PROTOCOL
  // ════════════════════════════════════════
  drawText(ctx, t('image.protocol'), PAD, y, SANS('700', 18), BLACK);
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
  drawPhase(t('image.t24hours'), t('image.dayBefore'), [
    [t('image.waterThroughoutDay'), t('image.water23L')],
    [t('image.withDinner'), t('image.water500ml')],
  ]);

  // Phase 2: Race Morning
  const raceMorningRows: [string, string][] = [
    [t('image.wakeUp'), `${plan.preActivity.water}ml water + breakfast`],
    [t('image.preLoad'), `200ml water + ${plan.preActivity.electrolytes} sachet${plan.preActivity.electrolytes !== 1 ? 's' : ''}`],
  ];
  if (gel?.applicable && gel.phases.preMatch > 0) {
    raceMorningRows.push([t('image.energyGelPre'), `${gel.phases.preMatch} gel + 150ml water`]);
  }
  raceMorningRows.push([t('image.finalSips'), t('image.sipsOnly')]);
  drawPhase(t('image.raceMorningLabel'), t('image.raceMorningTitle'), raceMorningRows);

  // Phase 3: During Race (drawn manually to support sub-section headers)
  if (!isSwimOnly) {
    // Phase dot
    ctx.beginPath();
    ctx.arc(dotX, y + 10, 8, 0, Math.PI * 2);
    ctx.strokeStyle = LIGHT_GRAY;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Time label + phase name
    drawText(ctx, t('image.raceStart'), contentX, y, SANS('600', 13), LABEL_GRAY);
    y += 22;
    drawText(ctx, t('image.duringRace'), contentX, y, SANS('700', 24), BLACK);
    y += 38;

    // ── ELECTROLYTE SACHET sub-section ──
    if (duringSachets > 0) {
      drawText(ctx, t('image.electrolyteSachetSub'), contentX, y, SANS('800', 16), BLACK);
      y += 30;
      const maxSachets = Math.min(sachetSchedule.length, 6);
      for (let i = 0; i < maxSachets; i++) {
        const s = sachetSchedule[i];
        const right = s.km > 0 ? `${s.timeStr} · km ${Math.round(s.km)}` : s.timeStr;
        drawText(ctx, t('image.sachetNum', { n: i + 1 }), contentX, y, SANS('400', 18), GRAY);
        drawText(ctx, right, W - PAD, y, SANS('600', 18), BLACK, 'right');
        y += 32;
      }
      if (duringSachets > 6) {
        drawText(ctx, t('image.moreSachets', { n: duringSachets - 6 }), contentX, y, SANS('400', 18), GRAY);
        drawText(ctx, t('image.spreadEvenly'), W - PAD, y, SANS('600', 18), BLACK, 'right');
        y += 32;
      }
      y += 8;
    }

    // ── ENERGY GEL sub-section ──
    if (gel?.applicable && gel.phases.during > 0) {
      drawText(ctx, t('image.energyGelSub'), contentX, y, SANS('800', 16), BLACK);
      y += 30;
      const maxGels = Math.min(gelSchedule.length, 6);
      for (let i = 0; i < maxGels; i++) {
        const g = gelSchedule[i];
        const right = g.km > 0 ? `${g.timeStr} · km ${Math.round(g.km)}` : g.timeStr;
        drawText(ctx, t('image.gelNum', { n: i + 1 }), contentX, y, SANS('400', 18), GRAY);
        drawText(ctx, right, W - PAD, y, SANS('600', 18), BLACK, 'right');
        y += 32;
      }
      if (gel.phases.during > 6) {
        drawText(ctx, t('image.moreGels', { n: gel.phases.during - 6 }), contentX, y, SANS('400', 18), GRAY);
        drawText(ctx, gelIntervalMin > 0 ? t('image.everyMin', { min: gelIntervalMin }) : t('image.spreadEvenly'), W - PAD, y, SANS('600', 18), BLACK, 'right');
        y += 32;
      }
      y += 8;
    }

    // Water per hour
    drawText(ctx, t('image.waterPerHour'), contentX, y, SANS('400', 18), GRAY);
    drawText(ctx, `${safeNumber(plan.duringActivity.waterPerHour)}ml water`, W - PAD, y, SANS('600', 18), BLACK, 'right');
    y += 32;

    // Vertical connector to next phase
    drawLine(ctx, lineX, y - 32 * (duringSachets > 0 ? 1 : 0) - 50, lineX, y + 10, LIGHT_GRAY);
    y += 28;
  }

  // Phase 4: Recovery
  drawPhase(t('image.finishLine'), t('image.recovery'), [
    [t('image.recoveryImmediately'), `500ml water + ${safeNumber(plan.postActivity.electrolytes)} sachet${safeNumber(plan.postActivity.electrolytes) !== 1 ? 's' : ''}`],
    [t('image.recover12h'), '250ml water + protein meal'],
    [t('image.rehydrate26h'), '750ml water, pale urine'],
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
  drawText(ctx, t('image.disclaimer'), PAD, y, SANS('400', 13), LABEL_GRAY);

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
