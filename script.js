/* =========================================================
   KZORA — script.js
   Vanilla ES6+ e Three.js (via import map no index.html)
   ========================================================= */

/* ---------------------------------------------------------
   CONFIGURAÇÃO — edite aqui com os dados reais da KZORA
   --------------------------------------------------------- */
const CONFIG = {
  // Link de checkout (loja, Mercado Pago, WhatsApp etc.).
  // Vazio: os botões "Comprar" levam ao formulário com o assunto "Quero comprar o cartão".
  checkoutUrl: '',

  // Endpoint que recebe o formulário via POST (JSON), ex.: Formspree, API própria.
  // Vazio: o formulário abre o WhatsApp da KZORA com a mensagem já preenchida.
  contactEndpoint: '',

  // WhatsApp da KZORA (somente números, com DDI e DDD)
  whatsapp: '5585997391318',

  // Canal alternativo exibido se o envio pelo endpoint falhar.
  // abre a DM do Instagram; o parâmetro text pré-preenche a mensagem onde o Instagram aceita
  instagramDm: 'https://ig.me/m/kzoralabs?text=Ol%C3%A1%21%20Vim%20pelo%20site%20da%20KZORA%20e%20quero%20saber%20mais%20sobre%20o%20cart%C3%A3o%20NFC.',

  // Dados do responsável exibidos no rodapé (Decreto 7.962/2013: nome e CPF ou CNPJ e
  // endereço em sites que vendem pela internet). Enquanto vazios, a linha não aparece.
  // Sem CNPJ (pessoa física): use o nome completo e documentType 'CPF'.
  // Com MEI/empresa: razão social e documentType 'CNPJ'.
  company: {
    legalName: 'Kauã Sousa da Silva', // responsável (pessoa física, ainda sem CNPJ)
    documentType: 'CPF',  // 'CPF' ou 'CNPJ'
    document: '',        // CPF só quando o site tiver pagamento direto; ex.: '000.000.000-00'
    address: 'Croatá - CE',
  },
};

// MARCADORES PROVISÓRIOS: substitua pelos nomes, cargos e fotos reais da equipe.
// photo: caminho da imagem (ex.: 'assets/equipe/nome.jpg'). Vazio exibe uma silhueta.
// placeholder: true exibe o selo "Marcador provisório".
const TEAM = [
  { name: '[Nome do integrante]', role: '[Cargo]', bio: 'Descrição a confirmar pela KZORA.', photo: '', placeholder: true },
  { name: '[Nome do integrante]', role: '[Cargo]', bio: 'Descrição a confirmar pela KZORA.', photo: '', placeholder: true },
  { name: '[Nome do integrante]', role: '[Cargo]', bio: 'Descrição a confirmar pela KZORA.', photo: '', placeholder: true },
  { name: '[Nome do integrante]', role: '[Cargo]', bio: 'Descrição a confirmar pela KZORA.', photo: '', placeholder: true },
];

// Preencha SOMENTE com dados reais e verificáveis. Lista vazia mantém o bloco oculto.
// Valores numéricos (ex.: '+500', '98%', '2,5 mil') ganham contador animado.
// Exemplo: { value: '+500', label: 'clientes atendidos' }
const RESULTS = [];

// Preencha SOMENTE com depoimentos reais e autorizados. Lista vazia mantém o bloco oculto.
// Exemplo: { quote: 'Texto do cliente', author: 'Nome', business: 'Estabelecimento' }
const TESTIMONIALS = [];

/* --------------------------------------------------------- */

const doc = document.documentElement;
// as animações rodam para todos, independentemente da opção "Efeitos de animação" do
// sistema (prefers-reduced-motion), a pedido da KZORA
const reduceMotion = false;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
// aparelhos modestos ou telas pequenas recebem menos partículas, menos resolução e menos desfoque
const LOW_POWER = reduceMotion
  || (navigator.hardwareConcurrency || 8) <= 4
  || (navigator.deviceMemory || 8) <= 4
  || window.matchMedia('(max-width: 768px)').matches;
if (LOW_POWER) doc.classList.add('low-power');

/* Modo leve: liga sozinho quando o WebGL falha (sinal de renderização sem GPU) ou quando a
   página fica abaixo de ~40 fps por 2 s. Desliga os efeitos mais caros para a CPU; a
   abertura, as animações e a interação continuam iguais. */
let LITE = false;
const liteFns = [];
function enterLite() {
  if (LITE) return;
  LITE = true;
  doc.classList.add('lite', 'low-power');
  liteFns.forEach((fn) => fn());
}

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));
const damp = (dt, rate) => 1 - Math.exp(-dt * rate); // lerp independente da taxa de quadros
const nowS = () => performance.now() / 1000;

const escapeHtml = (str = '') =>
  String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------------------------------------------------------
   Ticker único: um só requestAnimationFrame para todos os
   sistemas animados (fundo, parallax, cartão 3D, contadores).
   O navegador pausa o rAF quando a aba fica em segundo plano.
   --------------------------------------------------------- */
const ticker = (() => {
  const fns = new Set();
  // com GSAP, tudo roda no mesmo requestAnimationFrame da linha do tempo da abertura
  const g = window.gsap;
  if (g) {
    // animações seguem o relógio real: em aparelhos lentos a abertura termina no tempo previsto
    // (com lagSmoothing, quadros longos faziam a linha do tempo andar só 33 ms por quadro)
    g.ticker.lagSmoothing(0);
    let prev = performance.now();
    g.ticker.add(() => {
      const ms = performance.now();
      const dt = Math.min((ms - prev) / 1000, 0.05);
      prev = ms;
      fns.forEach((fn) => fn(dt, ms / 1000));
    });
    return { add(fn) { fns.add(fn); }, remove(fn) { fns.delete(fn); } };
  }
  let running = false;
  let last = 0;
  const loop = (ms) => {
    const dt = Math.min((ms - last) / 1000, 0.05);
    last = ms;
    const t = ms / 1000;
    fns.forEach((fn) => fn(dt, t));
    if (fns.size) requestAnimationFrame(loop);
    else running = false;
  };
  return {
    add(fn) {
      fns.add(fn);
      if (!running) {
        running = true;
        last = performance.now();
        requestAnimationFrame(loop);
      }
    },
    remove(fn) { fns.delete(fn); },
  };
})();

// estado compartilhado de rolagem e ponteiro
const scrollState = { y: window.scrollY, smooth: window.scrollY, vh: window.innerHeight, max: 1 };
const heroPointer = { x: 0, y: 0, sx: 0, sy: 0, inside: false, last: -10 };

/* ---------- Toast ---------- */
const toastEl = $('#toast');
let toastTimer;
function toast(message) {
  toastEl.textContent = message;
  toastEl.hidden = false;
  requestAnimationFrame(() => toastEl.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.classList.remove('show');
    setTimeout(() => (toastEl.hidden = true), 400);
  }, 4200);
}

/* ---------- Header, menu e progresso ---------- */
function initHeader() {
  const header = $('.site-header');
  const toggle = $('.menu-toggle');
  const nav = $('#menu');
  const bar = $('.scroll-progress span');

  const measure = () => {
    scrollState.vh = window.innerHeight;
    scrollState.max = Math.max(1, doc.scrollHeight - window.innerHeight);
  };
  const onScroll = () => {
    scrollState.y = window.scrollY;
    header.classList.toggle('scrolled', scrollState.y > 24);
    bar.style.transform = `scaleX(${clamp(scrollState.y / scrollState.max)})`;
  };
  measure();
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => { measure(); onScroll(); });
  // a altura do documento muda com fontes, imagens e blocos preenchidos via JS
  new ResizeObserver(() => { measure(); onScroll(); }).observe(document.body);

  const setOpen = (open) => {
    nav.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    document.body.style.overflow = open ? 'hidden' : '';
  };
  toggle.addEventListener('click', () => setOpen(!nav.classList.contains('open')));
  nav.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('open')) { setOpen(false); toggle.focus(); }
  });
  window.matchMedia('(min-width: 881px)').addEventListener('change', (e) => { if (e.matches) setOpen(false); });

  // âncoras internas: rolagem suave compensando o header fixo
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href^="#"]');
    if (!link) return;
    const id = link.getAttribute('href');
    if (id.length < 2) return;
    const target = $(id);
    if (!target) return;
    e.preventDefault();
    const top = target.getBoundingClientRect().top + window.scrollY - (id === '#inicio' ? 0 : 64);
    smoothScrollTo(Math.max(0, Math.min(top, scrollState.max)));
    history.replaceState(null, '', id);
  });

  // rolagem animada até a seção: duração proporcional à distância (0,7 a 1,6 s) e curva
  // de aceleração e desaceleração suave; girar a roda ou tocar na tela interrompe
  let scrollAnim = 0;
  const easeInOutCubic = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  function smoothScrollTo(to) {
    cancelAnimationFrame(scrollAnim);
    const from = window.scrollY;
    const dist = to - from;
    if (Math.abs(dist) < 2) return;
    const dur = clamp(0.55 + Math.abs(dist) / 4000, 0.7, 1.6) * 1000;
    const t0 = performance.now();
    const stop = () => {
      cancelAnimationFrame(scrollAnim);
      window.removeEventListener('wheel', stop);
      window.removeEventListener('touchstart', stop);
      window.removeEventListener('keydown', stop);
    };
    window.addEventListener('wheel', stop, { passive: true });
    window.addEventListener('touchstart', stop, { passive: true });
    window.addEventListener('keydown', stop);
    const step = (now) => {
      const k = clamp((now - t0) / dur);
      // behavior 'instant' evita conflito com o scroll-behavior: smooth do CSS
      window.scrollTo({ top: from + dist * easeInOutCubic(k), behavior: 'instant' });
      if (k < 1) scrollAnim = requestAnimationFrame(step);
      else stop();
    };
    scrollAnim = requestAnimationFrame(step);
  }

  // link ativo conforme a seção visível
  const links = $$('.main-nav ul a');
  const sections = links.map((a) => $(a.getAttribute('href'))).filter(Boolean);
  const spy = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      links.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === `#${entry.target.id}`));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  sections.forEach((s) => spy.observe(s));
}

/* =========================================================
   Abertura (intro) — controla o estado do hero
   'full'  : primeira visita da sessão, sequência completa (~6 s)
   'short' : retorno na mesma sessão, entrada curta (~1,3 s)
   'none'  : movimento reduzido ou sem WebGL, conteúdo imediato
   Não bloqueia a rolagem: rolar, Esc ou "Explorar site" encerram.
   ========================================================= */
// verificação leve: criar um contexto de teste aqui travava a página (~0,8 s esperando a GPU)
// enquanto o script carregava; se o contexto real falhar, o cartão CSS assume
function webglAvailable() {
  return 'WebGLRenderingContext' in window;
}

const HAS_WEBGL = webglAvailable();

// o Three.js começa a baixar já, em paralelo ao restante da inicialização
const threeReady = !reduceMotion && HAS_WEBGL
  ? Promise.all([
    import('three'),
    import('three/addons/environments/RoomEnvironment.js'),
  ]).catch((err) => { console.warn('Three.js indisponível, usando imagem estática.', err); return null; })
  : Promise.resolve(null);

const TAU = Math.PI * 2;
const smoother = (x) => x * x * x * (x * (x * 6 - 15) + 10);
const heroEl = $('.hero');

/* =========================================================
   Abertura do hero (≈4,4 s, sem bloquear nada)
   Uma única linha do tempo GSAP escreve em `introPose`; o cartão Three.js
   e o cartão CSS (sem WebGL) apenas leem esse estado. A mesma linha do
   tempo revela os textos e marca o tempo das chamadas ao redor do cartão.
     0,0–1,3 s  o cartão vem de longe (escuro, pequeno) até a posição final
     0,25–2,3 s giro 3D completo, com aceleração e desaceleração
     1,0 s      título, descrição e botões entram em sequência
     1,9–3,25 s chamadas aparecem uma a uma; somem juntas em 3,9 s
   ========================================================= */
const FINAL_YAW = -0.18;
// mix: 0 = cartão grande no centro da tela, 1 = cartão no lugar dele no hero
const introPose = { z: 0, yaw: FINAL_YAW, pitch: 0.05, roll: 0.05, lift: 0, light: 1, mix: 1 };
// celular e tablet: a abertura começa só com o cartão grande no centro; depois ele diminui,
// vai para o lugar dele e só então aparecem as informações
const BIG_INTRO = window.matchMedia('(max-width: 1180px)').matches
  || window.matchMedia('(hover: none) and (pointer: coarse)').matches;
// seq: chamadas uma por vez (sem espaço nas laterais), cada uma visível por seqHold segundos
const INTRO = { reveal: 1.0, poseEnd: 2.3, callouts: [1.9, 2.35, 2.8, 3.25], fadeAt: 4.9, end: 5.4, seq: false, seqHold: 0.55 };
if (BIG_INTRO) {
  // 0–2,3 s cartão grande girando; 2,3–3,1 s diminui até o lugar; 3,25 s em diante, informações
  Object.assign(INTRO, { reveal: 2.5, poseEnd: 3.1, callouts: [3.25, 3.6, 3.95, 4.3], fadeAt: 5.8, end: 6.3, shrinkAt: 2.3 });
}

