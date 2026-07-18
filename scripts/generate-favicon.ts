/**
 * Rebuild app/favicon.ico from public/assets/brand/favicon.png, the single source of
 * truth for the mark. Next treats app/favicon.ico as file-based metadata, which outranks
 * the `icons` entry in app/layout.tsx — so a stale .ico silently wins over an updated
 * .png. Re-run this whenever the brand mark changes and the two cannot drift apart.
 *
 * Run: npm run favicon
 */
import fs from "node:fs";
import path from "node:path";
// sharp ships with Next; if that ever stops being true, `npm i -D sharp`.
import sharp from "sharp";

const SRC = "public/assets/brand/favicon.png";
const OUT = "app/favicon.ico";
const SIZES = [16, 32, 48];

async function main() {
  if (!fs.existsSync(SRC)) throw new Error(`Missing source mark: ${SRC}`);

  // `contain` keeps the wordmark's aspect ratio inside the square .ico canvas, and the
  // transparent background preserves the source's alpha rather than baking in a colour.
  const pngs = await Promise.all(
    SIZES.map((size) =>
      sharp(SRC)
        .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer(),
    ),
  );

  // ICO container: 6-byte header, then one 16-byte directory entry per image, then the
  // PNG payloads. Sizes of 256 are encoded as 0, so the byte is written modulo 256.
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // 1 = icon
  header.writeUInt16LE(pngs.length, 4);

  let offset = 6 + pngs.length * 16;
  const entries = pngs.map((png, i) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(SIZES[i] % 256, 0); // width
    entry.writeUInt8(SIZES[i] % 256, 1); // height
    entry.writeUInt8(0, 2); // palette count (0 = truecolour)
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    return entry;
  });

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, Buffer.concat([header, ...entries, ...pngs]));

  console.log(`Wrote ${OUT} (${SIZES.join("/")}px) from ${SRC}`);
}

main();
