// Certificado A4 horizontal: logo de la empresa, sello del nivel, firmas y QR de verificación.
import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { DATA_DIR } from './db.js';
import { levelOf, MES } from './method.js';

const INK = '#14202c', BLUE = '#1a5f99', DEEP = '#14324f', GOLD = '#c9a24a', LEAF = '#3d8a37', MUTED = '#5d6874';

// pdfkit solo lee PNG o JPG: para los logos .webp del sitio se usa su copia .png.
function img(p) {
  if (!p) return null;
  let f = p.startsWith('/uploads/') ? path.join(DATA_DIR, 'uploads', path.basename(p)) : path.resolve('public', p.replace(/^\/+/, ''));
  if (f.endsWith('.webp')) f = f.replace(/\.webp$/, '.png');
  return /\.(png|jpe?g)$/i.test(f) && fs.existsSync(f) ? f : null;
}
const longDate = (iso) => { const [y, m, d] = iso.slice(0, 10).split('-'); return `${+d} de ${MES[+m - 1]} de ${y}`; };

export function certificatePdf(out, { c, w, co, ev, url }) {
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0, info: { Title: `${c.title} · ${w.name}`, Author: co.name, Subject: `Certificado ${c.code}` } });
  doc.pipe(out);
  const W = doc.page.width, H = doc.page.height, cx = W / 2;

  // Fondo y marcos
  doc.rect(0, 0, W, H).fill('#fbfaf6');
  doc.save().opacity(.06); for (let r = 40; r < 420; r += 22) doc.circle(cx, H / 2 + 10, r).lineWidth(.6).stroke(BLUE); doc.restore();
  doc.polygon([0, 0], [200, 0], [0, 150]).fill(DEEP);
  doc.polygon([200, 0], [240, 0], [0, 182], [0, 150]).fill(GOLD);
  doc.polygon([0, 182], [0, 200], [265, 0], [240, 0]).fill(BLUE);
  doc.polygon([W, H], [W - 200, H], [W, H - 150]).fill(DEEP);
  doc.polygon([W - 200, H], [W - 240, H], [W, H - 182], [W, H - 150]).fill(GOLD);
  doc.polygon([W, H - 182], [W, H - 200], [W - 265, H], [W - 240, H]).fill(LEAF);
  doc.rect(26, 26, W - 52, H - 52).lineWidth(1.6).stroke(GOLD);
  doc.rect(33, 33, W - 66, H - 66).lineWidth(.5).stroke(BLUE);

  // Encabezado
  const logo = img(co.logo);
  if (logo) doc.image(logo, cx - 32, 44, { fit: [64, 64], align: 'center', valign: 'center' });
  doc.font('Helvetica-Bold').fontSize(10).fillColor(BLUE).text(co.name.toUpperCase(), 0, 114, { width: W, align: 'center', characterSpacing: 3 });
  if (co.tagline) doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(co.tagline, 0, 128, { width: W, align: 'center', characterSpacing: 1 });
  doc.font('Times-Bold').fontSize(44).fillColor(INK).text('CERTIFICADO', 0, 148, { width: W, align: 'center', characterSpacing: 9 });
  doc.font('Helvetica-Bold').fontSize(12).fillColor(GOLD).text(c.title.toUpperCase(), 0, 200, { width: W, align: 'center', characterSpacing: 4 });

  // Destinatario
  doc.font('Helvetica').fontSize(10.5).fillColor(MUTED).text('Se otorga el presente a', 0, 234, { width: W, align: 'center' });
  let size = 34; doc.font('Times-BoldItalic');
  while (doc.fontSize(size).widthOfString(w.name) > 520 && size > 20) size -= 1;
  doc.fontSize(size).fillColor(DEEP).text(w.name, 0, 252 + (34 - size) / 2, { width: W, align: 'center' });
  doc.moveTo(cx - 240, 296).lineTo(cx + 240, 296).lineWidth(1).stroke(GOLD);
  doc.circle(cx, 296, 2.4).fill(GOLD);
  doc.font('Helvetica').fontSize(11).fillColor('#2a3540').text(c.body, cx - 270, 310, { width: 540, align: 'center', lineGap: 3 });

  // Sello del nivel
  const lv = ev ? levelOf(ev.level) : null, sc = lv && lv.k !== 'base' ? lv.c : GOLD;
  const sx = W - 128, sy = 150;
  doc.polygon([sx - 22, sy + 30], [sx - 34, sy + 92], [sx - 18, sy + 82], [sx - 6, sy + 98], [sx + 2, sy + 34]).fill(BLUE);
  doc.polygon([sx + 22, sy + 30], [sx + 34, sy + 92], [sx + 18, sy + 82], [sx + 6, sy + 98], [sx - 2, sy + 34]).fill(DEEP);
  const teeth = []; for (let i = 0; i < 48; i++) { const a = (i / 48) * Math.PI * 2, r = i % 2 ? 46 : 50; teeth.push([sx + r * Math.cos(a), sy + r * Math.sin(a)]); }
  doc.polygon(...teeth).fill(sc);
  doc.circle(sx, sy, 39).lineWidth(1.2).stroke('#ffffff'); doc.circle(sx, sy, 35).lineWidth(.5).stroke('#ffffff');
  const star = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 4.5 : 10; star.push([sx + r * Math.cos(a), sy - 15 + r * Math.sin(a)]); }
  doc.polygon(...star).fill('#ffffff');
  doc.font('Helvetica-Bold').fontSize(lv ? 11 : 8.5).fillColor('#ffffff').text(lv ? lv.t.toUpperCase() : 'CONFIANZA', sx - 40, sy - 1, { width: 80, align: 'center', characterSpacing: 1 });
  doc.font('Helvetica').fontSize(7).text(ev ? `${Math.round(ev.score)} / 100` : c.issued_at.slice(0, 4), sx - 40, sy + 13, { width: 80, align: 'center' });

  // Firmas
  const sig = [[co.signature, co.signer_name, co.signer_role], [co.signature2, co.signer2_name, co.signer2_role]].filter((s) => s[1] || s[2]);
  const xs = sig.length === 1 ? [cx] : [cx - 150, cx + 150];
  sig.forEach(([file, name, role], i) => {
    const x = xs[i], f = img(file);
    if (f) doc.image(f, x - 70, 400, { fit: [140, 52], align: 'center', valign: 'bottom' });
    doc.moveTo(x - 95, 456).lineTo(x + 95, 456).lineWidth(.8).stroke(INK);
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor(INK).text(name || ' ', x - 120, 462, { width: 240, align: 'center' });
    doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(role || '', x - 120, 476, { width: 240, align: 'center' });
  });

  // Verificación
  const q = QRCode.create(url, { errorCorrectionLevel: 'M' }), n = q.modules.size, S = 64, cell = S / n, qx = 52, qy = H - 52 - S;
  doc.rect(qx - 4, qy - 4, S + 8, S + 8).fill('#ffffff');
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (q.modules.data[y * n + x]) doc.rect(qx + x * cell, qy + y * cell, cell + .05, cell + .05);
  doc.fill(INK);
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(INK).text(`Código ${c.code}`, qx + S + 10, qy + 14);
  doc.font('Helvetica').fontSize(7).fillColor(MUTED).text('Verifique su validez escaneando el QR o en', qx + S + 10, qy + 26).text(url.replace(/^https?:\/\//, ''), qx + S + 10, qy + 36);
  doc.font('Helvetica').fontSize(9).fillColor(INK).text(`Lima, ${longDate(c.issued_at)}`, cx - 150, H - 74, { width: 300, align: 'center' });

  if (c.revoked_at) doc.save().rotate(-24, { origin: [cx, H / 2] }).font('Helvetica-Bold').fontSize(110).fillColor('#b3261e').opacity(.18).text('ANULADO', 0, H / 2 - 60, { width: W, align: 'center' }).restore();
  doc.end();
}