const intro = (() => {
  const gsap = window.gsap;
  let mode = !reduceMotion && gsap ? 'full' : 'none';
  let revealed = false;
  let finished = false;
  let poseDone = false;
  const poseFns = [];
  const finishFns = [];

  const ctl = {
    get mode() { return mode; },
    get playing() { return !finished; },
    get poseDone() { return poseDone; },
    started: false,
    tl: null,
    time() { return ctl.tl && !finished ? ctl.tl.time() : INTRO.end; },
    onPoseDone(fn) { if (poseDone) fn(); else poseFns.push(fn); },
    onFinish(fn) { if (finished) fn(); else finishFns.push(fn); },
    revealHero() {
      if (revealed) return;
      revealed = true;
      heroEl.classList.add('intro-reveal');
      $$('.hero .reveal').forEach((el) => el.classList.add('is-visible'));
    },
    setPoseDone() {
      if (poseDone) return;
      poseDone = true;
      Object.assign(introPose, { z: 0, yaw: FINAL_YAW, pitch: 0.05, roll: 0.05, lift: 0, light: 1, mix: 1 });
      poseFns.splice(0).forEach((fn) => fn());
    },
    finish() {
      if (finished) return;
      ctl.revealHero();
      ctl.setPoseDone();
      finished = true;
      heroEl.classList.remove('intro-on');
      heroEl.classList.add('intro-done');
      hideCallouts();
      finishFns.splice(0).forEach((fn) => fn());
    },
    start() {
      if (!ctl.tl || ctl.started) return;
      ctl.started = true;
      // decide o modo das chamadas (lado a lado ou uma por vez) e fecha a duração da abertura
      planCallouts();
      ctl.tl.set({}, {}, INTRO.end);
      heroEl.classList.add('intro-started');
      ctl.tl.play(0);
      // garantia: se o aparelho travar, a abertura termina sozinha pouco depois do previsto
      setTimeout(() => { if (!finished) { ctl.tl.progress(1); ctl.finish(); } }, (INTRO.end + 3) * 1000);
    },
    skip() {
      if (finished) return;
      if (ctl.tl && ctl.started) ctl.tl.timeScale(7);
      else { if (ctl.tl) ctl.tl.progress(1); ctl.finish(); }
    },
  };

  if (mode === 'full') {
    heroEl.classList.add('intro-on');
    $('.hero-visual')?.classList.add('is-visible');
    Object.assign(introPose, { z: -22, yaw: FINAL_YAW - TAU - 0.7, pitch: 0.38, roll: -0.22, lift: -0.55, light: 0, mix: BIG_INTRO ? 0 : 1 });
    const tl = gsap.timeline({
      paused: true,
      onComplete: () => ctl.finish(),
    });
    tl.to(introPose, { z: 0, lift: 0, duration: 1.3, ease: 'power3.out' }, 0)
      .to(introPose, { light: 1, duration: 1.05, ease: 'power2.out' }, 0.15)
      .to(introPose, { yaw: FINAL_YAW, duration: 2.05, ease: 'power3.inOut' }, 0.25)
      .to(introPose, { pitch: 0.05, roll: 0.05, duration: 1.7, ease: 'power2.out' }, 0.45)
      .call(() => ctl.revealHero(), null, INTRO.reveal)
      .call(() => ctl.setPoseDone(), null, INTRO.poseEnd);
    if (BIG_INTRO) tl.to(introPose, { mix: 1, duration: INTRO.poseEnd - INTRO.shrinkAt, ease: 'power3.inOut' }, INTRO.shrinkAt);
    ctl.tl = tl;

    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') ctl.skip(); });
    window.addEventListener('scroll', () => { if (window.scrollY > 40) ctl.skip(); }, { passive: true });
    // com WebGL, a abertura começa quando o cartão 3D estiver pronto (shaders compilados);
    // se ele não chegar em 4 s (rede lenta), o cartão CSS faz a abertura inteira e o 3D só
    // assume no final, sem troca no meio da animação. Sem WebGL, começa no próximo quadro.
    if (HAS_WEBGL) setTimeout(() => ctl.start(), 4000);
    else requestAnimationFrame(() => requestAnimationFrame(() => ctl.start()));
  } else {
    // movimento reduzido ou GSAP indisponível: conteúdo imediato
    queueMicrotask(() => ctl.finish());
  }
  return ctl;
})();

/* ---------- Chamadas da abertura (compartilhadas pelo cartão 3D e pelo CSS) ---------- */
const callouts = $$('.callout').map((el, i) => ({
  el,
  line: $$('.intro-lines polyline')[i],
  dot: $$('.intro-lines circle')[i],
  side: i === 0 || i === 3 ? 'L' : 'R',
  w: 0,
  h: 0,
  shown: true,
}));
function measureCallouts() {
  callouts.forEach((c) => { c.w = c.el.offsetWidth; c.h = c.el.offsetHeight; });
}
function hideCallouts() {
  callouts.forEach((c) => {
    c.shown = false;
    c.el.style.opacity = '0';
    c.line.style.opacity = '0';
    c.dot.style.opacity = '0';
  });
}
// posição de layout (ignora transforms) de um elemento dentro do hero
function boxInHero(el) {
  let x = 0;
  let y = 0;
  for (let e = el; e && e !== heroEl; e = e.offsetParent) { x += e.offsetLeft; y += e.offsetTop; }
  return { x, y, w: el.offsetWidth, h: el.offsetHeight };
}
// medidas de layout em cache: lê-las a cada quadro, logo após escrever estilos, forçava um
// layout completo por quadro. Só são recalculadas quando o tamanho muda.
let viewCache = null;
const boxCache = new Map();
const invalidateLayoutCache = () => { viewCache = null; boxCache.clear(); calloutSlots = null; };
window.addEventListener('resize', invalidateLayoutCache);
new ResizeObserver(invalidateLayoutCache).observe(heroEl);
// retângulos reais do texto do hero (título, descrição, botões), em px do hero. Cada chamada
// da esquerda só precisa desviar das linhas de texto na própria altura dela.
function heroTextRects() {
  const hr = heroEl.getBoundingClientRect();
  const range = document.createRange();
  const rects = [];
  // posição final do texto: desconta os deslocamentos das animações de entrada (o texto pode
  // estar no meio da animação quando a medida é feita)
  const shift = (el) => {
    let dx = 0;
    let dy = 0;
    for (let e = el; e && e !== heroEl; e = e.parentElement) {
      const tf = getComputedStyle(e).transform;
      if (tf && tf !== 'none') {
        const m = new DOMMatrixReadOnly(tf);
        dx += m.m41;
        dy += m.m42;
      }
    }
    return [dx, dy];
  };
  const add = (r, [dx, dy]) => {
    if (r.width) rects.push([r.top - dy - hr.top, r.bottom - dy - hr.top, r.right - dx - hr.left]);
  };
  $$('.hero-copy h1, .hero-copy .lead, .hero-copy .eyebrow').forEach((el) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.textContent.trim()) continue;
      const d = shift(node.parentElement);
      range.selectNodeContents(node);
      [...range.getClientRects()].forEach((r) => add(r, d));
    }
  });
  $$('.hero-ctas .btn, .hero-strip').forEach((el) => add(el.getBoundingClientRect(), shift(el)));
  return rects;
}
function calloutView() {
  if (viewCache) return viewCache;
  const narrow = heroEl.clientWidth < 760;
  const rects = narrow ? [] : heroTextRects();
  viewCache = {
    w: heroEl.clientWidth, h: heroEl.clientHeight, narrow,
    // faixa visível durante a abertura (a página está no topo): abaixo do header e acima
    // do botão "Explorar site"
    top: ($('.site-header')?.offsetHeight || 64) + 12,
    bottom: Math.min(heroEl.clientHeight, window.innerHeight) - (narrow ? 84 : 20),
    bottomSeq: Math.min(heroEl.clientHeight, window.innerHeight) - 84,
    // limite esquerdo para uma chamada ocupando [y, y + h] (margem vertical de 18 px)
    minXAt(y, h) {
      if (narrow) return 6;
      let right = 0;
      rects.forEach(([t, b, r]) => { if (t < y + h + 18 && b > y - 18) right = Math.max(right, r); });
      return right ? right + 16 : 16;
    },
  };
  return viewCache;
}
function cachedBox(el) {
  let b = boxCache.get(el);
  if (!b) { b = boxInHero(el); boxCache.set(el, b); }
  return b;
}
// anchors: pontos no cartão (px do hero); box: centro e meia largura/altura do cartão
const CALLOUT_GAP = 52;   // distância entre o cartão e a chamada
const CALLOUT_SPACE = 20; // espaço mínimo entre chamadas
let calloutSlots = null;  // posições fixas das chamadas (recalculadas só quando o tamanho muda)

/* Calcula onde cada chamada fica, considerando as 4 de uma vez.
   Cada uma fica no seu lado (2 à esquerda, 2 à direita), na altura livre mais próxima do ponto
   indicado (sem encostar no texto do hero, na borda da tela ou em outra chamada).
   Retorna seq = true quando alguma não cabe nas laterais: aí elas aparecem uma por vez sobre o
   cartão (celular e tablets em que o cartão ocupa a largura). */
function computeCalloutSlots(anchors, box, view) {
  if (!callouts[0].w) measureCallouts();
  // etiquetas compactas (celular/tablet sem espaço): bem junto do cartão
  const compact = view.narrow || heroEl.classList.contains('callouts-compact');
  const gap = compact ? 12 : CALLOUT_GAP;
  const minGap = compact ? 6 : 16;
  const edgeMargin = compact ? 6 : 12;
  const cardLeft = box.cx - box.hw;
  const cardRight = box.cx + box.hw;
  const items = callouts.map((c, i) => ({
    i, c, ax: anchors[i][0], ay: anchors[i][1], dir: c.side === 'L' ? -1 : 1, ly: anchors[i][1] - c.h / 2,
  }));
  const placed = [];
  const fitsAt = (it, side, y) => {
    const { c } = it;
    if (y < view.top || y + c.h > view.bottom) return false;
    if (placed.some((q) => q.dir === side && y < q.ly + q.c.h + CALLOUT_SPACE && q.ly < y + c.h + CALLOUT_SPACE)) return false;
    if (side < 0) return cardLeft - minGap - c.w >= view.minXAt(y, c.h);
    return cardRight + minGap + c.w <= view.w - edgeMargin;
  };
  const slots = [];
  let seq = false;
  items.slice().sort((a, b) => a.ly - b.ly).forEach((it) => {
    let found = null;
    let side = it.dir;
    for (const s of [it.dir]) { // cada uma no seu lado: 2 à esquerda, 2 à direita
      for (let d = 0; d <= 280 && found === null; d += 6) {
        if (fitsAt(it, s, it.ly + d)) found = it.ly + d;
        else if (fitsAt(it, s, it.ly - d)) found = it.ly - d;
      }
      if (found !== null) { side = s; break; }
    }
    if (found === null) { seq = true; return; }
    it.dir = side;
    it.ly = found;
    placed.push(it);
    slots[it.i] = {
      dir: side,
      ly: found,
      lx: side < 0
        ? Math.max(cardLeft - gap - it.c.w, view.minXAt(found, it.c.h))
        : Math.min(cardRight + gap, view.w - it.c.w - edgeMargin),
      // trocou de lado: o ponto de uma borda do cartão é espelhado para a outra
      mirror: (side > 0 && it.ax < cardLeft + box.hw * 0.4) || (side < 0 && it.ax > cardRight - box.hw * 0.4),
    };
  });
  return { seq, slots };
}

/* Desenha as chamadas da abertura. Lado a lado: posições fixas de computeCalloutSlots.
   Modo sequencial: uma por vez, centralizada no cartão, perto do ponto indicado e sempre
   dentro da faixa visível da tela. */
// edges (opcional): ponto na borda do cartão, do lado da chamada, na altura do recurso.
// Nas chamadas laterais o ponto e a linha ficam ao lado do cartão, sem cobrir a arte.
function drawCallouts(el, anchors, box, view, edges) {
  // as posições são calculadas quando a primeira chamada aparece (cartão já perto, no lugar);
  // antes disso o cartão ainda está longe e pequeno e as medidas sairiam erradas
  if (el < INTRO.callouts[0] - 0.05) {
    if (callouts.some((c) => c.shown)) hideCallouts();
    return;
  }
  if (!calloutSlots) calloutSlots = computeCalloutSlots(anchors, box, view);
  const seq = INTRO.seq || calloutSlots.seq;
  callouts.forEach((c, i) => {
    const at = INTRO.callouts[i];
    // a última chamada (ou todas, lado a lado) fica 1 s a mais na tela antes de sumir
    const last = i === callouts.length - 1;
    const outAt = seq ? at + INTRO.seqHold + (last ? 1 : 0) : INTRO.fadeAt;
    const v = smoother(Math.min(clamp((el - at) / 0.3), 1 - clamp((el - outAt) / 0.22)));
    if (v <= 0.001) {
      if (c.shown) {
        c.shown = false;
        c.el.style.opacity = '0';
        c.line.style.opacity = '0';
        c.dot.style.opacity = '0';
      }
      return;
    }
    if (!c.w) measureCallouts();
    c.shown = true;
    let [ax, ay] = anchors[i];
    let pts;
    let x;
    let y;
    const slot = !seq && calloutSlots.slots[i];
    if (slot) {
      const { dir } = slot;
      if (edges) [ax, ay] = edges[i];
      else if (slot.mirror) ax = box.cx - (ax - box.cx);
      x = slot.lx;
      y = slot.ly;
      const pad = view.narrow ? 3 : 8;
      const edge = dir < 0 ? x + c.w + pad : x - pad;
      const my = y + c.h / 2;
      const elbow = edge - dir * (view.narrow ? 4 : 22);
      pts = `${ax.toFixed(1)},${ay.toFixed(1)} ${elbow.toFixed(1)},${my.toFixed(1)} ${edge.toFixed(1)},${my.toFixed(1)}`;
      x += dir * (1 - v) * 18;
    } else {
      // sobre o cartão: logo abaixo (ou acima) do ponto, dentro da faixa visível
      const bottom = Math.min(view.bottom, view.bottomSeq);
      x = clamp(box.cx - c.w / 2, 12, view.w - c.w - 12);
      y = ay + 26;
      if (y + c.h > bottom) y = ay - 26 - c.h;
      y = clamp(y, view.top, Math.max(view.top, bottom - c.h));
      const below = y > ay;
      const lineX = clamp(ax, x + 14, x + c.w - 14);
      const end = below ? y - 4 : y + c.h + 4;
      pts = `${ax.toFixed(1)},${ay.toFixed(1)} ${lineX.toFixed(1)},${end.toFixed(1)}`;
      y += (below ? 1 : -1) * (1 - v) * 10;
    }
    c.el.style.opacity = v.toFixed(3);
    c.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    c.line.setAttribute('points', pts);
    c.line.style.opacity = '1';
    c.line.style.strokeDashoffset = (1 - clamp(v * 1.4)).toFixed(3);
    c.dot.setAttribute('cx', ax.toFixed(1));
    c.dot.setAttribute('cy', ay.toFixed(1));
    c.dot.style.opacity = v.toFixed(3);
  });
}

