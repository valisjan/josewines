import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, BookMarked, RefreshCw, CheckCircle2, Copy } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function ImportPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [token, setToken] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)

  const generateToken = async () => {
    if (!user) return
    setGenerating(true)

    // Delete any existing unused tokens for this user
    await supabase.from('import_tokens').delete().eq('user_id', user.id).eq('used', false)

    const { data } = await supabase
      .from('import_tokens')
      .insert({ user_id: user.id })
      .select('token')
      .single()

    setToken(data?.token ?? null)
    setGenerating(false)
  }

  const bookmarkletCode = token ? buildBookmarklet(token) : ''

  const copyBookmarklet = () => {
    navigator.clipboard.writeText(bookmarkletCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="px-4 py-6 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="text-wine-400 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-bold text-white">Importar de Bodeboca</h1>
      </div>

      <p className="text-wine-400 text-sm mb-6 leading-relaxed">
        Importa todo tu historial de pedidos de Bodeboca automáticamente.
        El bookmarklet recorre todas las páginas de pedidos y los manda aquí
        para que los confirmes.
      </p>

      {/* Step 1 */}
      <div className="space-y-4">
        <Step number={1} title="Genera tu enlace de importación">
          <button
            onClick={generateToken}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-wine-700 hover:bg-wine-600 text-white text-sm font-semibold transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
            {token ? 'Regenerar enlace' : 'Generar enlace'}
          </button>
          {token && (
            <p className="text-green-400 text-xs mt-2 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Enlace generado · válido 2 horas · un solo uso
            </p>
          )}
        </Step>

        {token && (
          <>
            {/* Step 2 */}
            <Step number={2} title='Añade el bookmarklet a tu barra de favoritos'>
              <div className="space-y-3">
                <p className="text-wine-400 text-xs leading-relaxed">
                  <strong className="text-wine-300">En ordenador:</strong> arrastra este botón a tu barra de favoritos del navegador.
                </p>
                <a
                  href={bookmarkletCode}
                  onClick={e => e.preventDefault()}
                  draggable
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1a1a2e] border border-[#4a4a8a] text-[#a0a0ff] text-sm font-semibold cursor-grab active:cursor-grabbing select-none"
                >
                  <BookMarked className="w-4 h-4" />
                  📦 Importar Bodeboca
                </a>
                <p className="text-wine-500 text-xs">
                  <strong className="text-wine-400">En móvil:</strong> copia el código y pégalo como URL de un marcador manualmente.
                </p>
                <button
                  onClick={copyBookmarklet}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-wine-900/60 border border-wine-700/40 text-wine-400 hover:text-white text-xs transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copied ? '¡Copiado!' : 'Copiar código del bookmarklet'}
                </button>
              </div>
            </Step>

            {/* Step 3 */}
            <Step number={3} title="Ejecuta el bookmarklet en Bodeboca">
              <ol className="text-wine-400 text-sm space-y-1.5 list-none">
                <li>1. Ve a <a href="https://www.bodeboca.com/mi-bodega?sort=created-desc&page=1" target="_blank" rel="noopener noreferrer" className="text-wine-300 underline underline-offset-2">bodeboca.com/mi-bodega</a> (con tu sesión iniciada)</li>
                <li>2. Haz clic en el bookmarklet <strong className="text-wine-300">"📦 Importar Bodeboca"</strong></li>
                <li>3. Espera — descarga tus 27 páginas en segundo plano sin moverte de la pestaña</li>
                <li>4. Cuando aparezca ✅, haz clic en <strong className="text-wine-300">Ir a Pendientes</strong> para confirmar los vinos</li>
              </ol>
            </Step>

            {/* Warning */}
            <div className="px-4 py-3 rounded-xl bg-gold-500/10 border border-gold-500/25 text-gold-400 text-xs leading-relaxed">
              ⚠️ Este enlace es de un solo uso y caduca en 2 horas. Si necesitas importar de nuevo, genera uno nuevo.
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Step({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="w-7 h-7 rounded-full bg-wine-700 flex items-center justify-center flex-shrink-0 mt-0.5">
        <span className="text-white text-xs font-bold">{number}</span>
      </div>
      <div className="flex-1">
        <p className="text-white font-semibold text-sm mb-3">{title}</p>
        {children}
      </div>
    </div>
  )
}

function buildBookmarklet(token: string): string {
  const apiUrl = 'https://josewines.netlify.app/.netlify/functions/import-bodeboca'
  const BASE_URL = 'https://www.bodeboca.com/mi-bodega?sort=created-desc&page='

  const script = `
(function() {
  const TOKEN = '${token}';
  const API = '${apiUrl}';
  const BASE = '${BASE_URL}';
  const wines = [];

  function showStatus(msg, done) {
    let el = document.getElementById('__jw_status');
    if (!el) {
      el = document.createElement('div');
      el.id = '__jw_status';
      el.style.cssText = 'position:fixed;top:16px;right:16px;z-index:999999;background:#1a0505;color:#f4a8a8;border:1px solid #8f1919;border-radius:14px;padding:14px 18px;font-family:sans-serif;font-size:13px;max-width:300px;box-shadow:0 4px 24px rgba(0,0,0,0.6);line-height:1.5;';
      document.body.appendChild(el);
    }
    el.innerHTML = '<b style="color:white;font-size:14px">🍷 Mi Bodega</b><br>' + msg + (done ? '' : '<br><small style="color:#8f1919">No cierres esta pestaña...</small>');
  }

  function parseDate(str) {
    if (!str) return new Date().toISOString().split('T')[0];
    const m = str.match(/(\\d{1,2})[\\/-](\\d{1,2})[\\/-](\\d{4})/);
    if (m) return m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0');
    const m2 = str.match(/(\\d{4})[\\/-](\\d{1,2})[\\/-](\\d{1,2})/);
    if (m2) return m2[1]+'-'+m2[2].padStart(2,'0')+'-'+m2[3].padStart(2,'0');
    // Spanish month names
    const months = {enero:1,febrero:2,marzo:3,abril:4,mayo:5,junio:6,julio:7,agosto:8,septiembre:9,octubre:10,noviembre:11,diciembre:12};
    const m3 = str.toLowerCase().match(/(\\d{1,2})\\s+de\\s+(\\w+)\\s+(?:de\\s+)?(\\d{4})/);
    if (m3 && months[m3[2]]) return m3[3]+'-'+String(months[m3[2]]).padStart(2,'0')+'-'+m3[1].padStart(2,'0');
    return new Date().toISOString().split('T')[0];
  }

  function parseDoc(doc) {
    const items = [];
    const seen = new Set();

    // Bodeboca mi-bodega: each wine is a card/article
    // Try multiple possible container selectors
    const containers = doc.querySelectorAll(
      'article, .wine-card, .cellar-item, [class*="cellar"], [class*="wine-item"], ' +
      '[class*="product-card"], .product, li.item, [data-wine-id], [data-product-id]'
    );

    containers.forEach((el, idx) => {
      // Skip navigation, header, footer elements
      if (el.closest('nav, header, footer, [class*="nav"], [class*="header"], [class*="footer"]')) return;

      // Name — try multiple selectors in priority order
      const nameEl = el.querySelector(
        'h1, h2, h3, h4, [class*="wine-name"], [class*="product-name"], [class*="name"], [class*="title"], [itemprop="name"]'
      );
      const name = nameEl?.textContent?.trim().replace(/\\s+/g,' ');
      if (!name || name.length < 4 || name.length > 200) return;
      if (seen.has(name)) return;
      seen.add(name);

      // Vintage — often in name or separate element
      const vintageEl = el.querySelector('[class*="vintage"], [class*="anada"], [class*="year"]');
      const vintageText = vintageEl?.textContent?.trim() || name;
      const vintageMatch = vintageText.match(/\\b(19[5-9]\\d|20[0-2]\\d)\\b/);
      const vintage = vintageMatch ? parseInt(vintageMatch[0]) : null;

      // Winery / bodega
      const wineryEl = el.querySelector('[class*="winery"], [class*="bodega"], [class*="producer"], [class*="brand"]');
      const winery = wineryEl?.textContent?.trim() || name.split(' ').slice(0,2).join(' ');

      // Region / DO
      const regionEl = el.querySelector('[class*="region"], [class*="do"], [class*="appellation"], [class*="denomination"]');
      const region = regionEl?.textContent?.trim() || null;

      // Price — look for numeric price
      const priceEls = el.querySelectorAll('[class*="price"], [class*="precio"], [itemprop="price"]');
      let price = 0;
      priceEls.forEach(p => {
        const val = parseFloat(p.textContent?.replace(/[^\\d,]/g,'').replace(',','.') || '0');
        if (val > 0 && val < 10000) price = val;
      });

      // Quantity
      const qtyEl = el.querySelector('[class*="qty"], [class*="quantity"], [class*="units"], [class*="bottles"], [class*="botellas"], [class*="cantidad"]');
      const qty = parseInt(qtyEl?.textContent?.replace(/[^\\d]/g,'') || '1') || 1;

      // Date
      const dateEl = el.querySelector('[class*="date"], [class*="fecha"], time, [class*="purchased"], [class*="compra"]');
      const date = parseDate(dateEl?.textContent?.trim() || dateEl?.getAttribute('datetime') || '');

      // Image
      const imgEl = el.querySelector('img[src*="wine"], img[src*="vino"], img[src*="product"], img[src*="bottle"], img:not([src*="icon"]):not([src*="logo"])');
      const imgUrl = imgEl?.src || null;

      // Unique ID from data attributes or URL
      const link = el.querySelector('a[href*="/vino/"], a[href*="/wine/"], a[href*="/producto/"]');
      const href = link?.getAttribute('href') || '';
      const slugMatch = href.match(/\\/([\\w-]+)(?:\\?|$)/);
      const sourceId = el.dataset.wineId || el.dataset.productId || el.dataset.orderId || slugMatch?.[1] || (idx + '-' + name.substring(0,20));

      items.push({
        name,
        winery,
        vintage_year: vintage,
        purchase_date: date,
        price_per_bottle: price,
        units_purchased: qty,
        region,
        source_order_id: String(sourceId),
        label_image_url: imgUrl,
      });
    });

    return items;
  }

  function detectTotalPages(doc) {
    // Look for pagination
    const pag = doc.querySelector('.pagination, [class*="paginat"], nav[aria-label*="page"], [class*="pages"]');
    if (!pag) return 27; // fallback to known total
    const nums = [...pag.querySelectorAll('a, span, button')]
      .map(el => parseInt(el.textContent?.trim() || '0'))
      .filter(n => n > 0 && n < 200);
    return nums.length ? Math.max(...nums) : 27;
  }

  async function run() {
    showStatus('Cargando página 1...');

    // Fetch page 1 to detect total pages
    let resp = await fetch(BASE + '1', { credentials: 'include' });
    let html = await resp.text();
    let doc = new DOMParser().parseFromString(html, 'text/html');
    const totalPages = detectTotalPages(doc);
    wines.push(...parseDoc(doc));

    showStatus('Página 1/' + totalPages + ' — ' + wines.length + ' vinos...');

    for (let p = 2; p <= totalPages; p++) {
      showStatus('Cargando página ' + p + '/' + totalPages + '...<br>' + wines.length + ' vinos encontrados');
      resp = await fetch(BASE + p, { credentials: 'include' });
      html = await resp.text();
      doc = new DOMParser().parseFromString(html, 'text/html');
      wines.push(...parseDoc(doc));
      await new Promise(r => setTimeout(r, 300)); // small delay to be polite
    }

    showStatus('Enviando ' + wines.length + ' vinos...');
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: TOKEN, wines }),
      });
      const data = await res.json();
      if (res.ok) {
        showStatus('✅ ' + data.imported + ' vinos importados' + (data.skipped > 0 ? ', ' + data.skipped + ' ya existían' : '') + '.<br><a href="https://josewines.netlify.app/pendientes" style="color:#f4a8a8">Ir a Pendientes →</a>', true);
      } else {
        showStatus('❌ ' + (data.error || 'Error desconocido'), true);
      }
    } catch(e) {
      showStatus('❌ Error de conexión: ' + e.message, true);
    }
  }

  run().catch(e => showStatus('❌ Error: ' + e.message, true));
})();
  `.trim()

  return 'javascript:' + encodeURIComponent(script)
}
