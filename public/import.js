// JoseWines Bodeboca importer
(function () {
  var TOKEN = window.__JW_TOKEN;
  var API = 'https://josewines.netlify.app/.netlify/functions/import-bodeboca';
  var BASE = 'https://www.bodeboca.com/mi-bodega?sort=created-desc&page=';
  var seenIds = {};
  var totalImported = 0;
  var totalSkipped = 0;
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

  // Extract wine items from a page's HTML.
  // Handles both: dataLayer = [{ecommerce:{items:[]}}]
  //           and: dataLayer.push({ecommerce:{items:[]}})
  function getItems(html) {
    var results = [];
    var pos = 0;

    while (pos < html.length) {
      // Find next inline <script> block (skip ones with src=)
      var tagOpen = html.indexOf('<script', pos);
      if (tagOpen < 0) break;
      var tagClose = html.indexOf('>', tagOpen);
      if (tagClose < 0) break;
      var tagText = html.slice(tagOpen, tagClose + 1);
      if (tagText.indexOf('src=') >= 0) { pos = tagClose + 1; continue; }

      var contentStart = tagClose + 1;
      var contentEnd = html.indexOf('</script>', contentStart);
      if (contentEnd < 0) break;
      var src = html.slice(contentStart, contentEnd);
      pos = contentEnd + 9;

      if (src.indexOf('ecommerce') < 0) continue;

      // --- Pattern 1: dataLayer = [{...}] ---
      var searchFrom = 0;
      while (searchFrom < src.length) {
        var dlPos = src.indexOf('dataLayer', searchFrom);
        if (dlPos < 0) break;
        var i = dlPos + 9;
        // skip whitespace
        while (i < src.length && src[i] <= ' ') i++;
        // must be = but not == or =>
        if (src[i] !== '=') { searchFrom = dlPos + 1; continue; }
        i++;
        if (src[i] === '=' || src[i] === '>') { searchFrom = dlPos + 1; continue; }
        // skip whitespace after =
        while (i < src.length && src[i] <= ' ') i++;
        // must start with [
        if (src[i] !== '[') { searchFrom = dlPos + 1; continue; }

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
                results = results.concat(ev.ecommerce.items);
              }
            }
          }
        } catch (e) {}

        searchFrom = dlPos + 1;
      }

      // --- Pattern 2: dataLayer.push({ecommerce:{items:[...]}}) ---
      searchFrom = 0;
      while (searchFrom < src.length) {
        var pushPos = src.indexOf('dataLayer.push(', searchFrom);
        if (pushPos < 0) break;
        var objStart = src.indexOf('{', pushPos + 15);
        if (objStart < 0) break;

        var depth2 = 0, objEnd = -1;
        for (var m = objStart; m < src.length; m++) {
          if (src[m] === '{') depth2++;
          else if (src[m] === '}') { depth2--; if (depth2 === 0) { objEnd = m; break; } }
        }
        if (objEnd < 0) break;

        try {
          var pushed = JSON.parse(src.slice(objStart, objEnd + 1));
          if (pushed && pushed.ecommerce && Array.isArray(pushed.ecommerce.items) && pushed.ecommerce.items.length > 0) {
            results = results.concat(pushed.ecommerce.items);
          }
        } catch (e) {}

        searchFrom = pushPos + 1;
      }

      if (results.length > 0) return results; // found what we need in this script block
    }
    return results;
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

  // Send a batch of wines to the API
  function sendBatch(wines, page) {
    if (!wines.length) return Promise.resolve();
    return fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: TOKEN, wines: wines }),
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (res.ok) {
          totalImported += res.d.imported || 0;
          totalSkipped += res.d.skipped || 0;
        } else {
          throw new Error(res.d.error || 'Error al enviar página ' + page);
        }
      });
  }

  function fetchNext(page, emptyStreak) {
    if (page > MAX_PAGES) return Promise.resolve();
    show('Cargando página ' + page + '… (' + totalImported + ' guardados)');
    return delay(400)
      .then(function () { return fetchPage(page); })
      .then(function (h) {
        var items = getItems(h);
        if (items.length === 0) {
          if (emptyStreak >= 1) return; // two empty in a row = done
          return fetchNext(page + 1, emptyStreak + 1);
        }
        var wines = [];
        items.forEach(function (it) { var w = mapItem(it); if (w) wines.push(w); });
        // Send this page's wines immediately
        return sendBatch(wines, page).then(function () {
          show('Página ' + page + ' — ' + totalImported + ' guardados…');
          return fetchNext(page + 1, 0);
        });
      })
      .catch(function (err) {
        show('⚠️ Pág ' + page + ': ' + (err.message || 'error') + ' — continuando…');
        if (emptyStreak >= 1) return;
        return delay(600).then(function () { return fetchNext(page + 1, emptyStreak + 1); });
      });
  }

  // Start
  show('Cargando página 1…');
  fetchPage(1)
    .then(function (h1) {
      var items = getItems(h1);
      if (items.length === 0) {
        show('⚠️ No se detectaron vinos en la página 1.<br>'
          + 'Asegúrate de tener la sesión de Bodeboca activa.', true);
        return;
      }
      var batch = [];
      items.forEach(function (it) { var w = mapItem(it); if (w) batch.push(w); });
      return sendBatch(batch, 1).then(function () {
        show('Página 1 — ' + totalImported + ' guardados…');
        return fetchNext(2, 0).then(function () {
          if (totalImported === 0 && totalSkipped === 0) {
            show('⚠️ No se importó nada. Inténtalo de nuevo.', true);
          } else {
            show('✅ ' + totalImported + ' vinos importados'
              + (totalSkipped > 0 ? ', ' + totalSkipped + ' ya existían' : '')
              + '. <a href="https://josewines.netlify.app/pendientes" style="color:#f4a8a8">Ir a Pendientes →</a>', true);
          }
        });
      });
    })
    .catch(function (e) { show('❌ ' + (e.message || 'Error desconocido'), true); });
})();