// antes da abertura começar: estima, pelo espaço do cartão, se as chamadas cabem nas laterais.
// Se não couberem, elas aparecem uma por vez, com mais tempo cada (abertura ~0,6 s mais longa).
function planCallouts() {
  const view = calloutView();
  const stage = $('#cardStage');
  // celular: etiquetas compactas; mede de novo depois de trocar o estilo
  heroEl.classList.toggle('callouts-compact', view.narrow);
  measureCallouts();
  let seq = false;
  if (stage) {
    const s = boxInHero(stage);
    const hh = Math.min(s.h / 1.34, (s.w / 1.9) * (1218 / 768)) / 2;
    const hw = hh * (768 / 1218);
    const box = { cx: s.x + s.w / 2, cy: s.y + s.h / 2, hw, hh };
    const ANCH = [[0.505, 0.89], [0.49, 0.52], [0.885, 0.385], [0.0, 0.42]];
    const anchors = ANCH.map(([u, v]) => [box.cx - hw + u * 2 * hw, box.cy - hh + v * 2 * hh]);
    seq = computeCalloutSlots(anchors, box, view).seq;
    // não couberam do tamanho normal: tenta as etiquetas compactas antes de mostrar uma por vez
    if (seq && !view.narrow) {
      heroEl.classList.add('callouts-compact');
      measureCallouts();
      seq = computeCalloutSlots(anchors, box, view).seq;
      if (seq) { heroEl.classList.remove('callouts-compact'); measureCallouts(); }
    }
  }
  if (seq) {
    INTRO.seq = true;
    if (BIG_INTRO) {
      INTRO.callouts = [3.25, 4.0, 4.75, 5.5];
      INTRO.fadeAt = 7.1;
      INTRO.end = 7.35;
    } else {
      INTRO.callouts = [1.9, 2.65, 3.4, 4.15];
      INTRO.fadeAt = 5.7;
      INTRO.end = 6.0;
    }
  }
}

/* =========================================================
   Cartão 3D (Three.js)
   Frente: fotografia real do cartão KZORA, retificada.
   O canvas fica sobre o espaço do cartão (#cardStage). A pose da abertura
   vem de `introPose` (linha do tempo GSAP); o verso é uma superfície
   neutra em grafite (sem arte inventada).
   ========================================================= */
