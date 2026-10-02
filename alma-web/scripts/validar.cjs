// Validación automática del prototipo contra los requisitos del cliente
// (recursos/cliente/INSTRUCCIONES FINALES.png) y el Brand Book.
//
// Uso: con la app corriendo (npm run dev), en otra terminal:
//   npm run validar
// Requiere un Chromium de Playwright (npx playwright install chromium)
// o la ruta a Chrome en CHROME_PATH.
const { chromium } = require('playwright-core');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:5173';
const results = [];
const ok = (id, pass, detail = '') => { results.push({ id, pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${id}${detail ? '  — ' + detail : ''}`); };
// Pendiente: depende de configuración externa, no del código.
const pend = (id, detail = '') => { results.push({ id, pass: true, pend: true, detail }); console.log(`PEND  ${id}${detail ? '  — ' + detail : ''}`); };
const clp = (s) => Number(String(s).replace(/\D/g, ''));

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, args: ['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream'] });
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 1024 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error' && !/501/.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));

  // ---------- 3) Inicio: cara de Alma, fondo claro, hablarle o ver funciones ----------
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  const home = await page.evaluate(() => ({
    face: !!document.querySelector('.face-btn .alma-live img[src*="alma-hd"]'),
    bg: getComputedStyle(document.body).backgroundColor,
    nav: !!document.querySelector('.main-nav'),
    talkLabel: document.querySelector('.face-btn')?.getAttribute('aria-label'),
  }));
  ok('R3 Inicio muestra la cara de Alma', home.face);
  ok('R3 Fondo claro', home.bg === 'rgb(247, 238, 238)', home.bg);
  ok('R3 Inicio sin menú de funciones a la vista (solo la cara)', !home.nav);
  ok('R3 Tocar la cara = hablarle', home.talkLabel === 'Hablar con Alma', home.talkLabel);
  await page.click('text=Ver funciones');
  const tiles = await page.$$eval('.fn-tile strong', els => els.map(e => e.innerText));
  ok('R3 "Ver funciones" abre sus funciones', tiles.length === 6, tiles.join(', '));
  await page.click('.fn-tile >> text=Inventario');
  await page.waitForURL('**/inventario');
  ok('R3 Funciones navegan a su sección', page.url().endsWith('/inventario'));

  // ---------- 1) Voz: habla desde la cara y mueve la boca ----------
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('alma:v1')); s.voice = false; localStorage.setItem('alma:v1', JSON.stringify(s)); });
  await page.reload({ waitUntil: 'networkidle' });
  await page.click('text=¿Cuánto gané limpio hoy?');
  await page.waitForSelector('.face-btn .alma-live.is-speaking', { timeout: 3000 }).catch(() => {});
  const m1 = await page.evaluate(() => ({ speaking: !!document.querySelector('.face-btn .alma-live.is-speaking'), opacity: document.querySelector('.face-btn .alma-mouth')?.style.opacity }));
  const frames = new Set();
  for (let i = 0; i < 6; i++) { frames.add(await page.evaluate(() => document.querySelector('.face-btn .alma-mouth path:nth-of-type(4)')?.getAttribute('d'))); await page.waitForTimeout(90); }
  ok('R1 Al hablar, la boca de Alma se anima', m1.speaking && m1.opacity === '1' && frames.size > 2, `speaking=${m1.speaking} opacity=${m1.opacity} posiciones de boca distintas=${frames.size}`);
  // Con voz activada pero sin voces en el equipo (caso de este navegador de pruebas), igual debe moverse.
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('alma:v1')); s.voice = true; localStorage.setItem('alma:v1', JSON.stringify(s)); });
  await page.reload({ waitUntil: 'networkidle' });
  await page.click('text=¿Qué tengo que encargar?');
  const fb = await page.waitForSelector('.face-btn .alma-live.is-speaking', { timeout: 3000 }).then(() => true).catch(() => false);
  ok('R1 Si la voz del equipo falla, la boca se mueve igual', fb);
  const bubble = await page.$eval('.speech p', e => e.innerText);
  ok('R1 Lo que dice aparece en el globo junto a su cara', /encarga|acabando|surtidos/.test(bubble), bubble.slice(0, 70) + '…');
  const tts = await page.evaluate(async () => (await fetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"text":"hola"}' })).status);
  if (tts === 501) pend('R1 Voz natural en la nube', 'falta clave AZURE/ELEVENLABS/OPENAI en .env.local; hoy usa la voz del dispositivo');
  else ok('R1 Voz natural en la nube responde', tts === 200, 'status ' + tts);

  // Tecnicismos y modismos en lo que Alma dice
  const spoken = await page.evaluate(async () => {
    const { answer, buildContext, SUGGESTED_QUESTIONS } = await import('/src/lib/alma.js');
    const { lastWeekSales } = await import('/src/data/seed.js');
    const state = JSON.parse(localStorage.getItem('alma:v1'));
    const ctx = buildContext({ state, lastWeek: lastWeekSales(state.dateKey) });
    const extra = ['hola', 'qué falta', 'cuánto me debe gladys', 'anota dos cocas y un pan', 'qué es lo más vendido', 'cuánto hay en la caja'];
    return [...SUGGESTED_QUESTIONS, ...extra].map(q => answer(q, ctx).text);
  });
  const all = spoken.join(' ').toLowerCase();
  const tech = ['margen', 'ticket', 'kpi', 'utilidad', 'rentabilidad', 'liquidez', 'flujo de caja', 'ebitda', 'roi'].filter(w => all.includes(w));
  ok('R1 Respuestas sin tecnicismos financieros', tech.length === 0, tech.length ? 'encontrado: ' + tech.join(', ') : `${spoken.length} respuestas revisadas`);
  const idioms = ['al tiro', 'harto', 'la once', 'casero', 'pues', 'vecino'].filter(w => all.includes(w));
  ok('R1 Modismos chilenos presentes, sin exagerar', idioms.length >= 2, idioms.join(', '));

  // ---------- 5) Notificaciones push simuladas ----------
  await page.goto(BASE + '/hoy', { waitUntil: 'networkidle' });
  const p1 = await page.waitForSelector('.push strong', { timeout: 12000 }).then(e => e.innerText()).catch(() => null);
  ok('R5 Push 1: pedir más pan', /pan/i.test(p1 || ''), p1);
  await page.click('.push >> text=Más tarde');
  const p2 = await page.waitForSelector('.push strong', { timeout: 20000 }).then(e => e.innerText()).catch(() => null);
  ok('R5 Push 2: ajustar precio arroz Banquete', /Arroz Banquete/i.test(p2 || ''), p2);
  const btn = await page.$eval('.push .btn-pink', e => e.innerText);
  await page.click('.push .btn-pink');
  const arroz = await page.evaluate(() => JSON.parse(localStorage.getItem('alma:v1')).products.find(p => p.id === 'p13').price);
  ok('R5 Acción del push aplica el cambio', clp(btn) === arroz, `${btn} → precio guardado $${arroz}`);

  // ---------- 4) Inventario: se descuenta solo y se pueden sumar unidades ----------
  const stockOf = () => page.evaluate(() => JSON.parse(localStorage.getItem('alma:v1')).products.find(p => p.id === 'p1').stock);
  const before = await stockOf();
  await page.goto(BASE + '/vender', { waitUntil: 'networkidle' });
  await page.fill('#voice-input', 'dos cocas y medio kilo de marraqueta');
  await page.press('#voice-input', 'Enter');
  await page.waitForTimeout(300);
  const lines = await page.$$eval('.ticket-lines li .tl-name strong', els => els.map(e => e.innerText));
  ok('R4 Pedido dictado entra a la boleta', lines.includes('Coca-Cola 350 ml') && lines.includes('Pan Marraqueta'), lines.join(', '));
  await page.click('.segmented >> text=Débito');
  await page.click('.pay .btn-pink');
  await page.waitForTimeout(300);
  const after = await stockOf();
  ok('R4 Stock se descuenta automáticamente al vender', after === before - 2, `Coca-Cola ${before} → ${after}`);
  await page.goto(BASE + '/inventario', { waitUntil: 'networkidle' });
  await page.click('[aria-label="Sumar stock de Coca-Cola 350 ml"]');
  await page.waitForTimeout(150);
  const plus = await stockOf();
  ok('R4 Se pueden añadir unidades', plus === after + 1, `${after} → ${plus}`);

  // Productos a granel: peso exacto escrito con números
  await page.goto(BASE + '/vender', { waitUntil: 'networkidle' });
  await page.click('.product-tile:has-text("Pan Hallulla")');
  await page.fill('.weigh-input input', '0,735');
  const weighTotal = await page.$eval('.weigh-total strong', e => e.innerText);
  await page.click('text=Agregar a la boleta');
  await page.waitForTimeout(200);
  const line = await page.evaluate(() => {
    const li = [...document.querySelectorAll('.ticket-lines li')].find(l => l.innerText.includes('Pan Hallulla'));
    return li && { w: li.querySelector('.weight-field input').value, total: li.querySelector('.tl-total').innerText };
  });
  ok('R4 Vender: peso exacto escrito con números (0,735 kg)', line?.w === '0,735' && line?.total === '$1.617' && weighTotal === '$1.617', line ? `${line.w} kg → ${line.total}` : 'sin línea');
  await page.fill('[aria-label="Peso de Pan Hallulla en kilos"]', '500 g');
  await page.press('[aria-label="Peso de Pan Hallulla en kilos"]', 'Enter');
  await page.waitForTimeout(200);
  const edited = await page.evaluate(() => [...document.querySelectorAll('.ticket-lines li')].find(l => l.innerText.includes('Pan Hallulla'))?.querySelector('.tl-total').innerText);
  ok('R4 Vender: se corrige el peso en la boleta ("500 g")', edited === '$1.100', edited);
  await page.click('.product-tile:has-text("Palta Hass")');
  await page.fill('.weigh .field:nth-of-type(2) input', '1000');
  const byMoney = await page.$eval('.weigh-input input', e => e.value);
  ok('R4 Vender: peso calculado desde la plata ("una luca")', byMoney === '0,2', `$1.000 de palta → ${byMoney} kg`);
  await page.keyboard.press('Escape');

  // ---------- 2) Cámara: abrir webcam, enseñar y reconocer ----------
  await page.goto(BASE + '/vender', { waitUntil: 'networkidle' });
  await page.click('text=Escanear con cámara');
  const camReady = await page.waitForSelector('.teach-hold:not([disabled])', { timeout: 25000 }).then(() => true).catch(() => false);
  ok('R2 Abre la cámara y carga el reconocimiento', camReady);
  const rows = await page.$$eval('.teach-name strong', els => els.map(e => e.innerText));
  ok('R2 Trae los 3 productos pedidos para enseñar', ['Arroz Banquete 1 kg', 'Coca-Cola 350 ml', 'Galletas Morocha'].every(n => rows.includes(n)), rows.slice(1).join(', '));
  if (camReady) {
    const holds = await page.$$('.teach-hold');
    for (const i of [0, 1]) { const b = await holds[i].boundingBox(); await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down(); await page.waitForTimeout(1800); await page.mouse.up(); }
    const saved = await page.evaluate(() => Object.fromEntries(Object.entries(JSON.parse(localStorage.getItem('alma:vision:v1') || '{}')).map(([k, v]) => [k, v.length])));
    ok('R2 Aprende y guarda fotos en el dispositivo', Object.values(saved).every(n => n >= 8), JSON.stringify(saved));
    await page.click('text=¡Listo, a escanear!');
    await page.waitForTimeout(1500);
    ok('R2 Bucle de reconocimiento corre sin errores', !errors.some(e => /vision|embed|mediapipe/i.test(e)));
  }
  await page.keyboard.press('Escape');

  // ---------- 6) Dashboard al cerrar el día ----------
  await page.goto(BASE + '/cierre', { waitUntil: 'networkidle' });
  const dash = await page.evaluate(() => ({
    vendido: document.querySelector('.big-total strong')?.innerText,
    limpio: document.querySelector('.profit strong')?.innerText,
    compara: [...document.querySelectorAll('.compare-item .stat-label')].map(e => e.innerText),
    promedio: document.querySelector('.big-total .vs')?.innerText,
    arqueo: !!document.querySelector('.arqueo'), chart: document.querySelectorAll('.hourly-col').length, top: document.querySelectorAll('.top-list li').length,
  }));
  ok('R6 Muestra cuánto vendiste', !!dash.vendido, dash.vendido);
  ok('R6 Muestra ganancia/margen', !!dash.limpio, dash.limpio);
  ok('R6 Compara con un día promedio', /día normal/.test(dash.promedio || '') && dash.compara.length === 4, dash.promedio);
  ok('R6 Datos clave: arqueo, horas, más vendidos', dash.arqueo && dash.chart === 14 && dash.top > 0, `arqueo, ${dash.chart} horas, top ${dash.top}`);
  await page.click('.page-head >> text=Cerrar el día');
  await page.click('text=Sí, cerrar el día');
  await page.waitForTimeout(300);
  ok('R6 Cierre guarda el día y reinicia la caja', await page.isVisible('text=Abrir el día'));
  await page.click('text=Abrir el día');

  // ---------- Marca (Brand Book) ----------
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  const brand = await page.evaluate(async () => {
    await document.fonts.ready;
    const css = [...document.styleSheets].flatMap(s => { try { return [...s.cssRules].map(r => r.cssText); } catch { return []; } }).join('\n');
    return {
      fonts: ['Anton', 'Nunito', 'Yellowtail'].map(f => [f, [...document.fonts].some(ff => ff.family.replace(/"/g, '') === f && ff.status === 'loaded')]),
      pink: getComputedStyle(document.documentElement).getPropertyValue('--pink').trim(),
      gradients: (css.match(/linear-gradient|radial-gradient/g) || []).length,
      logo: !!document.querySelector('.header-logo img[src*="logo"]'),
    };
  });
  ok('Marca: tipografías cargadas (titulares, cuerpo, apoyo)', brand.fonts.every(([, v]) => v), brand.fonts.map(([f, v]) => `${f}:${v ? 'sí' : 'no'}`).join(' '));
  ok('Marca: rosado Alma plano #FD0551', String(brand.pink).toLowerCase().includes('fd0551'));
  ok('Marca: logo oficial en el encabezado', brand.logo);
  console.log(`INFO  gradientes en CSS: ${brand.gradients} (fondos decorativos, no detrás del logo)`);

  // ---------- Responsive: sin scroll horizontal ----------
  const routes = ['/', '/vender', '/inventario', '/fiados', '/hoy', '/cierre'];
  for (const [w, h, name] of [[1366, 1024, 'iPad 13" horizontal'], [1024, 1366, 'iPad vertical'], [390, 844, 'celular']]) {
    await page.setViewportSize({ width: w, height: h });
    const bad = [];
    for (const r of routes) { await page.goto(BASE + r, { waitUntil: 'networkidle' }); const sw = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); if (sw > 1) bad.push(`${r}(+${sw}px)`); }
    ok(`Responsive ${name}: sin desborde`, bad.length === 0, bad.join(' '));
  }

  ok('Sin errores de consola', errors.length === 0, errors.slice(0, 3).join(' | '));
  const fails = results.filter(r => !r.pass);
  const pends = results.filter(r => r.pend);
  console.log(`\nTOTAL ${results.length - fails.length - pends.length} PASS · ${fails.length} FAIL · ${pends.length} PENDIENTE`);
  process.exitCode = fails.length ? 1 : 0;
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
