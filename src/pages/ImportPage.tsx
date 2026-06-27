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
  const seenIds = new Set();

  function showStatus(msg, done) {
    let el = document.getElementById('__jw_status');
    if (!el) {
      el = document.createElement('div');
      el.id = '__jw_status';
      el.style.cssText = 'position:fixed;top:16px;right:16px;z-index:999999;background:#1a0505;color:#f4a8a8;border:1px solid #8f1919;border-radius:14px;padding:14px 18px;font-family:sans-serif;font-size:13px;max-width:300px;box-shadow:0 4px 24px rgba(0,0,0,0.6);line-height:1.6;';
      document.body.appendChild(el);
    }
    el.innerHTML = '<b style="color:white;font-size:14px">🍷 Mi Bodega</b><br>' + msg + (done ? '' : '<br><small style="color:#771b1b">No cierres esta pestaña...</small>');
  }

  // Bodeboca embeds ALL wine data in the dataLayer Google Analytics script.
  // Fields: item_name, item_category (winery), item_category3 (country),
  //         item_category4 (region/DO), item_category5 (vintage), price, quantity, item_id
  function extractItems(html) {
    const scriptRe = /<script[^>]*>([\s\S]*?)<\/script>/gi;
    let m;
    while ((m = scriptRe.exec(html)) !== null) {
      const src = m[1];
      if (!src.includes('dataLayer') || !src.includes('ecommerce')) continue;
      const dlRe = /dataLayer\s*=\s*(\[[\s\S]*?\])\s*;/;
      const dlM = dlRe.exec(src);
      if (!dlM) continue;
      try {
        const dl = JSON.parse(dlM[1]);
        const ev = dl.find(function(e) { return e.ecommerce && e.ecommerce.items; });
        if (ev) return ev.ecommerce.items;
      } catch(e) {}
    }
    return [];
  }

  function detectTotalPages(html) {
    // Find highest page= number in pagination links
    const nums = [];
    const re = /[?&]page=(\\d+)/g;
    let m;
    while ((m = re.exec(html)) !== null) nums.push(parseInt(m[1]));
    return nums.length ? Math.max(...nums) : 27;
  }

  function mapItem(it) {
    const id = String(it.item_id || it.id || Math.random());
    if (seenIds.has(id)) return null;
    seenIds.add(id);
    return {
      name:             (it.item_name || '').substring(0, 200),
      winery:           (it.item_category || it.item_brand || '').substring(0, 100),
      vintage_year:     it.item_category5 ? parseInt(it.item_category5) : null,
      purchase_date:    new Date().toISOString().split('T')[0],
      price_per_bottle: parseFloat(it.price) || 0,
      units_purchased:  parseInt(it.quantity) || 1,
      region:           it.item_category4 || null,
      source_order_id:  id,
      label_image_url:  null,
    };
  }

  async function run() {
    showStatus('Cargando página 1...');
    const r1 = await fetch(BASE + '1', { credentials: 'include' });
    const h1 = await r1.text();
    const totalPages = detectTotalPages(h1);
    extractItems(h1).forEach(function(it) { const w = mapItem(it); if (w) wines.push(w); });
    showStatus('Página 1/' + totalPages + ' — ' + wines.length + ' vinos...');

    for (let p = 2; p <= totalPages; p++) {
      showStatus('Página ' + p + '/' + totalPages + ' — ' + wines.length + ' vinos...');
      const r = await fetch(BASE + p, { credentials: 'include' });
      const h = await r.text();
      extractItems(h).forEach(function(it) { const w = mapItem(it); if (w) wines.push(w); });
      await new Promise(function(res) { setTimeout(res, 250); });
    }

    showStatus('Enviando ' + wines.length + ' vinos...');
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: TOKEN, wines: wines }),
    });
    const data = await res.json();
    if (res.ok) {
      showStatus('✅ ' + data.imported + ' vinos importados' + (data.skipped > 0 ? ', ' + data.skipped + ' ya existían' : '') + '.<br><a href="https://josewines.netlify.app/pendientes" style="color:#f4a8a8">Ir a Pendientes →</a>', true);
    } else {
      showStatus('❌ ' + (data.error || 'Error'), true);
    }
  }

  run().catch(function(e) { showStatus('❌ ' + e.message, true); });
})();
  `.trim()

  return 'javascript:' + encodeURIComponent(script)
}