async function initCard3D() {
  const hero = $('.hero');
  const layer = $('.hero-3d');
  const stage = $('#cardStage');
  const canvas = $('#cardCanvas');
  if (!layer || !stage || !HAS_WEBGL) { intro.start(); return; }

  const mods = await threeReady;
  if (!mods) { intro.start(); return; }
  const [THREE, { RoomEnvironment }] = mods;

  // o contexto é criado uma única vez aqui e entregue ao Three.js; se o navegador não
  // tiver WebGL (aceleração de hardware desligada), o cartão CSS assume em modo leve
  const glOpts = { antialias: true, alpha: true, powerPreference: 'high-performance' };
  const gl = canvas.getContext('webgl2', glOpts) || canvas.getContext('webgl', glOpts);
  if (!gl) { enterLite(); intro.start(); return; }
  // WebGL emulado por software (sem placa de vídeo): cada quadro 3D leva segundos;
  // o cartão CSS assume no modo leve
  const dbgInfo = gl.getExtension('WEBGL_debug_renderer_info');
  const glRenderer = dbgInfo ? String(gl.getParameter(dbgInfo.UNMASKED_RENDERER_WEBGL)) : '';
  if (/swiftshader|llvmpipe|softpipe|software|basic render/i.test(glRenderer)) {
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    enterLite();
    intro.start();
    return;
  }
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, context: gl, antialias: true, alpha: true });
  } catch (err) {
    console.warn('WebGL indisponível, usando o cartão CSS.', err);
    enterLite();
    intro.start();
    return;
  }
  // celular/tablet: telas de alta densidade precisam de até 2x para o cartão ficar nítido
  const BASE_PR = Math.min(window.devicePixelRatio || 1, BIG_INTRO ? 2 : 1.25);
  const PR_MIN = BIG_INTRO ? Math.min(BASE_PR, 1.25) : 0.5;
  let pixelRatio = BASE_PR;
  renderer.setPixelRatio(pixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  const D = 12;
  const vTan = Math.tan(THREE.MathUtils.degToRad(15));

  // dimensões proporcionais à foto retificada (768 x 1218)
  const W = 2.4;
  const H = W * (1218 / 768);
  const R = W * 0.056;
  const T = 0.065; // espessura visível de perfil (sem parecer papel)

  const shape = new THREE.Shape();
  shape.moveTo(-W / 2 + R, -H / 2);
  shape.lineTo(W / 2 - R, -H / 2);
  shape.quadraticCurveTo(W / 2, -H / 2, W / 2, -H / 2 + R);
  shape.lineTo(W / 2, H / 2 - R);
  shape.quadraticCurveTo(W / 2, H / 2, W / 2 - R, H / 2);
  shape.lineTo(-W / 2 + R, H / 2);
  shape.quadraticCurveTo(-W / 2, H / 2, -W / 2, H / 2 - R);
  shape.lineTo(-W / 2, -H / 2 + R);
  shape.quadraticCurveTo(-W / 2, -H / 2, -W / 2 + R, -H / 2);

  const bevel = 0.018; // borda arredondada: o reflexo corre pela lateral e dá volume
  const bodyGeo = new THREE.ExtrudeGeometry(shape, {
    depth: T, curveSegments: 24, bevelEnabled: true,
    bevelThickness: bevel, bevelSize: bevel, bevelSegments: 6,
  });
  bodyGeo.translate(0, 0, -T / 2);

  // corpo preto fosco e lateral acobreada, como a borda visível na foto
  // verso: grafite acetinado com textura fina e filete acobreado, nas cores da página.
  // Representação neutra (sem logotipo, textos ou QR Code), já que não há foto do verso real.
  const backTex = (() => {
    const cw = 512;
    const ch = Math.round(cw * (H / W));
    const c = document.createElement('canvas');
    c.width = cw;
    c.height = ch;
    const g = c.getContext('2d');
    const base = g.createLinearGradient(0, 0, cw, ch);
    base.addColorStop(0, '#4a4b50');
    base.addColorStop(0.5, '#38393e');
    base.addColorStop(1, '#2b2c30');
    g.fillStyle = base;
    g.fillRect(0, 0, cw, ch);
    // granulado fino, como o acabamento texturizado da frente
    const img = g.getImageData(0, 0, cw, ch);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 18;
      img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
    }
    g.putImageData(img, 0, 0);
    // filete acobreado interno
    const inset = cw * 0.045;
    const rr = cw * 0.04;
    g.strokeStyle = 'rgba(214,112,52,0.75)';
    g.lineWidth = 2.5;
    g.beginPath();
    g.roundRect(inset, inset, cw - inset * 2, ch - inset * 2, rr);
    g.stroke();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  // a tampa traseira da extrusão fica coberta pelo verso com shader (abaixo)
  const capMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1d, roughness: 0.6, metalness: 0.3 });
  const edgeMat = new THREE.MeshStandardMaterial({ color: 0xc8622a, roughness: 0.24, metalness: 0.95, envMapIntensity: 1.6 });
  const body = new THREE.Mesh(bodyGeo, [capMat, edgeMat]);

  // frente com a fotografia do cartão real (UV na proporção exata da arte)
  const faceGeo = new THREE.ShapeGeometry(shape, 24);
  const pos = faceGeo.attributes.position;
  const uv = faceGeo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, (pos.getX(i) + W / 2) / W, (pos.getY(i) + H / 2) / H);
  }
  uv.needsUpdate = true;

  const texture = await new Promise((resolve, reject) => {
    new THREE.TextureLoader().load('assets/kzora-cartao-frente.jpg', resolve, undefined, reject);
  }).catch(() => null);
  if (!texture) { renderer.dispose(); intro.start(); return; }
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

  const faceMat = new THREE.MeshPhysicalMaterial({
    map: texture, roughness: 0.58, metalness: 0.05,
    clearcoat: 0.35, clearcoatRoughness: 0.3, envMapIntensity: 0.55,
  });
  const face = new THREE.Mesh(faceGeo, faceMat);
  face.position.z = T / 2 + bevel + 0.0015;

  /* Shaders que reagem ao giro (uAngle = rotação acumulada do cartão):
     - verso: grafite com brilho alaranjado que "pega" a luz do fundo, faixa de luz que
       atravessa a superfície conforme gira e borda (fresnel) acesa de perfil;
     - frente: reflexo sutil que só passa durante o giro, sem cobrir a arte do cartão. */
  const fxUniforms = { uAngle: { value: 0 }, uTime: { value: 0 }, uLight: { value: 1 }, uSweep: { value: 0 } };
  const FX_VERT = `
    varying vec2 vUv;
    varying vec3 vN;
    varying vec3 vV;
    void main() {
      vUv = uv;
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vN = normalize(mat3(modelMatrix) * normal);
      vV = normalize(cameraPosition - wp.xyz);
      gl_Position = projectionMatrix * viewMatrix * wp;
    }`;
  const backMat = new THREE.ShaderMaterial({
    uniforms: { ...fxUniforms, uMap: { value: backTex } },
    vertexShader: FX_VERT,
    fragmentShader: `
      uniform sampler2D uMap;
      uniform float uAngle;
      uniform float uTime;
      uniform float uLight;
      varying vec2 vUv;
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        vec3 base = texture2D(uMap, vUv).rgb;
        float ndv = clamp(dot(normalize(vN), normalize(vV)), 0.0, 1.0);
        float fres = pow(1.0 - ndv, 2.2);
        float turn = fract(uAngle / 6.2831853);
        // faixa de luz diagonal que atravessa o verso acompanhando o giro
        float band = vUv.x * 0.8 + vUv.y * 0.6 - (turn * 2.8 - 0.9);
        float streak = exp(-band * band * 16.0);
        // brilho alaranjado do fundo, que muda de lado conforme o ângulo
        vec2 c = vec2(0.5 + 0.55 * sin(uAngle), 0.3 + 0.15 * cos(uAngle * 0.5));
        float glow = smoothstep(0.95, 0.0, distance(vUv, c));
        // fluxo lento, para a superfície nunca parecer estática
        float flow = 0.5 + 0.5 * sin(vUv.y * 7.0 + uTime * 0.7 + sin(vUv.x * 5.0 - uTime * 0.5) * 1.3);
        vec3 orange = vec3(1.0, 0.36, 0.02);
        // valores em espaço linear: pequenos, para não estourar após o tone mapping
        vec3 col = base * (0.7 + 0.5 * ndv);
        col += orange * (glow * 0.05 + fres * 0.12) * (0.7 + 0.3 * flow);
        col += vec3(1.0, 0.8, 0.6) * streak * 0.07;
        gl_FragColor = vec4(col * uLight, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const back = new THREE.Mesh(faceGeo, backMat);
  back.rotation.y = Math.PI;
  back.position.z = -(T / 2 + bevel + 0.0015);

  const glossMat = new THREE.ShaderMaterial({
    uniforms: { ...fxUniforms, uMap: { value: texture } },
    vertexShader: FX_VERT,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fragmentShader: `
      uniform sampler2D uMap;
      uniform float uLight;
      uniform float uSweep;
      varying vec2 vUv;
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        float ndv = clamp(dot(normalize(vN), normalize(vV)), 0.0, 1.0);
        float fres = pow(1.0 - ndv, 3.0);
        // faixa de luz que acompanha o ângulo do cartão (arraste, balanço e cursor)
        float band = (vUv.x + vUv.y) * 0.7 - uSweep;
        float streak = exp(-band * band * 14.0);
        float core = exp(-band * band * 90.0);
        // máscara metálica: só letras prateadas/laranja, QR e estrelas brilham;
        // o fundo preto do cartão fica intacto
        vec3 tex = texture2D(uMap, vUv).rgb;
        float lum = dot(tex, vec3(0.299, 0.587, 0.114));
        float metal = smoothstep(0.12, 0.5, lum);
        vec3 col = vec3(1.0, 0.45, 0.1) * fres * 0.1;
        col += tex * metal * (streak * 0.4 + core * 0.55);
        col += vec3(1.0, 0.9, 0.78) * metal * core * 0.15;
        gl_FragColor = vec4(col * uLight, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const gloss = new THREE.Mesh(faceGeo, glossMat);
  gloss.position.z = face.position.z + 0.001;

  // pontos de reflexo da arte original (u, v na foto): acendem quando a faixa de luz passa
  const SPARKS = [
    [0.775, 0.782, 1.0],  // canto do "AVALIE"
    [0.684, 0.566, 0.9],  // QR, canto superior direito
    [0.700, 0.487, 0.6],  // QR, lateral direita
    [0.306, 0.392, 0.85], // QR, canto inferior esquerdo
    [0.684, 0.392, 0.65], // QR, canto inferior direito
    [0.345, 0.945, 0.7],  // topo do símbolo KZORA
    [0.610, 0.105, 0.55], // estrela prateada
  ];
  const sparkTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const glow = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    glow.addColorStop(0, 'rgba(255,240,220,1)');
    glow.addColorStop(0.12, 'rgba(255,190,130,.55)');
    glow.addColorStop(0.4, 'rgba(255,120,40,.12)');
    glow.addColorStop(1, 'rgba(255,100,20,0)');
    g.fillStyle = glow;
    g.fillRect(0, 0, 128, 128);
    // raios em cruz, como os reflexos da foto
    g.globalCompositeOperation = 'lighter';
    [[128, 5], [72, 3]].forEach(([len, w], k) => {
      g.save();
      g.translate(64, 64);
      g.rotate(k * Math.PI / 4);
      for (let i = 0; i < 2; i++) {
        const ray = g.createLinearGradient(-len / 2, 0, len / 2, 0);
        ray.addColorStop(0, 'rgba(255,220,180,0)');
        ray.addColorStop(0.5, 'rgba(255,245,230,.95)');
        ray.addColorStop(1, 'rgba(255,220,180,0)');
        g.fillStyle = ray;
        g.fillRect(-len / 2, -w / 2, len, w);
        g.rotate(Math.PI / 2);
      }
      g.restore();
    });
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const sparks = SPARKS.map(([u, v, size], i) => {
    const m = new THREE.SpriteMaterial({
      map: sparkTex, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, opacity: 0,
    });
    const sp = new THREE.Sprite(m);
    sp.position.set((u - 0.5) * W, (v - 0.5) * H, face.position.z + 0.02);
    sp.userData = { u, v, size: size * 0.42, phase: i * 1.7 };
    return sp;
  });
  const cardNormal = new THREE.Vector3();
  const toCam = new THREE.Vector3();

  const card = new THREE.Group();
  card.add(body, face, back, gloss, ...sparks);
  const pivot = new THREE.Group();
  pivot.add(card);
  scene.add(pivot);

  // iluminação de estúdio: luz principal suave + recortes alaranjados
  const ambient = new THREE.AmbientLight(0xffffff, 0.35);
  const key = new THREE.DirectionalLight(0xffffff, 1.1);
  key.position.set(-3, 4, 6);
  const rim = new THREE.PointLight(0xff6600, 40, 14, 2);
  const under = new THREE.PointLight(0xff7a2a, 18, 10, 2);
  scene.add(ambient, key, rim, under);

  // reflexo que percorre as bordas metálicas e luz que varre a face na abertura
  const sweep = new THREE.PointLight(0xffe6cc, 0, 1.5, 2);
  const scan = new THREE.PointLight(0xfff1e2, 0, 2.6, 2);
  card.add(sweep, scan);
  const perimeter = 2 * (W + H);
  const setOnEdge = (u, light) => {
    let d = (u % 1) * perimeter;
    const z = T / 2 + 0.22;
    if (d < W) return light.position.set(-W / 2 + d, H / 2, z);
    d -= W;
    if (d < H) return light.position.set(W / 2, H / 2 - d, z);
    d -= H;
    if (d < W) return light.position.set(W / 2 - d, -H / 2, z);
    d -= W;
    return light.position.set(-W / 2, -H / 2 + d, z);
  };

  const makeSprite = (stops) => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    stops.forEach(([o, col]) => grad.addColorStop(o, col));
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  };
  const emberTex = makeSprite([[0, 'rgba(255,200,140,1)'], [0.3, 'rgba(255,120,30,.8)'], [1, 'rgba(255,90,0,0)']]);
  const glowTex = makeSprite([[0, 'rgba(255,110,20,.9)'], [0.45, 'rgba(255,90,0,.25)'], [1, 'rgba(255,80,0,0)']]);
  const plane = new THREE.PlaneGeometry(1, 1);
  const additive = (opacity) => new THREE.MeshBasicMaterial({
    map: glowTex, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending,
  });

  // halo pulsante atrás do cartão e brilho no "chão" que acompanha a flutuação
  const haloMat = additive(0);
  const halo = new THREE.Mesh(plane, haloMat);
  const floorMat = additive(0);
  const floor = new THREE.Mesh(plane, floorMat);
  scene.add(halo, floor);

  // partículas: segundo plano (atrás) e primeiro plano (perto da câmera)
  const makeEmbers = (count, zMin, zMax, size, opacity) => {
    const g = new THREE.BufferGeometry();
    const arr = new Float32Array(count * 3);
    const speed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 16;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 10;
      arr[i * 3 + 2] = zMin + Math.random() * (zMax - zMin);
      speed[i] = 0.12 + Math.random() * 0.3;
    }
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({
      size, map: emberTex, transparent: true, opacity,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    pts.userData.speed = speed;
    scene.add(pts);
    return pts;
  };
  const emberSets = reduceMotion ? [] : [
    makeEmbers(LOW_POWER ? 40 : 90, -6, -0.5, 0.08, 1),
    makeEmbers(LOW_POWER ? 6 : 14, 3, 7, 0.14, 0.5),
  ];

  /* --- chamadas da abertura --- */
  // âncoras em coordenadas locais do cartão, medidas sobre a arte retificada
  const FACE_Z = T / 2 + bevel;
  const ANCHORS = [
    { p: [0.02, -0.387 * H, FACE_Z], side: 'L', v: 'below' }, // estrelas
    { p: [-0.03, -0.05 * H, FACE_Z], side: 'R', v: 'above' }, // QR Code
    { p: [0.385 * W, 0.114 * H, FACE_Z], side: 'R', v: 'above' }, // símbolo de aproximação
    { p: [-W / 2 - bevel, 0.1 * H, 0], side: 'L', v: 'below' }, // borda metálica
  ];
  const anchorVecs = ANCHORS.map((a) => new THREE.Vector3(...a.p));
  // mesma altura do recurso, logo fora da borda do cartão no lado da chamada
  const edgeVecs = ANCHORS.map((a) => new THREE.Vector3((a.side === 'L' ? -1 : 1) * (W / 2 + bevel + 0.05), a.p[1], 0));

  /* --- layout: centro da abertura e posição final (espaço do #cardStage) --- */
  const L = { w: 1, h: 1, visW: 1, visH: 1, ppw: 1, cx: 0, cy: 0, cs: 1, fx: 0, fy: 0, fs: 1, narrow: false, bx: 0, by: 0, bw: 1, bh: 1 };
  // fora da abertura o canvas encolhe para uma caixa ao redor do cartão; setViewOffset
  // mantém a mesma projeção do hero inteiro, então a imagem não muda, só o custo cai
  // o canvas fica sempre na caixa ao redor do cartão; setViewOffset mantém a projeção do hero
  // na abertura grande (celular/tablet) o canvas cobre o hero; depois volta para a caixa
  let boxed = !(BIG_INTRO && intro.mode === 'full' && !intro.poseDone);
  function applyViewport() {
    camera.aspect = L.w / L.h;
    if (boxed) {
      canvas.style.cssText = `left:${L.bx}px;top:${L.by}px;width:${L.bw}px;height:${L.bh}px;right:auto;bottom:auto`;
      renderer.setSize(L.bw, L.bh, false);
      camera.setViewOffset(L.w, L.h, L.bx, L.by, L.bw, L.bh);
    } else {
      canvas.style.cssText = '';
      renderer.setSize(L.w, L.h, false);
      camera.clearViewOffset();
    }
    camera.updateProjectionMatrix();
  }
  function layout() {
    L.w = layer.clientWidth;
    L.h = layer.clientHeight;
    if (!L.w || !L.h) return;
    L.visH = 2 * D * vTan;
    L.visW = L.visH * camera.aspect;
    L.ppw = L.h / L.visH;
    // offsets ignoram transforms (parallax e reveal) e dão a posição de layout real
    let x = 0;
    let y = 0;
    for (let el = stage; el && el !== hero; el = el.offsetParent) { x += el.offsetLeft; y += el.offsetTop; }
    const sw = stage.offsetWidth;
    const sh = stage.offsetHeight;
    L.fx = x + sw / 2;
    L.fy = y + sh / 2;
    L.fs = Math.min((sh / 1.34) / (H * L.ppw), (sw / 1.9) / (W * L.ppw));
    const bw = Math.round(sw * 1.6);
    const bh = Math.round(sh * 1.5);
    L.bx = clamp(Math.round(L.fx - bw / 2), 0, L.w - 1);
    L.by = clamp(Math.round(L.fy - bh / 2), 0, L.h - 1);
    L.bw = Math.min(bw, L.w - L.bx);
    L.bh = Math.min(bh, L.h - L.by);
    L.narrow = L.w < 760;
    const vh = Math.min(L.h, window.innerHeight);
    const headerH = $('.site-header').offsetHeight || 70;
    L.cx = L.w / 2;
    L.cy = (headerH + vh) / 2;
    // tamanho do cartão grande no centro (abertura no celular/tablet)
    L.cs = Math.min((vh - headerH) * 0.7 / (H * L.ppw), L.w * 0.78 / (W * L.ppw));
    measureCallouts();
    applyViewport();
  }
  new ResizeObserver(layout).observe(hero);
  window.addEventListener('resize', layout);
  layout();

  const perf = new Float32Array(30);
  let perfN = 0;
  let warm = 45; // primeiros quadros ignorados (envio de texturas e shaders)
  let done = intro.poseDone || reduceMotion;

  /* --- interação após a abertura ---
     segurar e arrastar (mouse ou dedo): giro livre de 360° com inércia;
     termina sempre de frente (múltiplo de uma volta) */
  const follow = { x: 0, y: 0 };
  const drag = { active: false, id: null, lx: 0, ly: 0, ry: 0, rx: 0, vel: 0, lastMove: 0 };
  const tween = { on: false, from: 0, to: 0, start: 0, dur: 1, ease: smoother };
  const easeOut = (x) => 1 - Math.pow(1 - x, 3);
  let lastInteract = -10;
  let autoW = 0;
  let autoT = 0;
  const mark = () => { lastInteract = nowS(); };
  const spinTo = (to, ease, minDur = 0.5) => {
    tween.on = true;
    tween.from = drag.ry;
    tween.to = to;
    tween.start = nowS();
    tween.dur = clamp((Math.abs(to - drag.ry) / TAU) * 1.4, minDur, 1.8);
    tween.ease = ease;
    drag.vel = 0;
    mark();
  };
  const spin = (dir = 1) => {
    const base = tween.on ? tween.to : Math.round(drag.ry / TAU) * TAU;
    spinTo(base + dir * TAU, smoother, 1.2);
  };
  intro.onPoseDone(() => {
    done = true;
    autoW = 0;
    autoT = 0;
    if (!boxed) {
      boxed = true;
      applyViewport();
    }
  });

  // segurar e arrastar (botão do mouse ou dedo): giro livre de 360° com inércia;
  // ao soltar, completa a volta na direção do gesto ou volta à frente mais próxima
  const rotateBy = (dx) => {
    tween.on = false;
    const d = clamp(dx, -40, 40) * 0.012; // limita saltos bruscos
    drag.ry += d;
    drag.vel = d * 60;
    drag.lastMove = nowS();
    mark();
  };
  const settle = () => {
    const fresh = nowS() - drag.lastMove < 0.12;
    const to = fresh && Math.abs(drag.vel) > 1.5
      ? (drag.vel > 0 ? Math.ceil(drag.ry / TAU) : Math.floor(drag.ry / TAU)) * TAU
      : Math.round(drag.ry / TAU) * TAU;
    spinTo(to, easeOut);
  };

  stage.addEventListener('pointerdown', (e) => {
    if (!done) { intro.skip(); return; }
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    drag.active = true;
    drag.id = e.pointerId;
    drag.lx = e.clientX;
    drag.ly = e.clientY;
    drag.vel = 0;
    stage.setPointerCapture?.(e.pointerId);
    mark();
  });
  stage.addEventListener('pointermove', (e) => {
    if (!drag.active || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.lx;
    const dy = e.clientY - drag.ly;
    drag.lx = e.clientX;
    drag.ly = e.clientY;
    rotateBy(dx);
    if (e.pointerType === 'mouse') drag.rx = clamp(drag.rx + dy * 0.005, -0.45, 0.45);
  });
  const endDrag = (e) => {
    if (e.pointerId !== drag.id || !drag.active) return;
    drag.active = false;
    settle();
  };
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag); // rolagem vertical no toque assume o gesto

  // teclado: setas dão uma volta para cada lado
  stage.tabIndex = 0;
  stage.setAttribute('aria-label', 'Cartão KZORA em 3D. Clique e arraste, arraste com o dedo ou use as setas para girar.');
  stage.addEventListener('keydown', (e) => {
    if (!done) return;
    if (e.key === 'ArrowRight') { spin(1); e.preventDefault(); }
    if (e.key === 'ArrowLeft') { spin(-1); e.preventDefault(); }
  });

  // pausa quando o hero sai da tela
  let visible = true;
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }).observe(layer);

  const v3 = new THREE.Vector3();
  const toWX = (px) => (px / L.w - 0.5) * L.visW;
  const toWY = (py) => (0.5 - py / L.h) * L.visH;
  // projeta um ponto do mundo para px do hero (considerando a caixa do setViewOffset)
  const toHero = (vec) => {
    vec.project(camera);
    if (!boxed) return [(vec.x + 1) / 2 * L.w, (1 - vec.y) / 2 * L.h];
    return [L.bx + (vec.x + 1) / 2 * L.bw, L.by + (1 - vec.y) / 2 * L.bh];
  };
  const cardBox3D = () => {
    const [cx, cy] = toHero(v3.copy(pivot.position));
    return { cx, cy, hw: (W / 2) * pivot.scale.x * L.ppw, hh: (H / 2) * pivot.scale.x * L.ppw };
  };
  const anchors3D = () => anchorVecs.map((a) => toHero(card.localToWorld(v3.copy(a))));
  const edges3D = () => edgeVecs.map((a) => toHero(card.localToWorld(v3.copy(a))));

  let needsResize = false;
  function frame(dt, t) {
    if (!visible) return;
    if (needsResize) {
      needsResize = false;
      renderer.setPixelRatio(pixelRatio);
      layout();
    }
    const now = nowS();
    const el = intro.time();
    // pose: escrita pela linha do tempo GSAP da abertura; depois fica na pose final
    const { z, yaw: yaw0, pitch: pitch0, roll: roll0, lift, light, mix } = introPose;

    // interação (apenas depois da abertura)
    let yaw = yaw0;
    let pitch = pitch0;
    let bob = 0;
    if (done) {
      // o cartão não segue o cursor: só gira ao segurar e arrastar (follow fica em 0)
      follow.x += (0 - follow.x) * damp(dt, 4);
      follow.y += (0 - follow.y) * damp(dt, 4);

      // rotação automática: cede à interação (arraste) e retorna suavemente
      const idle = !drag.active && !tween.on && now - lastInteract > 1.4;
      autoW += ((idle ? 1 : 0.2) - autoW) * damp(dt, idle ? 0.9 : 4);
      if (!reduceMotion) autoT += dt * (0.35 + 0.65 * autoW);
      const autoYaw = reduceMotion ? 0 : (Math.sin(autoT * 0.42) * 0.5 + Math.sin(autoT * 0.17) * 0.14) * autoW;
      const autoPitch = reduceMotion ? 0 : Math.sin(autoT * 0.6) * 0.06 * autoW;

      // inércia do arraste e retorno elástico
      if (!drag.active) {
        if (tween.on) {
          const k = clamp((now - tween.start) / tween.dur);
          drag.ry = tween.from + (tween.to - tween.from) * tween.ease(k);
          if (k >= 1) {
            tween.on = false;
            drag.ry = 0; // voltas completas são equivalentes: zera o acumulado
          }
        }
        drag.rx += (0 - drag.rx) * damp(dt, 2.5);
      }
      yaw = yaw0 + autoYaw + follow.y + drag.ry;
      pitch = pitch0 + autoPitch + follow.x + drag.rx;
    }
    if (!reduceMotion) bob = Math.sin(t * 1.1) * 0.08 * clamp(light);

    // posição: sempre no espaço do #cardStage; a profundidade (z) faz o cartão vir de longe
    // do centro da tela (mix 0, abertura no celular/tablet) até o lugar no hero (mix 1)
    const sc = L.cs + (L.fs - L.cs) * mix;
    const px = L.cx + (L.fx - L.cx) * mix;
    const py = L.cy + (L.fy - L.cy) * mix;
    pivot.position.set(toWX(px), toWY(py) + (bob + lift) * sc, z);
    pivot.rotation.set(pitch, yaw, roll0);
    fxUniforms.uAngle.value = yaw;
    fxUniforms.uTime.value = t;
    fxUniforms.uLight.value = 0.06 + 0.94 * light;
    // a faixa de luz das letras segue o ângulo do cartão (giro, balanço automático,
    // inclinação pelo cursor) e deriva devagar para nunca ficar parada
    const sweepPos = 0.7 + Math.sin(yaw) * 1.15 + pitch * 0.9 + (reduceMotion ? 0 : Math.sin(t * 0.35) * 0.22);
    fxUniforms.uSweep.value = sweepPos;

    // brilhos: acendem quando a faixa passa por eles e somem quando a frente não está visível
    pivot.updateMatrixWorld();
    cardNormal.set(0, 0, 1).transformDirection(card.matrixWorld);
    toCam.copy(camera.position).sub(pivot.position).normalize();
    const facing = clamp((cardNormal.dot(toCam) - 0.15) / 0.5);
    for (const sp of sparks) {
      const { u, v, size, phase } = sp.userData;
      const d = (u + v) * 0.7 - sweepPos;
      const hit = Math.exp(-d * d * 22);
      const twinkle = reduceMotion ? 0.5 : 0.5 + 0.5 * Math.sin(t * 2.3 + phase);
      sp.material.opacity = facing * light * clamp(hit * 1.1 + twinkle * 0.18);
      sp.material.rotation = phase + t * 0.25 + yaw * 0.8;
      sp.scale.setScalar(size * (0.55 + hit * 0.75 + twinkle * 0.12));
    }
    pivot.scale.setScalar(sc);

    // câmera: leve órbita e aproximação durante a abertura
    const cine = done ? 0 : clamp(1 - el / INTRO.poseEnd);
    camera.position.set(
      Math.sin(el * 0.55) * 0.7 * cine,
      Math.cos(el * 0.4) * 0.35 * cine,
      D * (1 + 0.12 * cine * (1 - light)),
    );
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    pivot.updateMatrixWorld();

    // luz: o cartão sai da escuridão
    const L2 = light * light;
    faceMat.color.setScalar(0.06 + 0.94 * light);
    ambient.intensity = 0.35 * light;
    key.intensity = 1.1 * light;
    const s2 = sc * sc;
    rim.position.set(pivot.position.x + (3.2 + Math.sin(t * 0.7) * 0.9) * sc, pivot.position.y + 1.2 * sc, z - 1.5 * sc);
    rim.intensity = (36 + Math.sin(t * 0.9) * 8) * s2 * (0.3 + 0.7 * light);
    under.position.set(pivot.position.x - 1.5 * sc, pivot.position.y - 3.2 * sc, z + 1.5 * sc);
    under.intensity = 18 * s2 * L2;

    // varredura de luz pela face na abertura e reflexo nas bordas depois
    const u = clamp((el - 0.5) / 1.4);
    scan.intensity = !done && u > 0 && u < 1 ? Math.sin(u * Math.PI) * 5 : 0;
    scan.position.set((-0.8 + 1.6 * u) * W, (0.5 - u) * H * 0.7, FACE_Z + 0.55);
    setOnEdge(t * 0.075, sweep);
    sweep.intensity = reduceMotion ? 0 : 1.2 * light * Math.pow(0.5 + 0.5 * Math.sin(t * 0.8), 3);

    // halo e brilho no chão
    const pulse = 0.85 + 0.15 * Math.sin(t * 0.55);
    halo.position.set(pivot.position.x, pivot.position.y, z - 1.4 * sc);
    // no modo caixa o halo cabe inteiro no canvas (sem corte visível)
    halo.scale.setScalar(Math.min(H * sc * 2.1, boxed ? (Math.min(L.bw, L.bh) / L.ppw) * 0.98 : Infinity));
    haloMat.opacity = 0.42 * light * pulse;
    const fs = 1 - bob * 1.4;
    floor.position.set(pivot.position.x, pivot.position.y - (H / 2 + 0.42) * sc, z - 0.3 * sc);
    floor.scale.set(3.4 * sc * fs, 0.75 * sc * fs, 1);
    floorMat.opacity = clamp((0.5 - bob * 1.6) * light * pulse);

    for (const set of emberSets) {
      const p = set.geometry.attributes.position;
      const s = set.userData.speed;
      for (let i = 0; i < s.length; i++) {
        let y = p.getY(i) + s[i] * dt;
        if (y > 5) y = -5;
        p.setY(i, y);
        p.setX(i, p.getX(i) + Math.sin(t + i) * 0.0015);
      }
      p.needsUpdate = true;
    }

    if (intro.playing && intro.started) drawCallouts(el, anchors3D(), cardBox3D(), calloutView(), edges3D());
    renderer.render(scene, camera);

    // controle de qualidade pela mediana (ignora travadas isoladas, como compilação de shaders):
    // reduz a resolução até 0,5x se o aparelho não acompanhar e recupera quando sobra fôlego;
    // sem fôlego nenhum, encerra a abertura e mantém o cartão em pose final
    if (warm > 0) { warm--; } else {
      perf[perfN++] = dt;
      if (perfN === perf.length) {
        perfN = 0;
        const med = [...perf].sort((a, b) => a - b)[perf.length >> 1];
        // a troca de resolução fica para o início do próximo quadro: setSize limpa o
        // buffer já desenhado e mostraria um quadro vazio (piscada)
        if (med > 1 / 30 && pixelRatio > PR_MIN) {
          pixelRatio = Math.max(PR_MIN, pixelRatio - 0.25);
          needsResize = true;
        } else if (med < 1 / 50 && pixelRatio < BASE_PR) {
          pixelRatio = Math.min(BASE_PR, pixelRatio + 0.25);
          needsResize = true;
        } else if (med > 1 / 15 && !done) {
          intro.skip();
        }
      }
    }
  }

  // pré-compila shaders e envia a textura antes do primeiro quadro visível:
  // evita a travada que fazia o cartão parecer parado no início da abertura
  renderer.compile(scene, camera);
  renderer.initTexture?.(texture);
  renderer.render(scene, camera);

  const activate = (late) => {
    layer.classList.add('on');
    ticker.add(frame);
    // fim de abertura feita no cartão CSS: ele sai só depois que o canvas aparece (sem piscar)
    if (late) setTimeout(() => stage.classList.add('has-webgl'), 450);
    else stage.classList.add('has-webgl');
  };
  if (intro.started && intro.playing) {
    // a abertura já começou no cartão CSS: o 3D assume só no final
    intro.onFinish(() => activate(true));
  } else {
    activate(false);
    // alguns quadros ocultos (o hero ainda não mostra o cartão) para a GPU terminar o envio de
    // shaders e textura; só então a abertura começa, sem travada no primeiro quadro
    let warmFrames = 0;
    const warmUp = () => {
      if (++warmFrames < 6) requestAnimationFrame(warmUp);
      else intro.start();
    };
    requestAnimationFrame(warmUp);
  }
}

