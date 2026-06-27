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
        + 'font-size:13px;max-width:340px;box-shadow:0 4px 24px rgba(0,0,0,.8);line-height:1.8';
      document.body.appendChild(el);
    }
    el.innerHTML = '<b style="color:white;font-size:14px">🍷 Mi Bodega</b><br>' + msg
      + (done ? '' : '<br><small style="color:#771b1b">No cierres esta pestaña…</small>');
  }

  function log(label, value) {
    console.log('[JoseWines] ' + label, value !== undefined ? value : '');
  }

  function delay(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }

  function getItems(html) {
    var found = [];
    var pos = 0;
    var scriptCount = 0;
    var ecommerceScripts = 0;

    while (pos < html.length) {
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
      scriptCount++;

      if (src.indexOf('ecommerce') < 0) continue;
      ecommerceScripts++;
      log('Script con "ecommerce" encontrado, longitud:', src.length);

      // Pattern 1: dataLayer = [{...}]
      var searchFrom = 0;
      while (searchFrom < src.length) {
        var dlPos = src.indexOf('dataLayer', searchFrom);
        if (dlPos < 0) break;
        var i = dlPos + 9;
        while (i < src.length && src[i] <= ' ') i++;
        if (src[i] !== '=') { searchFrom = dlPos + 1; continue; }
        i++;
        if (src[i] === '=' || src[i] === '>') { searchFrom = dlPos + 1; continue; }
        while (i < src.length && src[i] <= ' ') i++;
        if (src[i] !== '[') {
          log('dataLayer = (no [), siguiente char:', JSON.stringify(src.slice(i, i + 20)));
          searchFrom = dlPos + 1; continue;
        }

        var arrStart = i;
        var depth = 0, arrEnd = -1;
        for (var j = arrStart; j < src.length; j++) {
          if (src[j] === '[') depth++;
          else if (src[j] === ']') { depth--; if (depth === 0) { arrEnd = j; break; } }
        }
        if (arrEnd < 0) { log('No se cerró el array dataLayer'); break; }

        log('dataLayer = [...] encontrado, tamaño:', arrEnd - arrStart);
        try {
          var dl = JSON.parse(src.slice(arrStart, arrEnd + 1));
          log('dataLayer parseado, eventos:', dl.length);
          if (Array.isArray(dl)) {
            for (var k = 0; k < dl.length; k++) {
              var ev = dl[k];
              if (ev && ev.ecommerce && Array.isArray(ev.ecommerce.items) && ev.ecommerce.items.length > 0) {
                log('Items encontrados en evento "' + ev.event + '":', ev.ecommerce.items.length);
                found = found.concat(ev.ecommerce.items);
              }
            }
          }
        } catch (e) { log('JSON.parse error en dataLayer =:', e.message); }

        searchFrom = dlPos + 1;
      }

      // Pattern 2: dataLayer.push({ecommerce:{items:[...]}})
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
            log('Items encontrados en dataLayer.push:', pushed.ecommerce.items.length);
            found = found.concat(pushed.ecommerce.items);
          }
        } catch (e) { log('JSON.parse error en dataLayer.push:', e.message); }

        searchFrom = pushPos + 1;
      }

      if (found.length > 0) {
        log('Total items extraídos de este script:', found.length);
        return found;
      }
    }

    log('Scripts inline totales:', scriptCount, '| con ecommerce:', ecommerceScripts, '| items encontrados:', found.length);
    return found;
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

  function sendBatch(wines, page) {
    if (!wines.length) { log('Página ' + page + ': sin vinos nuevos para enviar'); return Promise.resolve(); }
    log('Enviando ' + wines.length + ' vinos de página ' + page, wines.map(function(w){return w.name;}));
    return fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: TOKEN, wines: wines }),
    })
      .then(function (r) { return r.json().then(function (d) { return { status: r.status, ok: r.ok, d: d }; }); })
      .then(function (res) {
        log('Respuesta API página ' + page + ' (HTTP ' + res.status + '):', res.d);
        if (res.ok) {
          totalImported += res.d.imported || 0;
          totalSkipped += res.d.skipped || 0;
        } else {
          throw new Error('API error ' + res.status + ': ' + JSON.stringify(res.d));
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
        log('Página ' + page + ': items extraídos:', items.length);
        if (items.length === 0) {
          if (emptyStreak >= 1) { log('Dos páginas vacías seguidas — fin'); return; }
          return fetchNext(page + 1, emptyStreak + 1);
        }
        var wines = [];
        items.forEach(function (it) { var w = mapItem(it); if (w) wines.push(w); });
        return sendBatch(wines, page).then(function () {
          show('Página ' + page + ' — ' + totalImported + ' guardados…');
          return fetchNext(page + 1, 0);
        });
      })
      .catch(function (err) {
        log('Error en página ' + page + ':', err.message);
        show('⚠️ Pág ' + page + ': ' + (err.message || 'error') + ' — continuando…');
        if (emptyStreak >= 1) return;
        return delay(600).then(function () { return fetchNext(page + 1, emptyStreak + 1); });
      });
  }

  log('Iniciando importación. TOKEN:', TOKEN ? TOKEN.slice(0, 8) + '…' : 'VACÍO');
  show('Cargando página 1…');

  fetchPage(1)
    .then(function (h1) {
      log('Página 1 recibida, tamaño HTML:', h1.length);
      var items = getItems(h1);
      log('Página 1: items encontrados:', items.length);
      if (items.length > 0) log('Primer item:', items[0]);

      if (items.length === 0) {
        show('⚠️ No se detectaron vinos en la página 1.<br>'
          + '<small>Abre F12 → Consola para ver detalles.</small>', true);
        return;
      }
      var batch = [];
      items.forEach(function (it) { var w = mapItem(it); if (w) batch.push(w); });
      return sendBatch(batch, 1).then(function () {
        show('Página 1 — ' + totalImported + ' guardados…');
        return fetchNext(2, 0).then(function () {
          if (totalImported === 0 && totalSkipped === 0) {
            show('⚠️ Importación completada pero sin vinos nuevos.<br>'
              + '<small>Abre F12 → Consola para ver detalles.</small>', true);
          } else {
            show('✅ ' + totalImported + ' vinos importados'
              + (totalSkipped > 0 ? ', ' + totalSkipped + ' ya existían' : '')
              + '.<br><a href="https://josewines.netlify.app/pendientes" style="color:#f4a8a8">Ir a Pendientes →</a>', true);
          }
        });
      });
    })
    .catch(function (e) {
      log('Error fatal:', e.message);
      show('❌ ' + (e.message || 'Error desconocido'), true);
    });
})();
