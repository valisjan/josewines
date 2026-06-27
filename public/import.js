// JoseWines Bodeboca importer — loaded dynamically by bookmarklet
(function () {
  var TOKEN = window.__JW_TOKEN;
  var API = 'https://josewines.netlify.app/.netlify/functions/import-bodeboca';
  var BASE = 'https://www.bodeboca.com/mi-bodega?sort=created-desc&page=';
  var wines = [];
  var seenIds = {};

  function show(msg, done) {
    var el = document.getElementById('__jw');
    if (!el) {
      el = document.createElement('div');
      el.id = '__jw';
      el.style.cssText = [
        'position:fixed', 'top:16px', 'right:16px', 'z-index:2147483647',
        'background:#1a0505', 'color:#f4a8a8', 'border:2px solid #8f1919',
        'border-radius:14px', 'padding:14px 18px', 'font-family:sans-serif',
        'font-size:13px', 'max-width:300px', 'box-shadow:0 4px 24px rgba(0,0,0,.8)',
        'line-height:1.6',
      ].join(';');
      document.body.appendChild(el);
    }
    el.innerHTML = '<b style="color:white;font-size:14px">🍷 Mi Bodega</b><br>' + msg +
      (done ? '' : '<br><small style="color:#771b1b">No cierres esta pestaña…</small>');
  }

  function getItems(html) {
    var scriptRe = /<script[^>]*>([\s\S]*?)<\/script>/gi;
    var m, dl;
    while ((m = scriptRe.exec(html)) !== null) {
      var src = m[1];
      if (src.indexOf('dataLayer') < 0 || src.indexOf('ecommerce') < 0) continue;
      var idx = src.indexOf('dataLayer');
      var chunk = src.slice(idx);
      var start = chunk.indexOf('[');
      if (start < 0) continue;
      // Find matching closing bracket
      var depth = 0, end = -1;
      for (var i = start; i < chunk.length; i++) {
        if (chunk[i] === '[') depth++;
        else if (chunk[i] === ']') { depth--; if (depth === 0) { end = i; break; } }
      }
      if (end < 0) continue;
      try {
        dl = JSON.parse(chunk.slice(start, end + 1));
        for (var j = 0; j < dl.length; j++) {
          if (dl[j].ecommerce && dl[j].ecommerce.items) return dl[j].ecommerce.items;
        }
      } catch (e) {}
    }
    return [];
  }

  function getPages(html) {
    var max = 1;
    var re = /[?&]page=(\d+)/g;
    var m;
    while ((m = re.exec(html)) !== null) {
      var n = parseInt(m[1]);
      if (n > max) max = n;
    }
    return max;
  }

  function mapItem(it) {
    var id = String(it.item_id || it.id || (Math.random() * 1e9 | 0));
    if (seenIds[id]) return null;
    seenIds[id] = true;
    return {
      name: (it.item_name || '').slice(0, 200),
      winery: (it.item_category || it.item_brand || '').slice(0, 100),
      vintage_year: it.item_category5 ? parseInt(it.item_category5) : null,
      purchase_date: new Date().toISOString().slice(0, 10),
      price_per_bottle: parseFloat(it.price) || 0,
      units_purchased: parseInt(it.quantity) || 1,
      region: it.item_category4 || null,
      source_order_id: id,
      label_image_url: null,
    };
  }

  function fetchPage(page) {
    return fetch(BASE + page, { credentials: 'include' }).then(function (r) { return r.text(); });
  }

  function send() {
    show('Enviando ' + wines.length + ' vinos…');
    return fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: TOKEN, wines: wines }),
    }).then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (res.ok) {
          show('&#x2705; ' + res.d.imported + ' vinos importados' +
            (res.d.skipped > 0 ? ', ' + res.d.skipped + ' ya existían' : '') +
            '. <a href="https://josewines.netlify.app/pendientes" style="color:#f4a8a8">Ir a Pendientes →</a>', true);
        } else {
          show('&#x274C; ' + (res.d.error || 'Error desconocido'), true);
        }
      });
  }

  show('Cargando página 1…');
  fetchPage(1).then(function (h1) {
    var total = getPages(h1);
    getItems(h1).forEach(function (it) { var w = mapItem(it); if (w) wines.push(w); });
    show('Página 1/' + total + ' — ' + wines.length + ' vinos…');

    var chain = Promise.resolve();
    for (var p = 2; p <= total; p++) {
      (function (page) {
        chain = chain.then(function () {
          return fetchPage(page).then(function (h) {
            getItems(h).forEach(function (it) { var w = mapItem(it); if (w) wines.push(w); });
            show('Página ' + page + '/' + total + ' — ' + wines.length + ' vinos…');
            return new Promise(function (r) { setTimeout(r, 250); });
          });
        });
      })(p);
    }
    return chain.then(send);
  }).catch(function (e) { show('&#x274C; ' + e.message, true); });
})();
