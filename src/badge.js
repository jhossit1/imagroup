// Carné (fotocheck) vertical tamaño tarjeta CR80: 54 × 85.6 mm. Frente con foto y reverso con QR de verificación.
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { sendPdf } from './files.js';
import { starsPdf } from './cert.js';

const W = 153.07, H = 242.65, R = 9, MM = 72 / 25.4;
const INK = '#14202c', BLUE = '#1a5f99', DEEP = '#14324f', GOLD = '#c9a24a', LEAF = '#3d8a37', MUTED = '#5d6874';
const HUES = ['#1a5f99', '#3d8a37', '#c9a24a', '#c2467a', '#2f86cc'];
// Imágenes ya cargadas por files.loadImages (ruta -> data URI) antes de dibujar el carné.
let IMGS = new Map();
const img = (p) => (p && IMGS.get(p)) || null;
export const badgeImages = (d) => [d.co.logo, d.w.photo, d.co.signature];
const dmy = (iso) => iso.slice(0, 10).split('-').reverse().join('/');
const initials = (n) => String(n).trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

function qr(doc, text, x, y, size, color = INK) {
  const q = QRCode.create(text, { errorCorrectionLevel: 'M' }), n = q.modules.size, c = size / n;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) if (q.modules.data[j * n + i]) doc.rect(x + i * c, y + j * c, c + .04, c + .04);
  doc.fill(color);
}

function front(doc, x, y, d) {
  const { b, w, co, trusted, rt } = d;
  doc.save().translate(x, y).roundedRect(0, 0, W, H, R).clip();
  doc.rect(0, 0, W, H).fill('#ffffff');
  doc.rect(0, 0, W, 74).fill(doc.linearGradient(0, 0, W, 74).stop(0, '#2f86cc').stop(1, DEEP));
  doc.polygon([0, 66], [W, 50], [W, 56], [0, 72]).fill(GOLD);
  doc.polygon([0, 72], [W, 56], [W, 60], [0, 76]).fill(LEAF);
  doc.circle(22, 22, 13).fill('#ffffff');
  const logo = img(co.logo); if (logo) doc.image(logo, 13, 12, { fit: [18, 20], align: 'center', valign: 'center' });
  doc.font('Helvetica-Bold').fontSize(7.6).fillColor('#ffffff').text(co.name.toUpperCase(), 40, 14, { width: W - 46, characterSpacing: .8, lineBreak: false });
  doc.font('Helvetica').fontSize(5.6).fillColor('#dbe8f5').text('CARNÉ DE IDENTIFICACIÓN', 40, 25, { width: W - 46, characterSpacing: .6 });

  // Foto o iniciales
  const px = (W - 66) / 2, py = 46, pw = 66, ph = 80, photo = img(w.photo);
  doc.roundedRect(px - 3, py - 3, pw + 6, ph + 6, 10).fill('#ffffff');
  doc.save().roundedRect(px, py, pw, ph, 8).clip();
  if (photo) doc.image(photo, px, py, { cover: [pw, ph], align: 'center', valign: 'center' });
  else { doc.rect(px, py, pw, ph).fill(HUES[w.id % HUES.length]); doc.font('Helvetica-Bold').fontSize(30).fillColor('#ffffff').text(initials(w.name), px, py + 28, { width: pw, align: 'center' }); }
  doc.restore();
  doc.roundedRect(px - 3, py - 3, pw + 6, ph + 6, 10).lineWidth(.6).stroke('#d6dde5');

  if (trusted) {
    const tw = 100, tx = (W - tw) / 2, ty = py + ph - 4;
    doc.roundedRect(tx, ty, tw, 12, 6).fill(LEAF);
    doc.font('Helvetica-Bold').fontSize(5.6).fillColor('#ffffff').text('TRABAJADOR DE CONFIANZA', tx, ty + 3.6, { width: tw, align: 'center', characterSpacing: .5 });
  }

  // Nombre, oficio y zona
  let fs0 = 10.5; doc.font('Helvetica-Bold');
  while (doc.fontSize(fs0).heightOfString(w.name, { width: W - 20 }) > 26 && fs0 > 7.5) fs0 -= .5;
  doc.fontSize(fs0).fillColor(INK).text(w.name, 10, py + ph + (trusted ? 12 : 6), { width: W - 20, align: 'center', lineGap: -1 });
  let yy = doc.y + 2;
  if (w.trade) { doc.font('Helvetica-Bold').fontSize(6.6).fillColor(GOLD).text(w.trade.toUpperCase(), 10, yy, { width: W - 20, align: 'center', characterSpacing: 1 }); yy = doc.y + 1; }
  if (w.zone) { doc.font('Helvetica').fontSize(6).fillColor(MUTED).text(w.zone, 10, yy, { width: W - 20, align: 'center' }); yy = doc.y; }

  // Puntualidad, garantía y calidad (se recalculan cada vez que se descarga)
  const cols = (rt || []).filter((r) => r.v);
  if (cols.length) {
    const y0 = Math.min(Math.max(yy + 5, 172), H - 58), cw = (W - 12) / cols.length;
    cols.forEach((r, i) => {
      const x = 6 + i * cw, sz = 5.4, sw = sz * 1.12 * 4 + sz;
      doc.font('Helvetica-Bold').fontSize(4.8).fillColor(MUTED).text(r.t.toUpperCase(), x, y0, { width: cw, align: 'center', characterSpacing: .4 });
      starsPdf(doc, x + (cw - sw) / 2, y0 + 7, sz, r.v, GOLD);
      doc.font('Helvetica-Bold').fontSize(5.4).fillColor(INK).text(String(r.v).replace('.', ',') + ' / 5', x, y0 + 14.5, { width: cw, align: 'center' });
    });
  }

  // Pie con código, vigencia y QR pequeño
  doc.rect(0, H - 36, W, 36).fill(DEEP);
  doc.rect(0, H - 36, W, 2).fill(GOLD);
  doc.font('Helvetica').fontSize(5.2).fillColor('#9fb6cc').text('N.° DE CARNÉ', 10, H - 28).text('VÁLIDO HASTA', 10, H - 16);
  doc.font('Helvetica-Bold').fontSize(6.6).fillColor('#ffffff').text(b.code, 52, H - 29).text(dmy(b.expires), 52, H - 17);
  doc.roundedRect(W - 34, H - 33, 28, 28, 3).fill('#ffffff');
  qr(doc, d.url, W - 32, H - 31, 24);
  doc.restore();
}

