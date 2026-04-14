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

function drawCircle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  strokeColor: string,
  text?: string,
) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  if (text) {
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillStyle = strokeColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
  }
}

// ── Colors ──
const BG = '#0a0a0a';
const WHITE = '#ffffff';
const DIM = 'rgba(255,255,255,0.40)';
const MED = 'rgba(255,255,255,0.60)';
const LINE_COLOR = 'rgba(255,255,255,0.12)';
const FOOTER_DIM = 'rgba(255,255,255,0.20)';

// ── Fonts ──
const MONO = (weight: string, size: number) => `${weight} ${size}px "SF Mono", Menlo, Consolas, monospace`;
const SANS = (weight: string, size: number) => `${weight} ${size}px system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif`;

/**
 * Generates a 1080×1920 PNG Blob of the fuel plan using the Canvas 2D API.
 * No DOM rendering, no font embedding — just direct canvas drawing.
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

  // Reset text baseline for consistent positioning
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

  const sodiumPerHour = (() => {
    if (profile.knownSodiumLossPerHour != null && profile.knownSodiumLossPerHour >= 200)
      return Math.round(profile.knownSodiumLossPerHour);
    return { low: 400, medium: 650, high: 1100 }[profile.sweatSaltiness ?? 'medium'] ?? 650;
  })();

  const raceName = selectedRace?.name || profile.disciplines?.[0] || 'Activity';
  const raceSubtitle = selectedRace
    ? `${selectedRace.distance_km % 1 === 0 ? selectedRace.distance_km : selectedRace.distance_km.toFixed(1)} km`
    : `${distance} km`;

  // In-race sachet markers
  const inRaceSachets: { letter: string; km: number }[] = [];
  const sachetCount = Math.min(plan.duringActivity.totalElectrolytes, 6);
  for (let i = 0; i < sachetCount; i++) {
    inRaceSachets.push({
      letter: String.fromCharCode(65 + i),
      km: Math.round((distance / (plan.duringActivity.totalElectrolytes + 1)) * (i + 1)),
    });
  }

  // ════════════════════════════════════════
  // HEADER
  // ════════════════════════════════════════
  drawText(ctx, 'Supplme', 72, 64, SANS('700', 22), WHITE);
  drawText(ctx, 'Hydration Plan', 72, 90, SANS('400', 13), DIM);
  drawText(ctx, 'supplme.com', W - 72, 68, SANS('400', 13), DIM, 'right');

  // ════════════════════════════════════════
  // RACE NAME
  // ════════════════════════════════════════
  const nameFontSize = raceName.length > 24 ? 52 : 68;
  drawText(ctx, raceName, 72, 160, SANS('800', nameFontSize), WHITE);
  drawText(ctx, 'Fuel Plan', 72, 160 + nameFontSize + 12, SANS('300', 42), 'rgba(255,255,255,0.35)');

  // ════════════════════════════════════════
  // LEFT COLUMN — Protocol
  // ════════════════════════════════════════
  const LX = 72;
  const LW = 600;
  let ly = 380;

  const drawDivider = () => {
    drawLine(ctx, LX, ly, LX + LW, ly, LINE_COLOR);
  };

  const drawSectionLabel = (text: string) => {
    ly += 20;
    drawText(ctx, text, LX, ly, MONO('400', 18), DIM);
    ctx.letterSpacing = '6px';
    // Canvas doesn't support letterSpacing universally — draw manually spaced
    ctx.font = MONO('400', 18);
    ctx.fillStyle = DIM;
    ctx.textAlign = 'left';
    let cx = LX;
    for (const ch of text.toUpperCase()) {
      ctx.fillText(ch, cx, ly);
      cx += ctx.measureText(ch).width + 6;
    }
    ly += 30;
  };

  const drawProtocolRow = (left: string, right: string) => {
    drawText(ctx, left, LX, ly, SANS('600', 24), WHITE);
    drawText(ctx, right, LX + LW, ly + 4, MONO('400', 18), MED, 'right');
    ly += 36;
  };

  const drawMarkerRow = (letter: string, label: string, km: number) => {
    drawText(ctx, letter, LX, ly + 2, MONO('600', 18), MED);
    drawText(ctx, label, LX + 36, ly, SANS('600', 24), WHITE);
    drawText(ctx, `${km} km`, LX + LW, ly + 4, MONO('400', 18), MED, 'right');
    ly += 36;
  };

  // PRE-RACE
  drawDivider();
  drawSectionLabel('PRE-RACE');
  drawProtocolRow(
    `${plan.preActivity.electrolytes}x SUPPLME SACHET`,
    plan.preActivity.timing || '2-4h before',
  );
  drawProtocolRow(`${plan.preActivity.water} ML WATER`, 'With breakfast');

  // IN-RACE
  if (!isSwimOnly) {
    ly += 20;
    drawDivider();
    drawSectionLabel('IN-RACE');
    for (const s of inRaceSachets) {
      drawMarkerRow(s.letter, 'SUPPLME SACHET', s.km);
    }
    if (plan.duringActivity.totalElectrolytes > 6) {
      drawText(ctx, `+${plan.duringActivity.totalElectrolytes - 6} more`, LX + 36, ly, MONO('400', 18), DIM);
      ly += 28;
    }
    drawProtocolRow(
      `${safeNumber(plan.duringActivity.waterPerHour)} ML/H WATER`,
      plan.duringActivity.frequency || 'Every 12-15 min',
    );
  }

  // POST-RACE
  ly += 20;
  drawDivider();
  drawSectionLabel('POST-RACE');
  drawProtocolRow(`${plan.postActivity.electrolytes}x SUPPLME SACHET`, 'After race');
  drawProtocolRow(`${plan.postActivity.water} ML WATER`, 'Over 4-6h');

  // PRODUCTS TO BRING
  ly += 20;
  drawDivider();
  drawSectionLabel('PRODUCTS TO BRING');
  drawText(ctx, `${totalSachets} SUPPLME SACHETS`, LX, ly, SANS('600', 24), WHITE);
  ly += 32;
  // Breakdown line
  const breakdownText = `${plan.preActivity.electrolytes} pre \u00B7 ${plan.duringActivity.totalElectrolytes} during \u00B7 ${plan.postActivity.electrolytes} post`;
  drawText(ctx, breakdownText, LX, ly, MONO('400', 16), MED);
  ly += 28;
  drawText(ctx, `${(totalFluid / 1000).toFixed(1)} L TOTAL FLUID`, LX, ly, SANS('600', 24), WHITE);

  // ════════════════════════════════════════
  // RIGHT COLUMN — Stats
  // ════════════════════════════════════════
  const RX = 740;
  const RW = 280;
  let ry = 380;

  const drawStatLabel = (text: string) => {
    ry += 18;
    // Spaced uppercase
    ctx.font = MONO('400', 16);
    ctx.fillStyle = DIM;
    ctx.textAlign = 'left';
    let cx = RX;
    for (const ch of text.toUpperCase()) {
      ctx.fillText(ch, cx, ry);
      cx += ctx.measureText(ch).width + 5;
    }
    ry += 24;
  };

  const drawStatValue = (text: string) => {
    drawText(ctx, text, RX, ry, MONO('700', 24), WHITE);
    ry += 30;
  };

  const drawStatLine = (text: string) => {
    drawText(ctx, text, RX, ry, MONO('400', 20), MED);
    ry += 28;
  };

  // Demographics
  const sexLabel = profile.sex === 'male' ? 'MALE' : profile.sex === 'female' ? 'FEMALE' : 'ATHLETE';
  drawText(ctx, sexLabel, RX, ry, SANS('700', 22), WHITE);
  ry += 36;
  drawStatLine(`Age ${profile.age}`);
  drawStatLine(`${profile.weight} kg`);
  drawStatLine(`${profile.height} cm`);

  // Race info
  ry += 32;
  drawText(ctx, formatDuration(profile.sessionDuration), RX, ry, MONO('700', 28), WHITE);
  ry += 36;
  drawStatLine(raceSubtitle);
  if (selectedRace) {
    drawStatLine(`${selectedRace.typical_temp_c.min}-${selectedRace.typical_temp_c.max}\u00B0C`);
    if (selectedRace.course_profile) {
      drawStatLine(selectedRace.course_profile);
    }
  } else if (profile.trainingTempRange) {
    drawStatLine(`${profile.trainingTempRange.min}-${profile.trainingTempRange.max}\u00B0C`);
  }

  // Key metrics
  ry += 24;
  drawStatLabel('Sodium');
  drawStatValue(`${sodiumPerHour} mg/h`);

  drawStatLabel('Fluid Loss');
  drawStatValue(
    safeNumber(plan.totalFluidLoss) > 0
      ? `${(plan.totalFluidLoss / 1000).toFixed(1)} L`
      : '\u2014',
  );

  drawStatLabel('Sachets/h');
  drawStatValue(
    plan.duringActivity.electrolytesPerHour > 0
      ? `${plan.duringActivity.electrolytesPerHour}`
      : '\u2014',
  );

  // ════════════════════════════════════════
  // FOOTER
  // ════════════════════════════════════════
  drawText(ctx, 'supplme.com', 72, H - 56, SANS('400', 13), FOOTER_DIM);
  drawCircle(ctx, W - 72 - 24, H - 48 - 24, 24, 'rgba(255,255,255,0.15)', 'S');

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
