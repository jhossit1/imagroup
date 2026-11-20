// Dibuja una página del diseñador con sus bloques (la usan el sitio público y la vista previa del panel).
import { all, settings } from './db.js';
import * as V from './views.js';
import { blocksOf, pagePath } from './pages.js';
import { renderBlock, needsShop } from './blocks.js';

export const visibleProducts = () => all(`SELECT p.*, c.name AS category, c.slug AS cslug FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.visible = 1 ORDER BY c.sort, p.sort`);
export const pageCtx = (req) => ({ s: settings(), companies: all('SELECT * FROM companies ORDER BY sort'), services: all('SELECT * FROM services WHERE visible = 1 ORDER BY sort'),
  products: visibleProducts(), projects: all('SELECT * FROM projects WHERE visible = 1 ORDER BY sort'), categories: all('SELECT * FROM categories ORDER BY sort'),
  q: String(req.query.q || '').trim().slice(0, 60), c: String(req.query.c || '').slice(0, 40), asunto: String(req.query.asunto || '').slice(0, 140) });

export function renderPage(req, p, which = 'published', preview = '') {
  const blocks = blocksOf(p, which), ctx = pageCtx(req);
  return V.layout(ctx.s, { title: p.system === 'inicio' ? '' : p.title, desc: p.description, path: pagePath(p), theme: needsShop(blocks) ? 'shop' : '', preview,
    body: blocks.map((b) => renderBlock(b, ctx, !!preview)).join('') || (preview ? '<section class="wrap bk-empty"><p>Esta página está vacía. Agrega un bloque desde el panel.</p></section>' : '') });
}