/* ---------- Animações de entrada ---------- */
function initReveal() {
  // variantes automáticas: títulos com máscara, visuais com zoom, campos em sequência
  $$('h2.reveal').forEach((el) => el.classList.add('reveal-mask'));
  $$('.demo-visual, .how-visual, .contact-visual').forEach((el) => el.classList.add('reveal-zoom'));
  $$('.contact-form > *').forEach((el, i) => {
    el.classList.add('reveal');
    el.dataset.delay = String(Math.min(i + 2, 8));
  });

  const all = $$('.reveal');
  // com a abertura ativa, os itens do hero são revelados por intro.revealHero()
  const items = intro.playing ? all.filter((el) => !el.closest('.hero')) : all;
  all.forEach((el) => {
    const d = Number(el.dataset.delay || 0);
    if (d) el.style.setProperty('--d', `${d * 90}ms`);
  });
  if (reduceMotion || !('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('is-visible'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const el = entry.target;
        el.classList.add('is-visible');
        io.unobserve(el);
        // depois da entrada, o atraso sai para não retardar hover e tilt
        const d = Number(el.dataset.delay || 0) * 90;
        if (d) setTimeout(() => el.style.removeProperty('--d'), d + 1300);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
  items.forEach((el) => io.observe(el));
}

/* ---------- Hero: ponteiro, parallax de camadas e seções ---------- */
function initHeroPointer() {
  const hero = $('.hero');
  if (!finePointer || reduceMotion) return;
  hero.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    heroPointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    heroPointer.y = (e.clientY / window.innerHeight) * 2 - 1;
    heroPointer.inside = true;
    heroPointer.last = nowS();
  });
  hero.addEventListener('pointerleave', () => { heroPointer.inside = false; });
  doc.addEventListener('mouseleave', () => { heroPointer.inside = false; });
}

function initScrollFX() {
  const steps = $('.steps');
  const stepEls = steps ? $$('.step', steps) : [];

  const items = $$('[data-parallax]').map((el) => ({
    el,
    speed: parseFloat(el.dataset.parallax) || 0,
    anchor: el.closest('section') || el,
    top: 0,
    h: 0,
  }));
  const stepsBox = { top: 0, h: 1, marks: [] };

  const measure = () => {
    const sy = window.scrollY;
    items.forEach((it) => {
      const r = it.anchor.getBoundingClientRect();
      it.top = r.top + sy;
      it.h = r.height;
    });
    if (steps) {
      const r = steps.getBoundingClientRect();
      stepsBox.top = r.top + sy;
      stepsBox.h = Math.max(1, r.height);
      stepsBox.marks = stepEls.map((s) => (s.getBoundingClientRect().top + sy - stepsBox.top + 26) / stepsBox.h);
    }
  };
  measure();
  window.addEventListener('resize', measure);
  window.addEventListener('load', measure);
  new ResizeObserver(measure).observe(document.body);

  if (reduceMotion) {
    if (steps) steps.style.setProperty('--p', '1');
    stepEls.forEach((s) => s.classList.add('is-active'));
    return;
  }

  let lastS = -1;
  let lastPx = 9;
  let lastPy = 9;

  ticker.add((dt) => {
    scrollState.smooth += (scrollState.y - scrollState.smooth) * damp(dt, 9);
    const tx = heroPointer.inside ? heroPointer.x : 0;
    const ty = heroPointer.inside ? heroPointer.y : 0;
    heroPointer.sx += (tx - heroPointer.sx) * damp(dt, 3.5);
    heroPointer.sy += (ty - heroPointer.sy) * damp(dt, 3.5);

    const s = scrollState.smooth;
    const { sx, sy } = heroPointer;
    if (Math.abs(s - lastS) < 0.08 && Math.abs(sx - lastPx) < 0.0004 && Math.abs(sy - lastPy) < 0.0004) return;
    lastS = s; lastPx = sx; lastPy = sy;
    const vh = scrollState.vh;

    // Hero: sem parallax na rolagem (texto, cartão, chamadas e fundo rolam junto com a página)

    // elementos com data-parallax
    const center = s + vh / 2;
    for (const it of items) {
      const c = it.top + it.h / 2;
      if (Math.abs(center - c) > vh + it.h / 2) continue;
      const py = clamp((center - c) * it.speed, -140, 140);
      it.el.style.setProperty('--py', `${py.toFixed(1)}px`);
    }

    // Como funciona: a linha preenche e as etapas acendem conforme a rolagem
    if (steps) {
      const p = clamp((s + vh * 0.62 - stepsBox.top) / stepsBox.h);
      steps.style.setProperty('--p', p.toFixed(3));
      stepEls.forEach((el, i) => el.classList.toggle('is-active', p >= stepsBox.marks[i]));
    }
  });
}

