// JoseWines Bodeboca importer
(function () {
  var TOKEN = window.__JW_TOKEN;
  var API = 'https://josewines.netlify.app/.netlify/functions/import-bodeboca';
  var BASE = 'https://www.bodeboca.com/mi-bodega?sort=created-desc&page=';
  var wines = [];
  var seenIds = {};
  var MAX_PAGES = 60;

  function show(msg, done) {
    var el = document.getElementById('__jw');
    if (!el) {
      el = document.createElement('div');
      el.id = '__jw';
      el.style.cssText = 'position:fixed;top:16px;right:16px;z-index:2147483647;'
        + 'background:#1a0505;color:#f4a8a8;border:2px solid #8f1919;'
        + 'border-radius:14px;padding:14px 18px;font-family:sans-serif;'
        + 'font-size:13px;max-width:320px;box-shadow:0 4px 24px rgba(0,0,0,.8);line-height:1.6';
      document.body.appendChild(el);
    }
    el.innerHTML = '<b style="color:white;font-size:14px">🍷 Mi Bodega</b><br>' + msg
      + (done ? '' : '<br><small style="color:#771b1b">No cierres esta pestaña…</small>');
  }

  function delay(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }

  // Extract wine items from page HTML.
  // Looks for inline <script> blocks containing dataLayer = [{ecommerce:{items:[...]}}]
  function getItems(html) {
    var pos = 0;
    while (pos < html.length) {
      // Find next <script ...> opening tag
      var tagOpen = html.indexOf('<script', pos);
      if (tagOpen < 0) break;
      var tagClose = html.indexOf('>', tagOpen);
      if (tagClose < 0) break;

      // Skip external scripts (have src=)
      var tagText = html.slice(tagOpen, tagClose + 1);
      if (tagText.indexOf('src=') >= 0) { pos = tagClose + 1; continue; }

      var contentStart = tagClose + 1;
      var contentEnd = html.indexOf('</script>', contentStart);
      if (contentEnd < 0) break;

      var src = html.slice(contentStart, contentEnd);
      pos = contentEnd + 9;

      // Quick filter: must contain both 'ecommerce' and 'items'
      if (src.indexOf('"ecommerce"') < 0 || src.indexOf('"items"') < 0) continue;

      // Find the dataLayer = [...] assignment specifically.
      // Avoids matching dataLayer || [] or window.dataLayer checks.
      var searchFrom = 0;
      while (searchFrom < src.length) {
        var dlPos = src.indexOf('dataLayer', searchFrom);
        if (dlPos < 0) break;

        // Skip past 'dataLayer'
        var i = dlPos + 9;
        // Skip whitespace
        while (i < src.length && src[i] <= ' ') i++;
        // Must be '=' but not '==' or '=>'
        if (src[i] !== '=') { searchFrom = dlPos + 1; continue; }
        i++;
        if (src[i] === '=' || src[i] === '>') { searchFrom = dlPos + 1; continue; }
        // Skip whitespace after '='
        while (i < src.length && src[i] <= ' ') i++;
        // Must start with '['
        if (src[i] !== '[') { searchFrom = dlPos + 1; continue; }

        // Found 'dataLayer = [' — count brackets to find end
        var arrStart = i;
        var depth = 0, arrEnd = -1;
        for (var j = arrStart; j < src.length; j++) {
          if (src[j] === '[') depth++;
          else if (src[j] === ']') { depth--; if (depth === 0) { arrEnd = j; break; } }
        }
        if (arrEnd < 0) break;

        try {
          var dl = JSON.parse(src.slice(arrStart, arrEnd + 1));
          if (Array.isArray(dl)) {
            for (var k = 0; k < dl.length; k++) {
              var ev = dl[k];
              if (ev && ev.ecommerce && Array.isArray(ev.ecommerce.items) && ev.ecommerce.items.length > 0) {
                return ev.ecommerce.items;
              }
            }
          }
        } catch (e) { /* malformed JSON, try next */ }

        searchFrom = dlPos + 1;
      }
    }
    return [];
  }

  function mapItem(it) {
    var id = String(it.item_id || it.id || '');
    if (!id) id = (it.item_name || '') + '|' + (it.price || '');
    if (seenIds[id]) return null;
    seenIds[id] = true;
    var vintage = null;
    if (it.item_category5) { var v = parseInt(it.item_category5); if (v > 1900 && v < 2100) vintage = v; }
    return {
      name: (it.item_name || '').slice(0, 200),
      winery: (it.item_category || it.item_brand || '').slice(0, 100),
      vintage_year: vintage,
      purchase_date: new Date().toISOString().slice(0, 10),
      price_per_bottle: parseFloat(it.price) || 0,
      units_purchased: parseInt(it.quantity) || 1,
      region: it.item_category4 || null,
      source_order_id: id,
      label_image_url: null,
    };
  }

  function fetchPage(page) {
    return fetch(BASE + page, { credentials: 'include' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status + ' en página ' + page);
        return r.text();
      });
  }

  function send() {
    show('Enviando ' + wines.length + ' vinos…');
    return fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: TOKEN, wines: wines }),
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (res.ok) {
          show('&#x2705; ' + res.d.imported + ' vinos importados'
            + (res.d.skipped > 0 ? ', ' + res.d.skipped + ' ya existían' : '')
            + '. <a href="https://josewines.netlify.app/pendientes" style="color:#f4a8a8">Ir a Pendientes →</a>', true);
        } else {
          show('&#x274C; ' + (res.d.error || 'Error desconocido'), true);
        }
      });
  }

  // Fetch pages adaptively: keep going until two consecutive pages return no items.
  // This avoids having to detect the total page count from the HTML.
  function fetchNext(page, emptyStreak) {
    if (page > MAX_PAGES) return Promise.resolve();
    show('Cargando página ' + page + '… (' + wines.length + ' vinos)');
    return delay(300)
      .then(function () { return fetchPage(page); })
      .then(function (h) {
        var items = getItems(h);
        if (items.length === 0) {
          // Page returned no items — could be past the end or a transient issue
          if (emptyStreak >= 1) return; // two in a row = definitely done
          return fetchNext(page + 1, emptyStreak + 1);
        }
        items.forEach(function (it) { var w = mapItem(it); if (w) wines.push(w); });
        show('Página ' + page + ' — ' + wines.length + ' vinos…');
        return fetchNext(page + 1, 0);
      })
      .catch(function (err) {
        // On fetch error, count as empty and try next page once
        if (emptyStreak >= 1) return;
        return delay(500).then(function () { return fetchNext(page + 1, emptyStreak + 1); });
      });
  }

  // Start
  show('Cargando página 1…');
  fetchPage(1)
    .then(function (h1) {
      var items = getItems(h1);
      if (items.length === 0) {
        show('⚠️ No se encontraron vinos en la página 1.<br>'
          + 'Asegúrate de estar en bodeboca.com con sesión iniciada.', true);
        return;
      }
      items.forEach(function (it) { var w = mapItem(it); if (w) wines.push(w); });
      show('Página 1 — ' + wines.length + ' vinos…');
      return fetchNext(2, 0).then(function () {
        if (wines.length === 0) {
          show('⚠️ No se encontraron vinos. Recarga bodeboca.com e inténtalo de nuevo.', true);
          return;
        }
        return send();
      });
    })
    .catch(function (e) { show('&#x274C; ' + (e.message || 'Error desconocido'), true); });
})();