function back(doc, x, y, d) {
  const { b, co, s } = d;
  doc.save().translate(x, y).roundedRect(0, 0, W, H, R).clip();
  doc.rect(0, 0, W, H).fill('#fbfaf6');
  doc.rect(0, 0, W / 3, 5).fill(BLUE); doc.rect(W / 3, 0, W / 3, 5).fill(LEAF); doc.rect((2 * W) / 3, 0, W / 3, 5).fill(GOLD);
  doc.font('Helvetica-Bold').fontSize(8).fillColor(BLUE).text('VERIFIQUE ESTE CARNÉ', 0, 16, { width: W, align: 'center', characterSpacing: 1 });
  const S = 84, qx = (W - S) / 2, qy = 32;
  doc.roundedRect(qx - 6, qy - 6, S + 12, S + 12, 8).fill('#ffffff');
  doc.roundedRect(qx - 6, qy - 6, S + 12, S + 12, 8).lineWidth(1).stroke(GOLD);
  qr(doc, d.url, qx, qy, S);
  doc.font('Helvetica').fontSize(6.6).fillColor(INK).text('Escanee el código con la cámara del celular para comprobar que este carné es válido y que la persona trabaja con nosotros.', 12, 128, { width: W - 24, align: 'center', lineGap: 1 });
  doc.font('Helvetica-Bold').fontSize(6).fillColor(BLUE).text(d.url.replace(/^https?:\/\//, ''), 8, doc.y + 4, { width: W - 16, align: 'center' });
  doc.moveTo(14, doc.y + 5).lineTo(W - 14, doc.y + 5).lineWidth(.4).stroke('#d6dde5');
  doc.font('Helvetica').fontSize(5.8).fillColor(MUTED).text(`Carné personal e intransferible de ${co.name.replace(/\.$/, '')}. Si lo encuentra, por favor llame al ${s.phone_1 || ''}.`, 12, doc.y + 9, { width: W - 24, align: 'center', lineGap: .5 });
  const sig = img(co.signature);
  if (sig) doc.image(sig, W / 2 - 30, H - 50, { fit: [60, 20], align: 'center', valign: 'bottom' });
  doc.moveTo(W / 2 - 40, H - 29).lineTo(W / 2 + 40, H - 29).lineWidth(.5).stroke(INK);
  doc.font('Helvetica').fontSize(5.2).fillColor(MUTED).text(co.signer_name ? `${co.signer_name} · ${co.signer_role || ''}` : co.signer_role || 'Gerencia General', 6, H - 26, { width: W - 12, align: 'center', lineBreak: false });
  doc.font('Helvetica').fontSize(5).fillColor(MUTED).text(`Emitido ${dmy(b.issued_at)}  ·  ${b.code}`, 0, H - 14, { width: W, align: 'center' });
  doc.restore();
}

// hoja = false: PDF de 2 páginas tamaño tarjeta (para imprenta). hoja = true: A4 con ambas caras a tamaño real y marcas de corte.
export function badgePdf(out, d, hoja = false, imgs = new Map()) {
  IMGS = imgs;
  const doc = new PDFDocument(hoja ? { size: 'A4', margin: 0 } : { size: [W, H], margin: 0 });
  doc.info.Title = `Carné ${d.b.code} · ${d.w.name}`; doc.info.Author = d.co.name;
  sendPdf(out, doc);
  if (!hoja) { front(doc, 0, 0, d); doc.addPage({ size: [W, H], margin: 0 }); back(doc, 0, 0, d); }
  else {
    const gap = 12 * MM, x1 = (doc.page.width - (2 * W + gap)) / 2, x2 = x1 + W + gap, y = 120;
    doc.font('Helvetica-Bold').fontSize(14).fillColor(INK).text(`Carné de ${d.w.name}`, 0, 50, { width: doc.page.width, align: 'center' });
    doc.font('Helvetica').fontSize(9).fillColor(MUTED).text('Imprima al 100 % (tamaño real, sin ajustar a la página). Recorte por las marcas, pegue frente y reverso y plastifique.', 60, 72, { width: doc.page.width - 120, align: 'center' });
    front(doc, x1, y, d); back(doc, x2, y, d);
    doc.lineWidth(.4).strokeColor('#9aa5b1');
    for (const x0 of [x1, x2]) for (const [cx, cy] of [[x0, y], [x0 + W, y], [x0, y + H], [x0 + W, y + H]]) {
      const sx = cx === x0 ? -1 : 1, sy = cy === y ? -1 : 1;
      doc.moveTo(cx + sx * 4, cy).lineTo(cx + sx * 16, cy).moveTo(cx, cy + sy * 4).lineTo(cx, cy + sy * 16).stroke();
    }
    doc.font('Helvetica').fontSize(8).fillColor(MUTED).text('FRENTE', x1, y + H + 22, { width: W, align: 'center' }).text('REVERSO', x2, y + H + 22, { width: W, align: 'center' });
  }
  doc.end();
}