/* =========================================================
   Atmosfera: um único canvas 2D fixo atrás da página com
   halos de luz, poeira luminosa em 3 profundidades, trilhas
   de circuito com pulsos e faíscas ocasionais.
   ========================================================= */
function initAtmosphere() {
  const canvas = document.createElement('canvas');
  canvas.className = 'atmos';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas);
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return;

  // luz e partículas são difusas: meia resolução (o CSS amplia) custa 1/4 dos pixels
  const DPR = 0.5;
  const BG = '#08080a';
  let W = 0;
  let H = 0;
  let tileH = 0;

  const sprite = (size, stops) => {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    stops.forEach(([o, col]) => gr.addColorStop(o, col));
    g.fillStyle = gr;
    g.fillRect(0, 0, size, size);
    return c;
  };
  const haloOrange = sprite(256, [[0, 'rgba(255,102,0,1)'], [0.35, 'rgba(255,102,0,.42)'], [1, 'rgba(255,102,0,0)']]);
  const haloWarm = sprite(256, [[0, 'rgba(255,150,70,1)'], [1, 'rgba(255,150,70,0)']]);
  const haloCool = sprite(256, [[0, 'rgba(205,210,220,1)'], [1, 'rgba(205,210,220,0)']]);
  const dotOrange = sprite(32, [[0, 'rgba(255,225,190,1)'], [0.22, 'rgba(255,140,50,.9)'], [1, 'rgba(255,102,0,0)']]);
  const dotSilver = sprite(32, [[0, 'rgba(255,255,255,1)'], [0.3, 'rgba(215,220,230,.55)'], [1, 'rgba(215,220,230,0)']]);

  /* --- poeira luminosa --- */
  const MAX_P = reduceMotion ? 40 : LOW_POWER ? 34 : 84;
  let activeP = MAX_P;
  let liteDrawnAt = -1e9;
  liteFns.push(() => { activeP = Math.round(MAX_P / 3); liteDrawnAt = -1e9; });
  const LAYERS = [
    { size: 1.3, speed: 6, alpha: 0.38, par: 0.04 },  // fundo
    { size: 2.2, speed: 11, alpha: 0.55, par: 0.12 }, // meio
    { size: 4.2, speed: 19, alpha: 0.2, par: 0.28 },  // frente, desfocada
  ];
  const parts = Array.from({ length: MAX_P }, () => {
    const r = Math.random();
    const L = LAYERS[r < 0.55 ? 0 : r < 0.88 ? 1 : 2];
    return {
      x: Math.random(), y: Math.random(),
      L,
      size: L.size * (0.7 + Math.random() * 0.6),
      speed: L.speed * (0.6 + Math.random() * 0.8),
      alpha: L.alpha * (0.6 + Math.random() * 0.6),
      tw: Math.random() * Math.PI * 2,
      twS: 0.4 + Math.random() * 1.4,
      drift: (Math.random() - 0.5) * 0.004,
      silver: Math.random() < 0.18,
    };
  });

  /* --- trilhas de circuito --- */
  const traceCanvas = document.createElement('canvas');
  const tctx = traceCanvas.getContext('2d');
  let traces = [];
  const rand = (a, b) => a + Math.random() * (b - a);

  function buildTraces() {
    tileH = Math.round(H * 1.6);
    traceCanvas.width = Math.round(W * DPR);
    traceCanvas.height = Math.round(tileH * DPR);
    tctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    tctx.clearRect(0, 0, W, tileH);
    traces = [];
    const n = LOW_POWER ? 8 : 14;
    for (let i = 0; i < n; i++) {
      const left = i % 2 === 0;
      const minX = left ? -10 : W * 0.6;
      const maxX = left ? W * 0.4 : W + 10;
      let x = left ? rand(-10, W * 0.12) : rand(W * 0.88, W + 10);
      let y = rand(60, tileH - 60);
      const dir = left ? 1 : -1;
      const pts = [[x, y]];
      const segs = 4 + Math.floor(Math.random() * 4);
      for (let k = 0; k < segs; k++) {
        const m = Math.random();
        let nx = x;
        let ny = y;
        if (m < 0.45) nx = x + dir * rand(40, 150);
        else if (m < 0.75) ny = y + (Math.random() < 0.5 ? -1 : 1) * rand(30, 110);
        else { const l = rand(20, 60); nx = x + dir * l; ny = y + (Math.random() < 0.5 ? -1 : 1) * l; }
        nx = clamp(nx, minX, maxX);
        ny = clamp(ny, 40, tileH - 40);
        if (nx === x && ny === y) continue;
        pts.push([nx, ny]);
        x = nx; y = ny;
      }
      if (pts.length < 2) continue;
      const lens = [0];
      for (let k = 1; k < pts.length; k++) {
        lens.push(lens[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
      }
      traces.push({ pts, lens, len: lens[lens.length - 1] });
    }

    const drawPath = (pts, ox, oy) => {
      tctx.beginPath();
      pts.forEach(([px, py], k) => (k ? tctx.lineTo(px + ox, py + oy) : tctx.moveTo(px + ox, py + oy)));
      tctx.stroke();
    };
    tctx.lineWidth = 1;
    tctx.lineJoin = 'round';
    traces.forEach((tr, i) => {
      tctx.strokeStyle = 'rgba(255,122,48,.085)';
      drawPath(tr.pts, 0, 0);
      if (i % 3 === 0) { tctx.strokeStyle = 'rgba(255,122,48,.05)'; drawPath(tr.pts, 0, 7); }
      tctx.fillStyle = 'rgba(255,140,70,.10)';
      tr.pts.slice(1, -1).forEach(([px, py]) => { tctx.beginPath(); tctx.arc(px, py, 1.4, 0, Math.PI * 2); tctx.fill(); });
      const [ex, ey] = tr.pts[tr.pts.length - 1];
      tctx.strokeStyle = 'rgba(255,140,70,.18)';
      tctx.beginPath(); tctx.arc(ex, ey, 3, 0, Math.PI * 2); tctx.stroke();
    });
  }

  const pointAt = (tr, d, out) => {
    const { pts, lens } = tr;
    let k = 1;
    while (k < lens.length - 1 && lens[k] < d) k++;
    const seg = lens[k] - lens[k - 1] || 1;
    const f = clamp((d - lens[k - 1]) / seg);
    out[0] = pts[k - 1][0] + (pts[k][0] - pts[k - 1][0]) * f;
    out[1] = pts[k - 1][1] + (pts[k][1] - pts[k - 1][1]) * f;
    return out;
  };

  const pulses = Array.from({ length: LOW_POWER ? 2 : 4 }, () => ({ tr: null, d: 0, speed: 0, wait: Math.random() * 2 }));
  const sparks = Array.from({ length: LOW_POWER ? 2 : 5 }, () => ({ life: 0, max: 1, x: 0, y: 0, vx: 0, vy: 0 }));
  const tmp = [0, 0];

  // trajetória do halo principal ao longo da página (a luz "migra" entre as seções)
  const HALO_PATH = [[0.74, 0.42], [0.24, 0.5], [0.78, 0.46], [0.3, 0.55], [0.72, 0.5], [0.5, 0.72]];

  let vignette = null;
  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    const vr = Math.hypot(W, H) * 0.6;
    vignette = ctx.createRadialGradient(W / 2, H * 0.4, vr * 0.55, W / 2, H * 0.4, vr);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,.5)');
    buildTraces();
    pulses.forEach((p) => { p.tr = null; });
  }

  let lastW = 0;
  const onResize = () => {
    // ignora variações pequenas de altura da barra de endereço no celular
    if (window.innerWidth === lastW && Math.abs(window.innerHeight - H) < 140) return;
    lastW = window.innerWidth;
    resize();
    if (reduceMotion) draw(0, 0);
  };

  let perfAcc = 0;
  let perfN = 0;
  let skip = false;

  function draw(dt, t) {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);

    const s = scrollState.smooth;
    const prog = clamp(s / scrollState.max);
    const big = Math.max(W, H);

    // halos: gradientes de luz que respiram e migram com a rolagem
    ctx.globalCompositeOperation = 'lighter';
    const fi = prog * (HALO_PATH.length - 1);
    const i0 = Math.min(Math.floor(fi), HALO_PATH.length - 2);
    let f = fi - i0;
    f = f * f * (3 - 2 * f);
    const hx = (HALO_PATH[i0][0] + (HALO_PATH[i0 + 1][0] - HALO_PATH[i0][0]) * f) * W;
    const hy = (HALO_PATH[i0][1] + (HALO_PATH[i0 + 1][1] - HALO_PATH[i0][1]) * f) * H;
    const pulse = 0.82 + 0.18 * Math.sin(t * 0.55);
    let r = big * 0.55 * (0.95 + 0.05 * Math.sin(t * 0.3));
    ctx.globalAlpha = 0.12 * pulse;
    ctx.drawImage(haloOrange, hx - r, hy - r, r * 2, r * 2);

    r = big * 0.42;
    ctx.globalAlpha = 0.05;
    ctx.drawImage(haloWarm, W * (0.5 + 0.38 * Math.sin(t * 0.05)) - r, H * (0.55 + 0.3 * Math.cos(t * 0.07)) - r, r * 2, r * 2);

    r = big * 0.5;
    ctx.globalAlpha = 0.03;
    ctx.drawImage(haloCool, W * (0.3 + 0.22 * Math.sin(t * 0.035)) - r, H * 0.05 - r, r * 2, r * 2);

    // trilhas de circuito (parallax lento)
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    const off = (s * 0.1) % tileH;
    ctx.drawImage(traceCanvas, 0, -off, W, tileH);
    if (tileH - off < H) ctx.drawImage(traceCanvas, 0, tileH - off, W, tileH);

    // pulsos de luz percorrendo as trilhas
    ctx.globalCompositeOperation = 'lighter';
    for (const p of pulses) {
      if (!traces.length) break;
      if (!p.tr) {
        p.wait -= dt;
        if (p.wait <= 0) {
          p.tr = traces[Math.floor(Math.random() * traces.length)];
          p.d = 0;
          p.speed = rand(70, 140);
        }
        continue;
      }
      p.d += p.speed * dt;
      if (p.d > p.tr.len + 40) { p.tr = null; p.wait = rand(0.6, 3.2); continue; }
      for (let k = 0; k < 7; k++) {
        const d = p.d - k * 6;
        if (d < 0 || d > p.tr.len) continue;
        pointAt(p.tr, d, tmp);
        for (const base of [-off, tileH - off]) {
          const y = tmp[1] + base;
          if (y < -20 || y > H + 20) continue;
          const sz = k === 0 ? 18 : 8 - k * 0.6;
          ctx.globalAlpha = k === 0 ? 0.75 : 0.4 * (1 - k / 7);
          ctx.drawImage(dotOrange, tmp[0] - sz / 2, y - sz / 2, sz, sz);
        }
      }
    }

    // poeira luminosa em três profundidades
    for (let i = 0; i < activeP; i++) {
      const p = parts[i];
      p.y -= (p.speed * dt) / H;
      p.x += p.drift * dt * 6;
      if (p.y < -0.05) { p.y = 1.05; p.x = Math.random(); }
      if (p.x < -0.05) p.x = 1.05; else if (p.x > 1.05) p.x = -0.05;
      let y = (p.y * H - s * p.L.par) % H;
      if (y < 0) y += H;
      const tw = 0.55 + 0.45 * Math.sin(t * p.twS + p.tw);
      const sz = p.size * 6;
      ctx.globalAlpha = p.alpha * tw;
      ctx.drawImage(p.silver ? dotSilver : dotOrange, p.x * W - sz / 2, y - sz / 2, sz, sz);
    }

    // faíscas ocasionais subindo da parte inferior
    if (!reduceMotion) {
      for (const sp of sparks) {
        if (sp.life <= 0) {
          if (Math.random() < dt * 0.12) {
            sp.max = sp.life = rand(0.9, 1.7);
            sp.x = rand(0.05, 0.95) * W;
            sp.y = rand(0.7, 1) * H;
            sp.vx = rand(-25, 25);
            sp.vy = rand(-120, -70);
          }
          continue;
        }
        sp.life -= dt;
        sp.x += sp.vx * dt;
        sp.y += sp.vy * dt;
        sp.vy += 22 * dt;
        const a = clamp(sp.life / sp.max);
        ctx.globalAlpha = a * 0.8;
        ctx.strokeStyle = '#ff8a3d';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(sp.x, sp.y);
        ctx.lineTo(sp.x - sp.vx * 0.07, sp.y - sp.vy * 0.07);
        ctx.stroke();
        ctx.drawImage(dotOrange, sp.x - 5, sp.y - 5, 10, 10);
      }
    }

    // vinheta desenhada aqui (antes era uma camada CSS de tela cheia mesclada a cada quadro)
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);
  }

  resize();
  lastW = window.innerWidth;
  window.addEventListener('resize', onResize);
  canvas.classList.add('on');

  if (reduceMotion) { draw(0, 0); return; }

  ticker.add((dt, t) => {
    // em aparelhos modestos o fundo roda a 30 fps
    // modo leve: sem GPU, cada quadro do canvas força recompor a tela inteira na CPU;
    // então o fundo só é redesenhado quando a rolagem muda (o parallax continua)
    if (LITE) {
      if (Math.abs(scrollState.smooth - liteDrawnAt) < 1.5) return;
      liteDrawnAt = scrollState.smooth;
      draw(0, t);
      return;
    }
    if (LOW_POWER) { skip = !skip; if (skip) return; dt *= 2; }
    draw(dt, t);
    // se o aparelho estiver sofrendo, reduz a poeira pela metade
    perfAcc += dt; perfN++;
    if (perfN === 120) {
      if (perfAcc / perfN > 1 / 34 && activeP > MAX_P / 2) activeP = Math.round(MAX_P / 2);
      perfAcc = 0; perfN = 0;
    }
  });
}

