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

  // Extract the src URL from an <img> tag, trying lazy-load attributes first
  function imgSrc(tag) {
    var attrs = ['data-lazy-src', 'data-src', 'data-original', 'src'];
    for (var a = 0; a < attrs.length; a++) {
      var pat = attrs[a] + '="';
      var p = tag.indexOf(pat);
      if (p < 0) continue;
      var v = p + pat.length;
      var e = tag.indexOf('"', v);
      if (e < 0) continue;
      var s = tag.slice(v, e);
      if (s && !s.startsWith('data:') && s.length > 8) {
        return s.startsWith('http') ? s : 'https://www.bodeboca.com' + s;
      }
    }
    return null;
  }

  // True if the src looks like a product photo (not a logo/icon/sprite/flag)
  function isProductImg(src) {
    if (!src) return false;
    var lo = src.toLowerCase();
    var bad = ['logo', 'icon', 'sprite', 'banner', 'payment', 'avatar', 'flag', 'star', 'rating', 'check', 'arrow', 'close', 'search'];
    for (var i = 0; i < bad.length; i++) if (lo.indexOf(bad[i]) >= 0) return false;
    return lo.indexOf('.svg') < 0 && lo.indexOf('.gif') < 0;
  }

  // For each item, find its wine-label image by locating the item name in the HTML
  // and returning the nearest <img> before (or just after) that position.
  function findImages(html, items) {
    var htmlLower = html.toLowerCase();
    return items.map(function (it) {
      var name = (it.item_name || '').toLowerCase().trim();
      if (!name) return null;

      // Try progressively shorter prefixes in case name is truncated in HTML
      var prefixes = [name.slice(0, 30), name.slice(0, 20), name.slice(0, 12)];
      for (var pi = 0; pi < prefixes.length; pi++) {
        var prefix = prefixes[pi].trim();
        if (!prefix || prefix.length < 6) continue;
        var namePos = htmlLower.indexOf(prefix);
        if (namePos < 0) continue;

        // Search for the nearest <img> BEFORE the name (within 3000 chars)
        var windowStart = Math.max(0, namePos - 3000);
        var chunk = html.slice(windowStart, namePos);
        var best = null;
        var pos = 0;
        while (pos < chunk.length) {
          var ip = chunk.indexOf('<img', pos);
          if (ip < 0) break;
          var ie = chunk.indexOf('>', ip);
          if (ie < 0) break;
          var src = imgSrc(chunk.slice(ip, ie + 1));
          if (src && isProductImg(src)) best = src;
          pos = ip + 1;
        }
        if (best) return best;

        // If not found before, try AFTER the name (within 800 chars)
        var afterChunk = html.slice(namePos, Math.min(html.length, namePos + 800));
        var ip2 = afterChunk.indexOf('<img');
        if (ip2 >= 0) {
          var ie2 = afterChunk.indexOf('>', ip2);
          if (ie2 >= 0) {
            var src2 = imgSrc(afterChunk.slice(ip2, ie2 + 1));
            if (src2 && isProductImg(src2)) return src2;
          }
        }
      }
      return null;
    });
  }

  function getItems(html) {
    var found = [];
    var pos = 0;

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

      if (src.indexOf('ecommerce') < 0) continue;

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
        if (src[i] !== '[') { searchFrom = dlPos + 1; continue; }

        var arrStart = i, depth = 0, arrEnd = -1;
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
                found = found.concat(ev.ecommerce.items);
              }
            }
          }
        } catch (e) {}
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
            found = found.concat(pushed.ecommerce.items);
          }
        } catch (e) {}
        searchFrom = pushPos + 1;
      }

      if (found.length > 0) return found;
    }
    return found;
  }

  function mapItems(html, rawItems) {
    var images = findImages(html, rawItems);
    var withImages = rawItems.filter(Boolean).map(function (it, idx) {
      return { item: it, img: images[idx] || null };
    });
    log('Imágenes encontradas: ' + withImages.filter(function(x){return x.img;}).length + '/' + withImages.length);

    var result = [];
    withImages.forEach(function (x) {
      var it = x.item;
      var id = String(it.item_id || it.id || '');
      if (!id) id = (it.item_name || '') + '|' + (it.price || '');
      if (seenIds[id]) return;
      seenIds[id] = true;
      var vintage = null;
      if (it.item_category5) { var v = parseInt(it.item_category5); if (v > 1900 && v < 2100) vintage = v; }
      result.push({
        name: (it.item_name || '').slice(0, 200),
        winery: (it.item_category || it.item_brand || '').slice(0, 100),
        vintage_year: vintage,
        purchase_date: new Date().toISOString().slice(0, 10),
        price_per_bottle: parseFloat(it.price) || 0,
        units_purchased: parseInt(it.quantity) || 1,
        region: it.item_category4 || null,
        source_order_id: id,
        label_image_url: x.img,
      });
    });
    return result;
  }

  function fetchPage(page) {
    return fetch(BASE + page, { credentials: 'include' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status + ' en página ' + page);
        return r.text();
      });
  }

  function sendBatch(wines, page) {
    if (!wines.length) return Promise.resolve();
    return fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: TOKEN, wines: wines }),
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, status: r.status, d: d }; }); })
      .then(function (res) {
        log('API página ' + page + ' (HTTP ' + res.status + '):', res.d);
        if (res.ok) {
          totalImported += res.d.imported || 0;
          totalSkipped += res.d.skipped || 0;
        } else {
          throw new Error('API error ' + res.status + ': ' + (res.d.error || ''));
        }
      });
  }

  function fetchNext(page, emptyStreak) {
    if (page > MAX_PAGES) return Promise.resolve();
    show('Cargando página ' + page + '… (' + totalImported + ' guardados)');
    return delay(400)
      .then(function () { return fetchPage(page); })
      .then(function (h) {
        var raw = getItems(h);
        if (raw.length === 0) {
          if (emptyStreak >= 1) return;
          return fetchNext(page + 1, emptyStreak + 1);
        }
        var wines = mapItems(h, raw);
        return sendBatch(wines, page).then(function () {
          show('Página ' + page + ' — ' + totalImported + ' guardados…');
          return fetchNext(page + 1, 0);
        });
      })
      .catch(function (err) {
        log('Error en página ' + page + ':', err.message);
        show('⚠️ Pág ' + page + ': ' + (err.message || 'error'));
        if (emptyStreak >= 1) return;
        return delay(600).then(function () { return fetchNext(page + 1, emptyStreak + 1); });
      });
  }

  show('Cargando página 1…');
  fetchPage(1)
    .then(function (h1) {
      var raw = getItems(h1);
      if (raw.length === 0) {
        show('⚠️ No se detectaron vinos en la página 1.<br><small>Asegúrate de tener sesión en Bodeboca.</small>', true);
        return;
      }
      log('Página 1: ' + raw.length + ' items. Primer item:', raw[0]);
      var wines = mapItems(h1, raw);
      return sendBatch(wines, 1).then(function () {
        show('Página 1 — ' + totalImported + ' guardados…');
        return fetchNext(2, 0).then(function () {
          show('✅ ' + totalImported + ' vinos importados'
            + (totalSkipped > 0 ? ', ' + totalSkipped + ' ya existían' : '')
            + '.<br><a href="https://josewines.netlify.app/pendientes" style="color:#f4a8a8">Ir a Pendientes →</a>', true);
        });
      });
    })
    .catch(function (e) { show('❌ ' + (e.message || 'Error'), true); });
})();
