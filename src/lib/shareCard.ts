// Renders a shareable "poster" image for a dish, entirely client-side via the
// Canvas 2D API — no image-generation library needed. This is the visual
// centerpiece of the Share feature (see ShareButton/ShareSheet): a clean,
// on-brand card with the dish name, restaurant, nutrition, and the Fuelo
// wordmark, sized for sharing to a story/chat (1080×1350, a 4:5 portrait).

export type ShareCardInput = {
  dishName: string;
  restaurantName: string;
  area: string | null;
  price: string | null;
  verified: boolean;
  calories: string | null;
  protein: string | null;
  carbs: string | null;
  fat: string | null;
  dietaryTags: string[];
};

const W = 1080;
const H = 1350;
const PAD = 72;

const CREAM = "#FBF8F2";
const INK = "#241F17";
const MUTED = "#8C8776";
const GREEN = "#16A34A";
const GREEN_DARK = "#166534";
const GREEN_LIGHT = "#DCF3E1";
const CHIP_BG = "#F1EDE3";
const WHITE = "#FFFFFF";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const attempt = line ? `${line} ${word}` : word;
    if (ctx.measureText(attempt).width > maxWidth && line) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines - 1) break;
    } else {
      line = attempt;
    }
  }
  if (line) lines.push(line);
  const consumedWords = lines.join(" ").split(/\s+/).length;
  if (consumedWords < words.length && lines.length) {
    let last = lines[lines.length - 1];
    while (ctx.measureText(`${last}…`).width > maxWidth && last.length > 1) {
      last = last.slice(0, -1).trimEnd();
    }
    lines[lines.length - 1] = `${last}…`;
  }
  return lines;
}

/** Truncates a single line of already-set-font text to fit maxWidth, adding
 *  an ellipsis if it had to cut anything. */
function truncateToWidth(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) {
    t = t.slice(0, -1).trimEnd();
  }
  return `${t}…`;
}

type Chip = { label: string | null; value: string; bg: string; fg: string; bold?: boolean };

/** Lays out a row of pill chips left-to-right, wrapping to new rows as
 *  needed. Pass draw=false to measure the resulting height without actually
 *  painting anything (used to pre-compute total content height so it can be
 *  vertically centered before the real drawing pass). */
function layoutChipRow(
  ctx: CanvasRenderingContext2D,
  chips: Chip[],
  x: number,
  startY: number,
  maxWidth: number,
  fontSize: number,
  height: number,
  gap: number,
  draw: boolean,
): number {
  const padX = 26;
  let cx = x;
  let cy = startY;
  for (const chip of chips) {
    ctx.font = `${chip.bold ? 800 : 700} ${fontSize}px Inter, sans-serif`;
    const labelText = chip.label ? `${chip.label} ${chip.value}` : chip.value;
    const textW = ctx.measureText(labelText).width;
    const chipW = textW + padX * 2;
    if (cx + chipW > x + maxWidth && cx > x) {
      cx = x;
      cy += height + gap;
    }
    if (draw) {
      ctx.fillStyle = chip.bg;
      roundRectPath(ctx, cx, cy, chipW, height, height / 2);
      ctx.fill();
      ctx.fillStyle = chip.fg;
      ctx.textBaseline = "middle";
      ctx.fillText(labelText, cx + padX, cy + height / 2 + 2);
    }
    cx += chipW + gap;
  }
  return cy + height;
}

function buildChips(input: ShareCardInput): Chip[] {
  const chips: Chip[] = [];
  if (input.calories) {
    chips.push({ label: null, value: input.calories, bg: GREEN_LIGHT, fg: GREEN_DARK, bold: true });
  }
  if (input.protein) chips.push({ label: "P", value: input.protein, bg: CHIP_BG, fg: INK });
  if (input.carbs) chips.push({ label: "C", value: input.carbs, bg: CHIP_BG, fg: INK });
  if (input.fat) chips.push({ label: "F", value: input.fat, bg: CHIP_BG, fg: INK });
  return chips;
}

function buildTagChips(input: ShareCardInput): Chip[] {
  return input.dietaryTags
    .slice(0, 4)
    .map((t) => ({ label: null, value: t, bg: GREEN_LIGHT, fg: GREEN_DARK }));
}

