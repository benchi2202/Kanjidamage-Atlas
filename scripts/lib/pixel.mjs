import fs from "node:fs";
import sharp from "sharp";

const SIZE = 64;
const INNER = 56;
const PAD = 4;

export const PIXEL_SIZE = SIZE;
export const PIXEL_BYTES = SIZE * SIZE;

/** Remove KanjiVG's stroke-number labels so they cannot pollute the bitmap. */
export function stripStrokeNumbers(svg) {
  return svg
    .replace(/<g id="kvg:StrokeNumbers_[\s\S]*?<\/g>/g, "")
    .replace(/<text[\s\S]*?<\/text>/g, "");
}

/**
 * Render one KanjiVG SVG to a bbox-normalized 64x64 grayscale buffer.
 * Returns null when the SVG is missing or empty.
 */
export async function renderGlyphTo64(svgPath) {
  if (!fs.existsSync(svgPath)) return null;
  const svg = stripStrokeNumbers(fs.readFileSync(svgPath, "utf8"));
  const BIG = 160;
  let big;
  try {
    big = await sharp(Buffer.from(svg), { density: 600 })
      .resize(BIG, BIG, { fit: "contain", background: "#ffffff" })
      .flatten({ background: "#ffffff" })
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
  } catch {
    return null;
  }
  const data = big.data;
  let minX = BIG, minY = BIG, maxX = -1, maxY = -1;
  for (let y = 0; y < BIG; y++) {
    for (let x = 0; x < BIG; x++) {
      if (data[y * BIG + x] < 245) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;

  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const scale = Math.min(INNER / w, INNER / h);
  const nw = Math.max(1, Math.round(w * scale));
  const nh = Math.max(1, Math.round(h * scale));
  const cropped = await sharp(data, { raw: { width: BIG, height: BIG, channels: 1 } })
    .extract({ left: minX, top: minY, width: w, height: h })
    .resize(nw, nh, { fit: "fill" })
    .greyscale()
    .raw()
    .toBuffer();
  if (cropped.length !== nw * nh) return null;

  const out = Buffer.alloc(PIXEL_BYTES, 255);
  const ox = Math.floor((SIZE - nw) / 2);
  const oy = Math.floor((SIZE - nh) / 2);
  for (let y = 0; y < nh; y++) {
    for (let x = 0; x < nw; x++) {
      out[(oy + y) * SIZE + ox + x] = cropped[y * nw + x];
    }
  }
  return out;
}

/** Cosine similarity of ink (white=0, black=1). */
export function inkCosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = (255 - a[i]) / 255;
    const y = (255 - b[i]) / 255;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  if (!na || !nb) return 0;
  return dot / Math.sqrt(na * nb);
}
