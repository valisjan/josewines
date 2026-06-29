// JoseWines Bodeboca importer
(function () {
  var TOKEN = window.__JW_TOKEN;
  var API = 'https://josewines.pages.dev/api/import-bodeboca';
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

  // Replace <script>...</script> content with spaces (preserving positions)
  // so wine names found later are in visible HTML, not JSON strings.
  function stripScripts(html) {
    var out = '';
    var pos = 0;
    while (pos < html.length) {
      var s = html.indexOf('<script', pos);
      if (s < 0) { out += html.slice(pos); break; }
      out += html.slice(pos, s);
      var e = html.indexOf('</script>', s);
      if (e < 0) { out += html.slice(s); break; }
      e += 9;
      out += ' '.repeat(e - s); // same length → positions stay valid
      pos = e;
    }
    return out;
  }

  // Extract an attribute value from an <img> tag string
  function extractAttr(tag, attrName) {
    var pats = [' ' + attrName + '="', ' ' + attrName + "='"];
    for (var i = 0; i < pats.length; i++) {
      var p = tag.indexOf(pats[i]);
      if (p < 0) continue;
      var v = p + pats[i].length;
      var quote = pats[i][pats[i].length - 1];
      var e = tag.indexOf(quote, v);
      if (e < 0) continue;
      return tag.slice(v, e);
    }
    return null;
  }

  // Extract src from an <img> tag; handles double and single quotes, lazy-load attrs
  function imgSrc(tag) {
    var attrs = ['data-lazy-src', 'data-src', 'data-original', 'src'];
    for (var a = 0; a < attrs.length; a++) {
      for (var q = 0; q < 2; q++) {
        var quote = q === 0 ? '"' : "'";
        var pat = attrs[a] + '=' + quote;
        var p = tag.indexOf(pat);
        if (p < 0) continue;
        var v = p + pat.length;
        var e = tag.indexOf(quote, v);
        if (e < 0) continue;
        var s = tag.slice(v, e);
        if (s && !s.startsWith('data:') && s.length > 8) {
          return s.startsWith('http') ? s : 'https://www.bodeboca.com' + s;
        }
      }
    }
    return null;
  }

  // True if the src looks like a product photo (not a logo/icon/sprite)
  function isProductImg(src) {
    if (!src) return false;
    var lo = src.toLowerCase();
    var bad = ['logo', 'icon', 'sprite', 'banner', 'payment', 'avatar', 'flag'];
    for (var i = 0; i < bad.length; i++) if (lo.indexOf(bad[i]) >= 0) return false;
    return lo.indexOf('.svg') < 0 && lo.indexOf('.gif') < 0;
  }

  function normalizeAlt(s) {
    s = s.toLowerCase().trim();
    if (s.startsWith('producto: ')) s = s.slice(10);
    return s;
  }

  // Build alt→src map from <img> tags in a raw HTML string
  function buildAltMapFromHTML(html) {
    var stripped = stripScripts(html);
    var map = {};
    var pos = 0;
    while (pos < stripped.length) {
      var ip = stripped.indexOf('<img', pos);
      if (ip < 0) break;
      // Find end of this tag — handle self-closing and multi-line
      var ie = ip + 4;
      var inStr = false, strChar = '';
      while (ie < stripped.length) {
        var c = stripped[ie];
        if (inStr) { if (c === strChar) inStr = false; }
        else if (c === '"' || c === "'") { inStr = true; strChar = c; }
        else if (c === '>') break;
        ie++;
      }
      var tag = stripped.slice(ip, ie + 1);
      pos = ie + 1;

      var alt = extractAttr(tag, 'alt');
      if (!alt) continue;
      var key = normalizeAlt(alt);
      if (key.length < 4) continue;

      var src = imgSrc(tag);
      if (src && isProductImg(src) && !map[key]) map[key] = src;
    }
    log('HTML img map size:', Object.keys(map).length);
    return map;
  }

  // Build alt→src map from JSON-LD Product schemas in the HTML
  function buildAltMapFromJsonLd(html) {
    var map = {};
    var pos = 0;
    while (pos < html.length) {
      var s = html.indexOf('<script', pos);
      if (s < 0) break;
      var gt = html.indexOf('>', s);
      if (gt < 0) break;
      var tag = html.slice(s, gt + 1).toLowerCase();
      if (tag.indexOf('ld+json') < 0) { pos = gt + 1; continue; }
      var end = html.indexOf('</script>', gt + 1);
      if (end < 0) break;
      var content = html.slice(gt + 1, end).trim();
      pos = end + 9;
      try {
        var data = JSON.parse(content);
        var nodes = [];
        if (Array.isArray(data)) nodes = data;
        else if (data['@graph']) nodes = data['@graph'];
        else nodes = [data];
        nodes.forEach(function (node) {
          if (!node || node['@type'] !== 'Product' || !node.name) return;
          var img = node.image;
          if (Array.isArray(img)) img = img[0];
          if (img && typeof img === 'object') img = img.url || img.contentUrl || '';
          if (typeof img !== 'string' || !img || !isProductImg(img)) return;
          var key = normalizeAlt(node.name);
          if (key.length >= 4 && !map[key]) map[key] = img;
        });
      } catch (e) {}
    }
    log('JSON-LD img map size:', Object.keys(map).length);
    return map;
  }

  // Build alt→src map from the live DOM (only valid on the current Bodeboca page)
  function buildAltMapFromDOM() {
    var map = {};
    var imgs = document.querySelectorAll('img');
    for (var i = 0; i < imgs.length; i++) {
      var img = imgs[i];
      var alt = img.getAttribute('alt') || '';
      var key = normalizeAlt(alt);
      if (key.length < 4) continue;
      var src = img.currentSrc
        || img.getAttribute('data-lazy-src')
        || img.getAttribute('data-src')
        || img.getAttribute('data-original')
        || img.src || '';
      if (!src || src.startsWith('data:') || src.length <= 8) continue;
      if (!src.startsWith('http')) src = 'https://www.bodeboca.com' + src;
      if (isProductImg(src) && !map[key]) map[key] = src;
    }
    log('DOM img map size:', Object.keys(map).length);
    return map;
  }

  function matchFromAltMap(altToSrc, items) {
    var found = 0;
    var result = items.map(function (it) {
      var name = (it.item_name || '').toLowerCase().trim();
      if (!name) return null;

      // 1. Exact match
      if (altToSrc[name]) { found++; return altToSrc[name]; }

      // 2. Strip trailing vintage year from both sides
      var nameNoYear = name.replace(/\s+\d{4}$/, '').trim();
      for (var k in altToSrc) {
        if (k.replace(/\s+\d{4}$/, '').trim() === nameNoYear) { found++; return altToSrc[k]; }
      }

      // 3. Prefix match on first 25 chars
      var pre = name.slice(0, 25);
      for (var k2 in altToSrc) {
        if (k2.slice(0, 25) === pre) { found++; return altToSrc[k2]; }
      }

      // 4. Substring: name contains key or key contains name (min 10 chars)
      if (name.length >= 10) {
        for (var k3 in altToSrc) {
          if (k3.length >= 10 && (name.indexOf(k3) >= 0 || k3.indexOf(name) >= 0)) {
            found++; return altToSrc[k3];
          }
        }
      }

      return null;
    });

    log('Imágenes encontradas: ' + found + '/' + items.length);
    if (found === 0 && items.length > 0) {
      // Log first few keys to help diagnose mismatches
      var keys = Object.keys(altToSrc).slice(0, 5);
      log('Alt map sample:', keys.join(' | '));
      log('First item_name:', (items[0].item_name || '(none)'));
    }
    return result;
  }

  // Find each wine's label image. useDOM=true on the first page (live DOM available).
  function findImages(html, items, useDOM) {
    var altToSrc = {};
    // Merge all sources (later sources don't overwrite existing entries)
    function merge(src) {
      for (var k in src) if (!altToSrc[k]) altToSrc[k] = src[k];
    }
    if (useDOM) merge(buildAltMapFromDOM());
    merge(buildAltMapFromJsonLd(html));
    merge(buildAltMapFromHTML(html));
    log('Combined img map size:', Object.keys(altToSrc).length);
    return matchFromAltMap(altToSrc, items);
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

  function mapItems(html, rawItems, useDOM) {
    var images = findImages(html, rawItems, useDOM);
    var withImages = rawItems.filter(Boolean).map(function (it, idx) {
      return { item: it, img: images[idx] || null };
    });

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
      var wines = mapItems(h1, raw, true /* useDOM */);

      return sendBatch(wines, 1).then(function () {
        show('Página 1 — ' + totalImported + ' guardados…');
        return fetchNext(2, 0).then(function () {
          show('✅ ' + totalImported + ' vinos importados'
            + (totalSkipped > 0 ? ', ' + totalSkipped + ' ya existían' : '')
            + '.<br><a href="https://josewines.pages.dev/pendientes" style="color:#f4a8a8">Ir a Pendientes →</a>', true);
        });
      });
    })
    .catch(function (e) { show('❌ ' + (e.message || 'Error'), true); });
})();
