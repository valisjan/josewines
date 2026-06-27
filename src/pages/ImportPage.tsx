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
                <li>1. Ve a <a href="https://www.bodeboca.com/pedidos" target="_blank" rel="noopener noreferrer" className="text-wine-300 underline underline-offset-2">bodeboca.com/pedidos</a> (con tu sesión iniciada)</li>
                <li>2. Haz clic en el bookmarklet <strong className="text-wine-300">"📦 Importar Bodeboca"</strong></li>
                <li>3. Espera mientras recorre todas tus páginas de pedidos automáticamente</li>
                <li>4. Cuando termine, vuelve aquí y ve a <strong className="text-wine-300">Pendientes</strong> para confirmar los vinos</li>
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

  const script = `
(function() {
  const TOKEN = '${token}';
  const API = '${apiUrl}';
  const wines = [];
  let currentPage = 1;
  let totalPages = 1;

  function showStatus(msg, done) {
    let el = document.getElementById('__jw_status');
    if (!el) {
      el = document.createElement('div');
      el.id = '__jw_status';
      el.style.cssText = 'position:fixed;top:16px;right:16px;z-index:999999;background:#1a0505;color:#f4a8a8;border:1px solid #8f1919;border-radius:12px;padding:12px 16px;font-family:sans-serif;font-size:14px;max-width:320px;box-shadow:0 4px 20px rgba(0,0,0,0.5);';
      document.body.appendChild(el);
    }
    el.innerHTML = '<strong style="color:white">Mi Bodega</strong><br>' + msg + (done ? '' : '<br><small style="color:#df4444">No cierres esta pestaña...</small>');
  }

  function parseDate(str) {
    if (!str) return new Date().toISOString().split('T')[0];
    const m = str.match(/(\\d{1,2})[\\/-](\\d{1,2})[\\/-](\\d{4})/);
    if (m) return m[3] + '-' + m[2].padStart(2,'0') + '-' + m[1].padStart(2,'0');
    const m2 = str.match(/(\\d{4})[\\/-](\\d{1,2})[\\/-](\\d{1,2})/);
    if (m2) return m2[1] + '-' + m2[2].padStart(2,'0') + '-' + m2[3].padStart(2,'0');
    return new Date().toISOString().split('T')[0];
  }

  function parsePage() {
    const items = [];

    // Try to find pagination total
    const pageInfo = document.querySelector('.pagination, [class*="paginat"]');
    if (pageInfo) {
      const nums = pageInfo.innerText.match(/\\d+/g);
      if (nums) totalPages = Math.max(...nums.map(Number));
    }

    // Order containers - try multiple selectors Bodeboca might use
    const orders = document.querySelectorAll(
      '[class*="order-item"], [class*="pedido"], [data-order-id], .order-row, article[class*="order"], li[class*="order"]'
    );

    orders.forEach(order => {
      // Order date
      const dateEl = order.querySelector('[class*="date"], [class*="fecha"], time');
      const date = parseDate(dateEl?.textContent?.trim());

      // Order ID
      const orderIdEl = order.querySelector('[class*="order-id"], [class*="numero"], [class*="reference"]');
      const orderId = orderIdEl?.textContent?.replace(/[^\\w-]/g,'').trim() || null;

      // Product lines within the order
      const products = order.querySelectorAll(
        '[class*="product"], [class*="item"], [class*="line-item"], [class*="producto"]'
      );

      if (products.length > 0) {
        products.forEach(prod => {
          const nameEl = prod.querySelector('[class*="name"], [class*="title"], [class*="nombre"], h3, h4, a');
          const name = nameEl?.textContent?.trim();
          if (!name || name.length < 4) return;

          const priceEl = prod.querySelector('[class*="price"], [class*="precio"]');
          const priceText = priceEl?.textContent?.replace(/[^\\d.,]/g,'').replace(',','.') || '0';
          const price = parseFloat(priceText) || 0;

          const qtyEl = prod.querySelector('[class*="qty"], [class*="quantity"], [class*="cantidad"], [class*="units"]');
          const qty = parseInt(qtyEl?.textContent?.replace(/[^\\d]/g,'') || '1') || 1;

          const imgEl = prod.querySelector('img');
          const imgUrl = imgEl?.src || null;

          const vintageMatch = name.match(/\\b(19|20)\\d{2}\\b/);
          const vintage = vintageMatch ? parseInt(vintageMatch[0]) : null;

          items.push({
            name: name.substring(0, 200),
            winery: name.split(' ').slice(0,2).join(' '),
            vintage_year: vintage,
            purchase_date: date,
            price_per_bottle: qty > 0 ? Math.round((price / qty) * 100) / 100 : price,
            units_purchased: qty,
            region: null,
            source_order_id: orderId ? orderId + '-' + items.length : null,
            label_image_url: imgUrl,
          });
        });
      } else {
        // Fallback: treat the whole order as one item
        const nameEl = order.querySelector('[class*="name"], [class*="title"], [class*="nombre"], h3, h4');
        const name = nameEl?.textContent?.trim();
        if (!name || name.length < 4) return;

        const priceEl = order.querySelector('[class*="price"], [class*="precio"], [class*="total"]');
        const price = parseFloat(priceEl?.textContent?.replace(/[^\\d.,]/g,'').replace(',','.') || '0') || 0;

        const imgEl = order.querySelector('img');
        const vintageMatch = name.match(/\\b(19|20)\\d{2}\\b/);

        items.push({
          name: name.substring(0, 200),
          winery: name.split(' ').slice(0,2).join(' '),
          vintage_year: vintageMatch ? parseInt(vintageMatch[0]) : null,
          purchase_date: date,
          price_per_bottle: price,
          units_purchased: 1,
          region: null,
          source_order_id: orderId,
          label_image_url: imgEl?.src || null,
        });
      }
    });

    return items;
  }

  async function goToPage(page) {
    return new Promise(resolve => {
      // Try common pagination patterns
      const url = new URL(window.location.href);
      url.searchParams.set('page', page);
      window.history.pushState({}, '', url);

      // Try clicking page link
      const pageLink = document.querySelector('a[href*="page=' + page + '"], a[data-page="' + page + '"]');
      if (pageLink) {
        pageLink.click();
        setTimeout(resolve, 2000);
      } else {
        window.location.href = url.toString();
        setTimeout(resolve, 2500);
      }
    });
  }

  async function run() {
    showStatus('Analizando página ' + currentPage + '...');

    // Parse first page
    const firstBatch = parsePage();
    wines.push(...firstBatch);

    // Detect total pages
    const nextBtn = document.querySelector('a[rel="next"], [class*="next"]:not([disabled]), .pagination a:last-child');
    if (!nextBtn && totalPages === 1) {
      await send();
      return;
    }

    // Navigate through remaining pages
    for (let p = 2; p <= Math.min(totalPages, 50); p++) {
      showStatus('Importando página ' + p + ' de ' + totalPages + '...<br>(' + wines.length + ' vinos encontrados)');
      await goToPage(p);
      const batch = parsePage();
      wines.push(...batch);
    }

    await send();
  }

  async function send() {
    showStatus('Enviando ' + wines.length + ' vinos a tu bodega...');
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: TOKEN, wines }),
      });
      const data = await res.json();
      if (res.ok) {
        showStatus('✅ ¡Listo! ' + data.imported + ' vinos importados' + (data.skipped > 0 ? ', ' + data.skipped + ' ya existían' : '') + '.<br>Vuelve a josewines.netlify.app → Pendientes para confirmarlos.', true);
      } else {
        showStatus('❌ Error: ' + (data.error || 'Inténtalo de nuevo'), true);
      }
    } catch(e) {
      showStatus('❌ Error de conexión. Comprueba que estás conectado.', true);
    }
  }

  run();
})();
  `.trim()

  return 'javascript:' + encodeURIComponent(script)
}