/* ---------- Tilt, luz que segue o cursor e botões magnéticos ---------- */
function initPointerFX() {
  // classes adicionadas aqui para não poluir o HTML
  $$('.benefit').forEach((el) => el.classList.add('spot'));
  $$('.segments li').forEach((el) => { el.classList.add('tilt', 'spot'); el.dataset.tilt = '10'; });
  $$('.member').forEach((el) => { el.classList.add('tilt', 'spot'); el.dataset.tilt = '6'; });
  $$('.hero-strip li, .stat, .testimonial').forEach((el) => el.classList.add('spot'));

  if (!finePointer) return;
  $$('.spot, .tilt').forEach((card) => {
    const amp = Number(card.dataset.tilt || 8);
    const canTilt = card.classList.contains('tilt') && !reduceMotion;
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      card.style.setProperty('--mx', `${x * 100}%`);
      card.style.setProperty('--my', `${y * 100}%`);
      if (canTilt) {
        card.style.setProperty('--ry', `${(x - 0.5) * amp}deg`);
        card.style.setProperty('--rx', `${(0.5 - y) * amp}deg`);
      }
    });
    card.addEventListener('pointerleave', () => {
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
    });
  });

  if (reduceMotion) return;
  $$('.magnetic').forEach((btn) => {
    btn.addEventListener('pointermove', (e) => {
      const r = btn.getBoundingClientRect();
      const x = e.clientX - r.left - r.width / 2;
      const y = e.clientY - r.top - r.height / 2;
      btn.style.transform = `translate(${x * 0.18}px, ${y * 0.3}px)`;
    });
    btn.addEventListener('pointerleave', () => { btn.style.transform = ''; });
  });
}

/* ---------- Equipe, resultados e depoimentos ---------- */
const SILHOUETTE = '<svg viewBox="0 0 100 110" aria-hidden="true"><circle cx="50" cy="38" r="22"/><path d="M8 110c0-26 19-42 42-42s42 16 42 42z"/></svg>';

function renderTeam() {
  const grid = $('#teamGrid');
  grid.innerHTML = TEAM.map((m, i) => `
    <li class="member reveal" data-delay="${i % 4}">
      <div class="member-photo">
        ${m.photo
          ? `<img src="${escapeHtml(m.photo)}" alt="${escapeHtml(m.name)}" loading="lazy">`
          : SILHOUETTE}
        ${m.placeholder ? '<span class="member-badge">Marcador provisório</span>' : ''}
      </div>
      <div class="member-info">
        <h3>${escapeHtml(m.name)}</h3>
        <span class="role">${escapeHtml(m.role)}</span>
        ${m.bio ? `<p>${escapeHtml(m.bio)}</p>` : ''}
      </div>
    </li>`).join('');
}

// '+3.000' -> { prefix: '+', value: 3000, decimals: 0, suffix: '' } (formato pt-BR)
function parseStat(text) {
  const m = String(text).match(/^(\D*?)(\d[\d.]*(?:,\d+)?)(.*)$/);
  if (!m) return null;
  const decimals = m[2].includes(',') ? m[2].split(',')[1].length : 0;
  const value = parseFloat(m[2].replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(value) ? { prefix: m[1], value, decimals, suffix: m[3] } : null;
}

function renderResults() {
  if (RESULTS.length) {
    $('#statsGrid').innerHTML = RESULTS.map((r, i) => {
      const p = parseStat(r.value);
      const attrs = p
        ? ` data-count="${p.value}" data-decimals="${p.decimals}" data-prefix="${escapeHtml(p.prefix)}" data-suffix="${escapeHtml(p.suffix)}"`
        : '';
      return `
      <li class="stat reveal" data-delay="${i}">
        <strong${attrs}>${escapeHtml(r.value)}</strong><span>${escapeHtml(r.label)}</span>
      </li>`;
    }).join('');
    $('#resultsBlock').hidden = false;
  }
  if (TESTIMONIALS.length) {
    const box = $('#testimonials');
    box.innerHTML = TESTIMONIALS.map((t, i) => `
      <figure class="testimonial reveal" data-delay="${i}">
        <blockquote>“${escapeHtml(t.quote)}”</blockquote>
        <figcaption><cite>${escapeHtml(t.author)}</cite>${t.business ? ` · ${escapeHtml(t.business)}` : ''}</figcaption>
      </figure>`).join('');
    box.hidden = false;
  }
}

// contadores: só existem quando RESULTS tiver números reais
function initCounters() {
  const els = $$('[data-count]');
  if (!els.length || reduceMotion) return;
  const fmt = (v, d) => v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
  els.forEach((el) => {
    const target = Number(el.dataset.count);
    const dec = Number(el.dataset.decimals || 0);
    el.textContent = `${el.dataset.prefix}${fmt(0, dec)}${el.dataset.suffix}`;
  });
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      io.unobserve(entry.target);
      const el = entry.target;
      const target = Number(el.dataset.count);
      const dec = Number(el.dataset.decimals || 0);
      const start = nowS();
      const step = () => {
        const k = clamp((nowS() - start) / 1.8);
        const e = 1 - Math.pow(1 - k, 3);
        el.textContent = `${el.dataset.prefix}${fmt(target * e, dec)}${el.dataset.suffix}`;
        if (k >= 1) ticker.remove(step);
      };
      ticker.add(step);
    });
  }, { threshold: 0.6 });
  els.forEach((el) => io.observe(el));
}

/* ---------- Compra ---------- */
function initBuy() {
  $$('[data-buy]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      if (CONFIG.checkoutUrl) {
        e.preventDefault();
        e.stopPropagation();
        window.open(CONFIG.checkoutUrl, '_blank', 'noopener');
        return;
      }
      // sem checkout integrado: leva ao formulário já preparado para pedido
      const subject = $('#f-assunto');
      const msg = $('#f-msg');
      subject.value = 'compra';
      if (!msg.value.trim()) msg.value = 'Olá! Quero comprar o cartão KZORA. Pode me passar valores e prazo?';
      setTimeout(() => $('#f-nome').focus({ preventScroll: true }), 900);
      toast('Preencha seus dados e a equipe KZORA entra em contato para finalizar o pedido.');
    });
  });
}

/* ---------- Formulário de contato ---------- */
function initForm() {
  const form = $('#contactForm');
  const status = $('#formStatus');
  const submitBtn = form.querySelector('button[type="submit"]');
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  const rules = {
    nome: (v) => (v.trim().length >= 3 ? '' : 'Informe seu nome completo.'),
    email: (v) => (emailRe.test(v.trim()) ? '' : 'Informe um e-mail válido.'),
    telefone: (v) => (!v.trim() || v.replace(/\D/g, '').length >= 10 ? '' : 'Informe DDD e número.'),
    mensagem: (v) => (v.trim().length >= 10 ? '' : 'Escreva uma mensagem com pelo menos 10 caracteres.'),
    consentimento: (v) => (v ? '' : 'Para enviar, aceite a Política de Privacidade.'),
  };

  const check = (input) => {
    const rule = rules[input.name];
    if (!rule) return true;
    const err = rule(input.type === 'checkbox' ? (input.checked ? '1' : '') : input.value);
    const field = input.closest('.field');
    field.classList.toggle('invalid', Boolean(err));
    field.classList.toggle('valid', !err && input.type !== 'checkbox' && input.value.trim() !== '');
    field.querySelector('.field-error').textContent = err;
    input.setAttribute('aria-invalid', err ? 'true' : 'false');
    return !err;
  };

  // máscara simples de telefone
  $('#f-tel').addEventListener('input', (e) => {
    const d = e.target.value.replace(/\D/g, '').slice(0, 11);
    let out = d;
    if (d.length > 2) out = `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length > 7) out = `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
    e.target.value = out;
  });

  form.addEventListener('blur', (e) => { if (e.target.name) check(e.target); }, true);
  form.addEventListener('input', (e) => {
    if (e.target.closest('.field.invalid, .field.valid')) check(e.target);
  });
  form.addEventListener('change', (e) => { if (e.target.type === 'checkbox') check(e.target); });

  const shake = (field) => {
    field.classList.remove('shake');
    void field.offsetWidth; // reinicia a animação
    field.classList.add('shake');
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const inputs = $$('input, textarea', form);
    const results = inputs.map(check);
    if (results.includes(false)) {
      inputs.forEach((input, i) => { if (!results[i]) shake(input.closest('.field')); });
      inputs[results.indexOf(false)].focus();
      status.className = 'form-status field-full warn';
      status.textContent = 'Revise os campos destacados.';
      return;
    }

    const data = Object.fromEntries(new FormData(form).entries());

    // sem endpoint configurado: a mensagem segue pelo WhatsApp da KZORA, já preenchida
    if (!CONFIG.contactEndpoint) {
      const assunto = $('#f-assunto').selectedOptions[0]?.textContent.trim() || data.assunto;
      const text = [
        `Olá! Vim pelo site da KZORA.`,
        `Assunto: ${assunto}`,
        `Nome: ${data.nome.trim()}`,
        `E-mail: ${data.email.trim()}`,
        data.telefone ? `WhatsApp: ${data.telefone}` : '',
        '',
        data.mensagem.trim(),
      ].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n');
      const url = `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(text)}`;
      // sem 'noopener' na chamada (com ele o navegador devolve null); o vínculo é cortado logo após
      const win = window.open(url, '_blank');
      if (win) win.opener = null;
      status.className = 'form-status field-full ok';
      status.innerHTML = win
        ? 'Abrimos o WhatsApp com a sua mensagem pronta. É só tocar em enviar!'
        : `Toque aqui para <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">enviar sua mensagem pelo WhatsApp</a>.`;
      return;
    }

    submitBtn.disabled = true;
    submitBtn.classList.add('is-loading');
    status.className = 'form-status field-full';
    status.textContent = 'Enviando...';
    try {
      const res = await fetch(CONFIG.contactEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      form.reset();
      $$('.field', form).forEach((f) => f.classList.remove('valid'));
      status.className = 'form-status field-full ok';
      status.textContent = 'Mensagem enviada! Em breve a equipe KZORA entra em contato.';
      form.classList.add('sent');
      setTimeout(() => form.classList.remove('sent'), 1600);
    } catch (err) {
      status.className = 'form-status field-full warn';
      status.innerHTML = `Não foi possível enviar agora. Tente novamente ou <a href="${CONFIG.instagramDm}" target="_blank" rel="noopener noreferrer">fale pelo Instagram</a>.`;
    } finally {
      submitBtn.disabled = false;
      submitBtn.classList.remove('is-loading');
    }
  });
}

/* ---------- Cartão sem WebGL: giro 360° por CSS 3D ----------
   segurar e arrastar (botão do mouse ou dedo) gira o cartão; ao soltar, ele
   completa a volta na direção do gesto ou volta à frente mais próxima. */
// monta o cartão CSS 3D: espessura, reflexo, brilho nas letras e estrelas de reflexo
function buildCssCard(cardEl) {
  // espessura: camadas acobreadas empilhadas entre a frente e o verso
  for (let z = -3.5; z <= 3.5; z += 0.5) {
    const edge = document.createElement('span');
    edge.className = 'fb-edge';
    edge.setAttribute('aria-hidden', 'true');
    edge.style.transform = `translateZ(${z}px)`;
    cardEl.insertBefore(edge, cardEl.firstChild);
  }
  // reflexo da frente (usa --fry, então acompanha o giro)
  const gloss = document.createElement('span');
  gloss.className = 'fb-gloss';
  gloss.setAttribute('aria-hidden', 'true');
  cardEl.appendChild(gloss);
  // brilho nas letras metálicas (máscara = a própria foto) e estrelas de reflexo
  const shine = document.createElement('span');
  shine.className = 'fb-shine';
  shine.setAttribute('aria-hidden', 'true');
  cardEl.appendChild(shine);
  [[77.5, 21.8], [68.4, 43.4], [30.6, 60.8], [68.4, 60.8], [34.5, 5.5], [61, 89.5]].forEach(([x, y], i) => {
    const sp = document.createElement('span');
    sp.className = 'fb-spark';
    sp.setAttribute('aria-hidden', 'true');
    sp.style.left = `${x}%`;
    sp.style.top = `${y}%`;
    sp.style.animationDelay = `${(i * 0.9) % 5}s`;
    cardEl.appendChild(sp);
  });
}

