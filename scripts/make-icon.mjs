import { Jimp } from "jimp";
import pngToIco from "png-to-ico";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const SRC = resolve("src/assets/la kataleya_titre.png");
const OUT_DIR = resolve("src/assets");
const OUT_ICO = resolve(OUT_DIR, "app-icon.ico");
const OUT_PNG = resolve(OUT_DIR, "app-icon.png");

const SIZES = [256, 128, 64, 48, 32, 16];

const src = await Jimp.read(SRC);
const side = Math.max(src.bitmap.width, src.bitmap.height);

const square = new Jimp({ width: side, height: side, color: 0x00000000 });
square.composite(
  src,
  Math.floor((side - src.bitmap.width) / 2),
  Math.floor((side - src.bitmap.height) / 2),
);

const buffers = [];
for (const size of SIZES) {
  const clone = square.clone().resize({ w: size, h: size });
  buffers.push(await clone.getBuffer("image/png"));
}

const ico = await pngToIco(buffers);
writeFileSync(OUT_ICO, ico);

const main = square.clone().resize({ w: 512, h: 512 });
writeFileSync(OUT_PNG, await main.getBuffer("image/png"));

console.log("Wrote", OUT_ICO, "and", OUT_PNG);