export async function renderShareCard(input: ShareCardInput): Promise<Blob> {
  // Make sure Inter (already loaded for the page) is actually ready before we
  // measure/draw text with it, or canvas silently falls back to a system font.
  const fontLoads = [
    "800 84px Inter",
    "700 40px Inter",
    "600 34px Inter",
    "700 30px Inter",
    "600 26px Inter",
  ].map((f) => document.fonts.load(f).catch(() => {}));
  await Promise.all([document.fonts.ready, ...fontLoads]);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  // Background.
  ctx.fillStyle = CREAM;
  ctx.fillRect(0, 0, W, H);

  // Decorative ring motif, echoing the Fuelo ring mark used across the app
  // (logo, map pins, confidence ring) — gives the card a branded identity
  // even without dish photography. Two rings (one large top-right, one
  // smaller bottom-left) so the composition feels intentional rather than
  // leaving a big empty middle when a dish has little content.
  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.strokeStyle = GREEN;
  ctx.lineWidth = 110;
  ctx.beginPath();
  ctx.arc(W + 60, 40, 420, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 0.05;
  ctx.lineWidth = 160;
  ctx.beginPath();
  ctx.arc(-100, H + 40, 480, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Logo, top-left.
  try {
    const logo = await loadImage("/fuelo-wordmark.svg");
    const logoH = 60;
    const logoW = logoH * (logo.naturalWidth / logo.naturalHeight);
    ctx.drawImage(logo, PAD, PAD, logoW, logoH);
  } catch {
    // If the logo fails to load, fall back to plain wordmark text rather
    // than failing the whole card.
    ctx.fillStyle = INK;
    ctx.font = "800 44px Inter, sans-serif";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("Fuelo", PAD, PAD + 44);
  }

  // Status pill, top-right.
  const statusText = input.verified ? "Verified Nutrition" : "AI Estimated";
  ctx.font = "700 26px Inter, sans-serif";
  const statusW = ctx.measureText(statusText).width + 56;
  const statusH = 52;
  const statusX = W - PAD - statusW;
  const statusY = PAD + 4;
  ctx.fillStyle = input.verified ? GREEN : CHIP_BG;
  roundRectPath(ctx, statusX, statusY, statusW, statusH, statusH / 2);
  ctx.fill();
  ctx.fillStyle = input.verified ? WHITE : MUTED;
  ctx.textBaseline = "middle";
  ctx.fillText(statusText, statusX + 28, statusY + statusH / 2 + 1);

  const headerBottom = PAD + 60 + 56;
  const footerTop = H - PAD - 90;

  // --- Measure pass: figure out how tall the content block (name through
  // tags) will be, so it can be vertically centered in the space between the
  // header and footer instead of always sitting flush under the logo (which
  // leaves a big awkward gap for short dish names/descriptions). ---
  ctx.font = "800 84px Inter, sans-serif";
  const nameLines = wrapText(ctx, input.dishName, W - PAD * 2, 3);
  const NAME_LINE_H = 92;

  ctx.font = "600 34px Inter, sans-serif";
  const restaurantLine = input.area
    ? `${input.restaurantName}  ·  ${input.area}`
    : input.restaurantName;

  const chips = buildChips(input);
  const tagChips = buildTagChips(input);

  let measuredY = 0;
  measuredY += nameLines.length * NAME_LINE_H + 20 + 48; // name block + gap + restaurant/price line
  if (chips.length) {
    measuredY += 24; // gap before chips
    const chipBottom = layoutChipRow(ctx, chips, 0, measuredY, W - PAD * 2, 32, 68, 16, false);
    measuredY = chipBottom;
  }
  if (tagChips.length) {
    measuredY += 20;
    const tagBottom = layoutChipRow(ctx, tagChips, 0, measuredY, W - PAD * 2, 24, 48, 12, false);
    measuredY = tagBottom;
  }
  const contentHeight = measuredY;
  const availableHeight = footerTop - headerBottom;
  const startY = headerBottom + Math.max(0, (availableHeight - contentHeight) / 2);

  // --- Draw pass, using startY as the anchor. ---
  let y = startY;

  ctx.fillStyle = INK;
  ctx.font = "800 84px Inter, sans-serif";
  ctx.textBaseline = "alphabetic";
  for (const line of nameLines) {
    y += NAME_LINE_H * 0.78; // baseline offset within the line's box
    ctx.fillText(line, PAD, y);
    y += NAME_LINE_H * 0.22;
  }

  y += 20;
  const restaurantBaselineY = y + 34;
  ctx.font = "700 34px Inter, sans-serif";
  const priceW = input.price ? ctx.measureText(input.price).width : 0;
  const priceGap = input.price ? 32 : 0;
  ctx.font = "600 34px Inter, sans-serif";
  ctx.fillStyle = MUTED;
  const restaurantMaxWidth = W - PAD * 2 - priceW - priceGap;
  const restaurantText = truncateToWidth(ctx, restaurantLine, restaurantMaxWidth);
  ctx.fillText(restaurantText, PAD, restaurantBaselineY);

  if (input.price) {
    ctx.font = "700 34px Inter, sans-serif";
    ctx.fillStyle = INK;
    ctx.fillText(input.price, W - PAD - priceW, restaurantBaselineY);
  }
  y = restaurantBaselineY + 30;

  if (chips.length) {
    y += 24;
    y = layoutChipRow(ctx, chips, PAD, y, W - PAD * 2, 32, 68, 16, true);
  }
  if (tagChips.length) {
    y += 20;
    y = layoutChipRow(ctx, tagChips, PAD, y, W - PAD * 2, 24, 48, 12, true);
  }

  // Footer: small ring mark + tagline + url, pinned near the bottom.
  const footerY = H - PAD - 26;
  const ringR = 16;
  const ringCx = PAD + ringR;
  const ringCy = footerY - 8;
  ctx.beginPath();
  ctx.strokeStyle = GREEN;
  ctx.lineWidth = 6;
  ctx.arc(ringCx, ringCy, ringR, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = GREEN;
  ctx.beginPath();
  ctx.arc(ringCx + 5, ringCy - 6, 3.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = "700 28px Inter, sans-serif";
  ctx.fillStyle = INK;
  ctx.textBaseline = "middle";
  ctx.fillText("Discover More, Digest Smarter.", ringCx + ringR + 18, ringCy);

  ctx.font = "600 24px Inter, sans-serif";
  ctx.fillStyle = MUTED;
  const urlText = typeof window !== "undefined" ? window.location.host : "fuelo.app";
  const urlW = ctx.measureText(urlText).width;
  ctx.fillText(urlText, W - PAD - urlW, ringCy);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not generate image"))),
      "image/png",
    );
  });
}
