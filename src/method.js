// Método de reconocimiento: escala de calificación anclada en conductas (BARS) con pesos y compuerta de seguridad.
// El sistema solo PROPONE nivel y bono; el administrador decide y aprueba cada reconocimiento.
export const CRITERIA = [
  { k: 's_pun', t: 'Puntualidad', w: 15, c: '#c2467a', d: 'Llega a tiempo y cumple la jornada acordada.',
    a: ['Tardanzas constantes', 'Tardanzas ocasionales', 'Puntual en general', 'Siempre puntual', 'Puntual y disponible cuando se le necesita'] },
  { k: 's_gar', t: 'Garantía', w: 15, c: '#0f8b8d', d: 'Su trabajo dura: no vuelve con fallas y, si algo falla, lo corrige rápido.',
    a: ['Sus trabajos vuelven con fallas seguido', 'Fallas que corrige tarde', 'Pocas fallas y las corrige', 'Sin reclamos después de entregar', 'Sin reclamos y responde de inmediato si se le llama'] },
  { k: 's_cal', t: 'Calidad', w: 20, c: '#3d8a37', d: 'Trabajo bien hecho a la primera, sin rehacer.',
    a: ['Rehace casi todo', 'Errores frecuentes', 'Calidad aceptable', 'Pocos errores, buen acabado', 'Cero retrabajos, acabado ejemplar'] },
  { k: 's_seg', t: 'Seguridad', w: 20, c: '#1a5f99', d: 'Usa su EPP, respeta las charlas de 5 minutos y reporta riesgos.',
    a: ['Incumple normas de seguridad', 'Necesita recordatorios frecuentes', 'Cumple las normas básicas', 'Cumple siempre y cuida a otros', 'Referente de seguridad: previene y corrige'] },
  { k: 's_prod', t: 'Rendimiento', w: 15, c: '#d7b46a', d: 'Avance real frente a la meta del día o de la partida.',
    a: ['Muy por debajo de la meta', 'Por debajo de la meta', 'Cumple la meta', 'Supera la meta', 'Supera la meta con constancia'] },
  { k: 's_equ', t: 'Trabajo en equipo', w: 10, c: '#2f86cc', d: 'Colabora, enseña y mantiene buen trato.',
    a: ['Genera conflictos', 'Colabora poco', 'Colabora cuando se le pide', 'Colabora y apoya', 'Líder natural: enseña y une al equipo'] },
  { k: 's_ord', t: 'Orden y limpieza', w: 5, c: '#7a5a1c', d: 'Herramientas cuidadas y frente de trabajo ordenado (5S).',
    a: ['Desorden y pérdidas', 'Orden irregular', 'Orden aceptable', 'Ordenado y cuida herramientas', 'Ejemplo de 5S en obra'] },
];
const NUM = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho'];
export const N_CRIT = NUM[CRITERIA.length];

// Calificación que sale en el certificado y el carné: promedio de las 3 últimas evaluaciones aprobadas.
export const KEY = ['s_pun', 's_gar', 's_cal'];
export function rating(evals) {
  const ok = evals.filter((e) => e.status === 'aprobado').sort((a, b) => b.period.localeCompare(a.period)).slice(0, 3);
  if (!ok.length) return null;
  return KEY.map((k) => {
    const c = CRITERIA.find((x) => x.k === k), v = ok.map((e) => e[k]).filter(Boolean);
    return { k, t: c.t, c: c.c, v: v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null };
  });
}

export const LEVELS = [
  { k: 'oro', t: 'Oro', name: 'Excelencia', min: 90, c: '#c9a24a' },
  { k: 'plata', t: 'Plata', name: 'Destacado', min: 80, c: '#8e9aa6' },
  { k: 'bronce', t: 'Bronce', name: 'Confiable', min: 70, c: '#b0723e' },
  { k: 'base', t: 'En desarrollo', name: 'En desarrollo', min: 0, c: '#5d6874' },
];
export const levelOf = (k) => LEVELS.find((l) => l.k === k) || LEVELS[3];

// Puntaje 0-100: cada criterio vale (nota / 5) × peso. Con seguridad menor a 3 no hay bono ni nivel.
export function evaluate(scores, s = {}) {
  const score = Math.round(CRITERIA.reduce((t, c) => t + ((Number(scores[c.k]) || 0) / 5) * c.w, 0) * 10) / 10;
  const gate = (Number(scores.s_seg) || 0) >= 3;
  const lv = gate ? LEVELS.find((l) => score >= l.min) : LEVELS[3];
  const soles = { oro: s.bono_oro, plata: s.bono_plata, bronce: s.bono_bronce }[lv.k];
  const bonus = soles ? Math.round(parseFloat(String(soles).replace(',', '.')) * 100) || 0 : 0;
  return { score, level: lv.k, bonus_cents: bonus, gate };
}

export const TRUST_RULE = 'Tres meses aprobados seguidos con 80 puntos o más.';
// Trabajador de confianza: últimos 3 periodos aprobados consecutivos con 80+.
export function isTrusted(evals) {
  const ok = evals.filter((e) => e.status === 'aprobado').sort((a, b) => b.period.localeCompare(a.period)).slice(0, 3);
  if (ok.length < 3 || ok.some((e) => e.score < 80)) return false;
  const m = (p) => { const [y, mo] = p.split('-').map(Number); return y * 12 + mo; };
  return m(ok[0].period) - m(ok[2].period) === 2;
}

export const MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const periodName = (p) => (p ? `${MES[+p.slice(5, 7) - 1]} ${p.slice(0, 4)}` : '');