function initFallbackCard() {
  const stage = $('#cardStage');
  const cardEl = $('.card-fallback .fb-card');
  const fallbackEl = $('#cardFallback');
  if (!stage || !cardEl) return;
  const off = () => stage.classList.contains('has-webgl'); // o cartão Three.js assume
  let ry = 0;
  let vel = 0;
  let lastMove = 0;
  const drag = { on: false, id: null, last: 0 };
  const setRy = (v) => { ry = v; cardEl.style.setProperty('--fry', `${v}deg`); };
  buildCssCard(cardEl);

  // abertura no cartão CSS: aplica introPose a cada quadro até o fim da abertura
  if (intro.mode === 'full') {
    const ANCH = [[0.505, 0.89], [0.49, 0.52], [0.885, 0.385], [0.0, 0.42]];
    const deg = (r) => (r * 180) / Math.PI;
    fallbackEl.classList.add('intro-driven');
    cardEl.classList.add('is-dragging');
    const apply = () => {
      if (off()) return;
      if (!intro.poseDone) {
        const p = introPose;
        cardEl.style.setProperty('--fry', `${deg(p.yaw - FINAL_YAW).toFixed(2)}deg`);
        cardEl.style.setProperty('--tx', `${deg(p.pitch - 0.05).toFixed(2)}deg`);
        cardEl.style.setProperty('--frz', `${deg(p.roll - 0.05).toFixed(2)}deg`);
        cardEl.style.setProperty('--fz', `${(p.z * 34).toFixed(1)}px`);
        if (BIG_INTRO) {
          // grande no centro da tela no começo, depois vai para o lugar dele
          const b = cachedBox(cardEl);
          const view = calloutView();
          const vh = Math.min(view.h, window.innerHeight);
          const big = Math.min((vh - view.top) * 0.7 / b.h, view.w * 0.78 / b.w);
          const k = 1 - p.mix;
          cardEl.style.setProperty('--fbx', `${((view.w / 2 - (b.x + b.w / 2)) * k).toFixed(1)}px`);
          cardEl.style.setProperty('--fby', `${(((view.top + vh) / 2 - (b.y + b.h / 2)) * k).toFixed(1)}px`);
          cardEl.style.setProperty('--fsc', (big + (1 - big) * p.mix).toFixed(4));
        }
        cardEl.style.setProperty('--fly', `${(-p.lift * 110).toFixed(1)}px`);
        cardEl.style.setProperty('--flight', p.light.toFixed(3));
      }
      if (intro.started) {
        const b = cachedBox(cardEl);
        drawCallouts(intro.time(),
          ANCH.map(([u, v]) => [b.x + u * b.w, b.y + v * b.h]),
          { cx: b.x + b.w / 2, cy: b.y + b.h / 2, hw: b.w / 2, hh: b.h / 2 },
          calloutView(),
          ANCH.map(([, v], i) => [callouts[i].side === 'L' ? b.x - 8 : b.x + b.w + 8, b.y + v * b.h]));
      }
    };
    window.gsap.ticker.add(apply);
    intro.onPoseDone(() => {
      ['--tx', '--frz', '--fz', '--fly', '--flight', '--fbx', '--fby', '--fsc'].forEach((v) => cardEl.style.removeProperty(v));
      setRy(0);
      void cardEl.offsetWidth;
      cardEl.classList.remove('is-dragging');
      // intro-played mantém a animação de entrada (fallbackIn) desligada: sem ela o cartão
      // sumia e reaparecia com fade justo quando as chamadas começavam
      fallbackEl.classList.add('intro-played');
      fallbackEl.classList.remove('intro-driven');
    });
    intro.onFinish(() => window.gsap.ticker.remove(apply));
  }

  // fim do assentamento: voltas completas são equivalentes, então zera sem animação
  cardEl.addEventListener('transitionend', (e) => {
    if (e.propertyName !== '--fry' || !cardEl.classList.contains('is-spinning')) return;
    cardEl.classList.remove('is-spinning');
    cardEl.classList.add('is-dragging');
    setRy(0);
    void cardEl.offsetWidth;
    cardEl.classList.remove('is-dragging');
  });
  const settle = () => {
    const fresh = nowS() - lastMove < 0.12;
    const turns = fresh && Math.abs(vel) > 3
      ? (vel > 0 ? Math.ceil(ry / 360) : Math.floor(ry / 360))
      : Math.round(ry / 360);
    const to = turns * 360;
    cardEl.classList.remove('is-dragging');
    if (to === ry) { setRy(0); return; }
    cardEl.classList.add('is-spinning');
    setRy(to);
  };

  stage.addEventListener('pointerdown', (e) => {
    if (off() || (e.pointerType === 'mouse' && e.button !== 0)) return;
    if (!intro.poseDone) { intro.skip(); return; }
    e.preventDefault();
    drag.on = true;
    drag.id = e.pointerId;
    drag.last = e.clientX;
    vel = 0;
    stage.setPointerCapture?.(e.pointerId);
  });
  stage.addEventListener('pointermove', (e) => {
    if (off() || !drag.on || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.last;
    drag.last = e.clientX;
    vel = clamp(dx, -40, 40);
    lastMove = nowS();
    cardEl.classList.remove('is-spinning');
    cardEl.classList.add('is-dragging');
    setRy(ry + vel * 0.6);
  });
  const end = (e) => {
    if (off() || !drag.on || e.pointerId !== drag.id) return;
    drag.on = false;
    settle();
  };
  stage.addEventListener('pointerup', end);
  stage.addEventListener('pointercancel', end);

  stage.tabIndex = 0;
  stage.addEventListener('keydown', (e) => {
    if (off()) return;
    const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    cardEl.classList.remove('is-dragging');
    cardEl.classList.add('is-spinning');
    setRy((Math.round(ry / 360) + dir) * 360);
  });
}

/* =========================================================
   Vitrine do cartão: a rolagem controla o giro (ScrollTrigger + scrub)
   A seção fica fixa por ~1,5 tela; rolar para cima reverte a animação
   e parar de rolar congela no progresso atual.
   ========================================================= */
function initShowcase() {
  const section = $('#cartao');
  const card = $('.sc-card');
  if (!section || !card) return;
  buildCssCard(card);
  const labels = $$('.sc-label', section);
  const glow = $('.showcase-glow', section);
  const bar = $('.showcase-progress span', section);
  const gsap = window.gsap;
  const ST = window.ScrollTrigger;

  if (reduceMotion || !gsap || !ST) {
    // sem animação: cartão de frente e recursos visíveis
    section.classList.add('is-static', 'sc-idle');
    return;
  }
  gsap.registerPlugin(ST);
  const narrow = window.matchMedia('(max-width: 880px)').matches;

  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: section,
      pin: '.showcase-pin',
      start: 'top top',
      end: narrow ? '+=120%' : '+=150%',
      scrub: 0.7,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      // ao fim do giro o cartão continua vivo: flutua e o feixe de luz segue passando
      onUpdate: (self) => section.classList.toggle('sc-idle', self.progress > 0.96),
    },
  });
  // 1. de longe e inclinado até perto
  tl.fromTo(card,
    { '--fz': '-420px', '--fly': '70px', '--fry': '-38deg', '--tx': '20deg', '--frz': '-6deg' },
    { '--fz': '0px', '--fly': '0px', '--fry': '0deg', '--tx': '4deg', '--frz': '0deg', duration: 1, ease: 'power2.out' }, 0)
    .fromTo(glow, { opacity: 0.25, scale: 0.7 }, { opacity: 1, scale: 1.1, duration: 1 }, 0)
    // 2. giro progressivo: lateral, verso neutro, de volta à frente
    .to(card, { '--fry': '180deg', '--tx': '-6deg', duration: 1.1, ease: 'power1.inOut' }, 1)
    .to(card, { '--fry': '360deg', '--tx': '4deg', duration: 1.1, ease: 'power1.inOut' }, 2.1)
    // 3. posição final antes da próxima seção
    .to(card, { '--fz': '40px', '--fly': '-10px', duration: 0.6, ease: 'power1.out' }, 3.2)
    .to(glow, { opacity: 0.7, scale: 1, duration: 0.8 }, 3.0)
    .fromTo(bar, { scaleX: 0 }, { scaleX: 1, duration: 3.8 }, 0);
  // chamadas em momentos diferentes da linha do tempo
  labels.forEach((el, i) => {
    const side = el.dataset.side === 'l' ? -1 : 1;
    tl.fromTo(el,
      { autoAlpha: 0, x: narrow ? 0 : side * 28, y: narrow ? 14 : 0 },
      { autoAlpha: 1, x: 0, y: 0, duration: 0.35, ease: 'power2.out' }, 0.55 + i * 0.7);
  });

  // medidas mudam com fontes, imagens e blocos preenchidos via JS
  document.fonts?.ready.then(() => ST.refresh());
  window.addEventListener('load', () => ST.refresh());
}

/* ---------- Celular: o cartão do hero cabe na primeira tela ----------
   O espaço do cartão ocupa o que sobra abaixo do texto e dos botões, para a abertura (e as
   chamadas) acontecerem à vista, sem precisar rolar. */
function fitHeroStage() {
  const stage = $('#cardStage');
  if (!stage) return;
  let lastW = -1;
  const fit = () => {
    if (window.innerWidth === lastW) return; // barra de endereço do celular não reajusta
    lastW = window.innerWidth;
    if (window.innerWidth > 600) { stage.style.height = ''; return; }
    stage.style.height = '';
    const top = boxInHero(stage).y;
    stage.style.height = `${Math.round(clamp(window.innerHeight - top - 64, 230, 440))}px`;
  };
  fit();
  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', () => { lastW = -1; setTimeout(fit, 250); });
}

/* ---------- Monitor de fluidez: abaixo de ~40 fps por 2 s, entra no modo leve ---------- */
function initFpsGuard() {
  if (reduceMotion) return;
  const buf = new Float32Array(120);
  let n = 0;
  let skipFirst = 90; // ignora o carregamento inicial
  const check = (dt) => {
    if (LITE) { ticker.remove(check); return; }
    if (document.hidden) return;
    if (skipFirst > 0) { skipFirst--; return; }
    buf[n++] = dt;
    if (n === buf.length) {
      n = 0;
      const med = [...buf].sort((a, b) => a - b)[buf.length >> 1];
      if (med > 1 / 40) enterLite();
    }
  };
  ticker.add(check);
}

/* ---------- Animações CSS em loop só rodam na seção visível ---------- */
function initOffscreenPause() {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => e.target.classList.toggle('is-offscreen', !e.isIntersecting));
  }, { rootMargin: '120px 0px' });
  $$('main > section').forEach((sec) => io.observe(sec));
}

/* ---------- Brilho nos demais cartões da página ----------
   Os cartões estáticos (benefícios, demonstração, como funciona, contato) ganham o mesmo
   brilho do cartão principal: faixa de luz que passa só sobre letras, QR e estrelas
   (a própria foto serve de máscara) e estrelas de reflexo nos mesmos pontos da arte.
   A <img> vira filha de um invólucro que herda classes e data-parallax, para posição,
   animações e parallax continuarem iguais. */
function initCardShine() {
  const SPARKS = [[77.5, 21.8], [68.4, 43.4], [30.6, 60.8], [68.4, 60.8], [34.5, 5.5], [61, 89.5]];
  $$('img.kz-card:not(.fb-front)').forEach((img, k) => {
    const wrap = document.createElement('span');
    wrap.className = `${img.className} kz-shiny`;
    if (img.dataset.parallax) {
      wrap.dataset.parallax = img.dataset.parallax;
      img.removeAttribute('data-parallax');
    }
    if (img.getAttribute('aria-hidden')) wrap.setAttribute('aria-hidden', img.getAttribute('aria-hidden'));
    img.className = 'kz-shiny-img';
    img.draggable = false;
    img.replaceWith(wrap);
    wrap.appendChild(img);
    const shine = document.createElement('span');
    shine.className = 'kz-shine';
    shine.setAttribute('aria-hidden', 'true');
    shine.style.setProperty('--mask', `url("${img.getAttribute('src')}")`);
    // cada cartão com o brilho em um momento diferente
    shine.style.animationDelay = `${(k * 1.7) % 6}s`;
    wrap.appendChild(shine);
    SPARKS.forEach(([x, y], i) => {
      const sp = document.createElement('span');
      sp.className = 'fb-spark';
      sp.setAttribute('aria-hidden', 'true');
      sp.style.left = `${x}%`;
      sp.style.top = `${y}%`;
      sp.style.animationDelay = `${(i * 0.9 + k * 1.3) % 5}s`;
      wrap.appendChild(sp);
    });
  });
}

/* ---------- Relógio do celular da demonstração: hora e data reais do visitante ---------- */
function initPhoneClock() {
  const clock = $('[data-clock]');
  const date = $('[data-date]');
  if (!clock) return;
  const timeFmt = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const dateFmt = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  const tick = () => {
    const now = new Date();
    clock.textContent = timeFmt.format(now);
    if (date) {
      const d = dateFmt.format(now);
      date.textContent = d.charAt(0).toUpperCase() + d.slice(1);
    }
    // próxima atualização na virada do minuto
    setTimeout(tick, 60000 - (now.getSeconds() * 1000 + now.getMilliseconds()) + 50);
  };
  tick();
}

/* ---------- Texto "Rápido. Simples. Eficiente.": some ao sair pelo topo da tela ---------- */
function initScrollFade() {
  const el = $('.tagline');
  if (!el) return;
  const parts = [...el.children];
  let top = 0;
  const measure = () => {
    let y = 0;
    for (let e = el; e; e = e.offsetParent) y += e.offsetTop;
    top = y;
  };
  measure();
  window.addEventListener('resize', measure);
  window.addEventListener('load', measure);
  new ResizeObserver(measure).observe(document.body);
  let last = -1;
  ticker.add(() => {
    const s = scrollState.smooth;
    if (Math.abs(s - last) < 0.5) return;
    last = s;
    const header = 72;
    const yOnScreen = top - s;
    const start = scrollState.vh * 0.32;
    const o = clamp((yOnScreen - header) / (start - header));
    const v = o.toFixed(3);
    parts.forEach((p) => { if (p.style.opacity !== v) p.style.opacity = v; });
  });
}

/* ---------- Rodapé: dados da empresa (só aparecem quando preenchidos em CONFIG) ---------- */
function renderCompanyInfo() {
  const el = $('#companyInfo');
  if (!el) return;
  const { legalName, documentType = 'CNPJ', document: doc, address } = CONFIG.company || {};
  // pessoa física: "Responsável: Nome · Cidade - UF"
  const name = legalName && documentType === 'CPF' ? `Responsável: ${legalName}` : legalName;
  const parts = [name, doc && `${documentType} ${doc}`, address].filter(Boolean);
  if (!parts.length) return;
  el.textContent = parts.join(' · ');
  el.hidden = false;
}

/* ---------- "Explorar site": some quando a página sai do topo ---------- */
function initExploreButton() {
  const onScroll = () => heroEl.classList.toggle('is-scrolled', window.scrollY > 60);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
}

/* ---------- Início ---------- */
initCardShine();
initExploreButton();
renderCompanyInfo();
initPhoneClock();
initScrollFade();
renderTeam();
renderResults();
initHeader();
initReveal();
initHeroPointer();
initScrollFX();
initAtmosphere();
initPointerFX();
initCounters();
initBuy();
initForm();
$('#year').textContent = new Date().getFullYear();
fitHeroStage();
initOffscreenPause();
initFpsGuard();
initFallbackCard();
initShowcase();
initCard3D();
