/* Behavior of pawlish.app: theme toggle, action tabs, download link, copy buttons, the hero animation and click
   tracking hooks. Everything degrades to the plain page when this file doesn't run. */
(function () {
  'use strict';
  var root = document.documentElement;
  var text = {};
  try { text = JSON.parse(document.getElementById('site-data').textContent); } catch (e) { /* ignore */ }

  function track(name, props) {
    if (window.pawlishTrack) window.pawlishTrack(name, props || {});
  }
  function each(list, fn) { Array.prototype.forEach.call(list, fn); }

  /* ---- theme ---- */
  var toggle = document.getElementById('theme-toggle');
  function isDark() {
    var chosen = root.getAttribute('data-theme');
    return chosen ? chosen === 'dark' : !!(window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
  }
  function syncToggle() { if (toggle) toggle.setAttribute('aria-pressed', String(isDark())); }
  if (toggle) {
    toggle.addEventListener('click', function () {
      var next = isDark() ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('pawlish-theme', next); } catch (e) { /* ignore */ }
      syncToggle();
    });
    syncToggle();
  }

  /* ---- action tabs ---- */
  each(document.querySelectorAll('[data-tabs]'), function (box) {
    var tabs = Array.prototype.slice.call(box.querySelectorAll('[role="tab"]'));
    var panels = tabs.map(function (tab) { return document.getElementById(tab.getAttribute('aria-controls')); });
    function select(index, focus) {
      tabs.forEach(function (tab, i) {
        var on = i === index;
        tab.setAttribute('aria-selected', String(on));
        tab.tabIndex = on ? 0 : -1;
        panels[i].hidden = !on;
      });
      if (focus) tabs[index].focus();
    }
    tabs.forEach(function (tab, i) {
      tab.addEventListener('click', function () {
        select(i);
        track('action_tab', { action: tab.id.replace('tab-', '') });
      });
      tab.addEventListener('keydown', function (event) {
        var n = tabs.length;
        var next = { ArrowRight: (i + 1) % n, ArrowDown: (i + 1) % n, ArrowLeft: (i + n - 1) % n, ArrowUp: (i + n - 1) % n, Home: 0, End: n - 1 }[event.key];
        if (next === undefined) return;
        event.preventDefault();
        select(next, true);
      });
    });
    select(0);
  });

  /* ---- download link: the latest release's DMG, or "coming soon" before there is one ---- */
  var downloads = document.querySelectorAll('[data-download]');
  var note = document.querySelector('[data-download-note]');
  function comingSoon() {
    each(downloads, function (link) {
      var label = link.querySelector('[data-label]');
      if (label) label.textContent = text.label_soon;
      link.setAttribute('aria-disabled', 'true');
      link.href = 'https://github.com/claudiouvm/Pawlish';
    });
    if (note) note.textContent = text.soon;
  }
  if (downloads.length && window.fetch) {
    fetch('https://api.github.com/repos/claudiouvm/Pawlish/releases/latest', { headers: { Accept: 'application/vnd.github+json' } })
      .then(function (response) {
        if (response.status === 404) return null; // no release yet
        if (!response.ok) throw new Error('GitHub answered ' + response.status);
        return response.json();
      })
      .then(function (release) {
        var asset = release && (release.assets || []).filter(function (a) { return /\.dmg$/i.test(a.name); })[0];
        if (!asset) return comingSoon();
        each(downloads, function (link) { link.href = asset.browser_download_url; });
        if (note && text.ready) {
          note.textContent = text.ready
            .replace('{version}', String(release.tag_name || '').replace(/^v/, ''))
            .replace('{size}', (asset.size / 1048576).toFixed(1) + ' ' + text.size_unit);
        }
      })
      .catch(function () { /* offline or rate limited: the link to the releases page still works */ });
  }

  /* ---- copy buttons ---- */
  each(document.querySelectorAll('[data-copy]'), function (button) {
    var status = document.createElement('span');
    status.className = 'sr-only';
    status.setAttribute('role', 'status');
    button.parentNode.appendChild(status);
    var icon = button.querySelector('use');
    button.addEventListener('click', function () {
      function done(ok) {
        status.textContent = ok ? text.copied : text.copy_failed;
        if (ok && icon) {
          icon.setAttribute('href', '#i-check');
          setTimeout(function () { icon.setAttribute('href', '#i-copy'); status.textContent = ''; }, 1800);
        }
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(button.getAttribute('data-copy')).then(function () { done(true); }, function () { done(false); });
      } else {
        done(false);
      }
    });
  });

  /* ---- click tracking (analytics.js turns these into events) and the remembered language ---- */
  document.addEventListener('click', function (event) {
    var el = event.target.closest && event.target.closest('[data-track]');
    if (!el) return;
    var props = {};
    if (el.getAttribute('data-where')) props.where = el.getAttribute('data-where');
    if (el.getAttribute('data-to')) props.to = el.getAttribute('data-to');
    track(el.getAttribute('data-track'), props);
    if (el.getAttribute('data-track') === 'language_switch') {
      try { localStorage.setItem('pawlish-lang', el.getAttribute('data-to')); } catch (e) { /* ignore */ }
    }
  });

  /* ---- the hero animation ---- */
  var stage = document.getElementById('demo');
  var dataNode = document.getElementById('demo-data');
  var calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (stage && dataNode && !calm && window.IntersectionObserver) {
    try { playDemo(stage, JSON.parse(dataNode.textContent)); } catch (e) { stage.classList.remove('playing'); }
  }

  function playDemo(stage, config) {
    var q = function (id) { return stage.querySelector('#' + id); };
    var textEl = q('demo-text'), bar = q('demo-bar'), paw = q('demo-paw'), result = q('demo-result');
    var resultTitle = q('demo-result-title'), resultText = q('demo-result-text'), copyBtn = q('demo-copy');
    var replaceBtn = q('demo-replace'), cursor = q('demo-cursor');
    var segments = Array.prototype.slice.call(bar.querySelectorAll('.act'));
    var words = [];
    var visible = false, tabShown = !document.hidden, wake = null, stopped = false;

    function sleep(ms) {
      return new Promise(function (resolve) { setTimeout(resolve, ms); }).then(function () {
        if (visible && tabShown) return null;
        return new Promise(function (resolve) { wake = resolve; });
      });
    }
    function update() {
      if (visible && tabShown && wake) { var w = wake; wake = null; w(); }
    }
    new IntersectionObserver(function (entries) { visible = entries[0].isIntersecting; update(); }, { threshold: 0.25 }).observe(stage);
    document.addEventListener('visibilitychange', function () { tabShown = !document.hidden; update(); });

    function moveTo(el, fx, fy) {
      var s = stage.getBoundingClientRect(), r = el.getBoundingClientRect();
      cursor.style.left = ((r.left - s.left + r.width * fx) / s.width * 100) + '%';
      cursor.style.top = ((r.top - s.top + r.height * fy) / s.height * 100) + '%';
    }
    function setWords(value) {
      textEl.textContent = '';
      words = value.split(' ').map(function (word, i, all) {
        var span = document.createElement('span');
        span.className = 'w';
        span.textContent = word + (i < all.length - 1 ? ' ' : '');
        textEl.appendChild(span);
        return span;
      });
    }
    /* The paw sits in the middle of where the bar will be, and the bar grows out of it: the clip starts as the paw's
       circle and opens to the whole capsule, as in the app. */
    function placePaw() {
      var bw = bar.offsetWidth, bh = bar.offsetHeight, pw = paw.offsetWidth, ph = paw.offsetHeight;
      paw.style.left = (bar.offsetLeft + (bw - pw) / 2) + 'px';
      paw.style.top = (bar.offsetTop + (bh - ph) / 2) + 'px';
      bar.style.setProperty('--ix', Math.max(0, (1 - pw / bw) / 2 * 100) + '%');
      bar.style.setProperty('--iy', Math.max(0, (1 - ph / bh) / 2 * 100) + '%');
    }
    function reset(scene) {
      result.classList.remove('show', 'loading');
      bar.classList.remove('show');
      paw.classList.remove('show');
      segments.forEach(function (s, i) {
        s.classList.remove('press');
        s.classList.toggle('lit', !!scene.lit && i === scene.action);
      });
      replaceBtn.classList.remove('press');
      cursor.classList.remove('show');
      cursor.style.left = '86%'; cursor.style.top = '82%';
      setWords(scene.text);
      resultTitle.textContent = scene.title;
      resultText.textContent = scene.result;
      copyBtn.textContent = config.labels.copy;
      placePaw();
    }

    async function run(scene) {
      reset(scene);
      await sleep(700);
      cursor.classList.add('show');
      moveTo(words[0], 0, 0.6);
      await sleep(900);
      var step = Math.max(40, Math.min(110, 1100 / words.length));
      for (var i = 0; i < words.length; i++) {
        words[i].classList.add('on');
        if (i % 3 === 0) moveTo(words[i], 1, 0.6);
        await sleep(step);
      }
      moveTo(words[words.length - 1], 1, 0.6);
      await sleep(400);
      paw.classList.add('show');          // the selection brings up only the paw
      await sleep(900);
      moveTo(paw, 0.5, 0.55);
      await sleep(900);
      bar.classList.add('show');          // pointing at it grows it into the bar
      paw.classList.remove('show');
      await sleep(1100);
      var target = segments[scene.action];
      moveTo(target, 0.5, 0.6);
      await sleep(1000);
      target.classList.add('press');
      await sleep(260);
      bar.classList.remove('show');
      result.classList.add('loading', 'show');
      moveTo(result, 0.7, 0.9);
      await sleep(1300);
      result.classList.remove('loading');
      await sleep(1500);
      moveTo(replaceBtn, 0.5, 0.6);
      await sleep(1000);
      replaceBtn.classList.add('press');  // Replace puts the result back where the text was selected
      await sleep(260);
      result.classList.remove('show');
      setWords(scene.result);
      words.forEach(function (w) { w.classList.add('on'); });
      moveTo(textEl, 1, 1.4);
      await sleep(1200);
      words.forEach(function (w) { w.classList.remove('on'); });
      await sleep(1800);
      cursor.classList.remove('show');
      await sleep(900);
    }

    stage.classList.add('playing');
    (async function loop() {
      while (!stopped) {
        for (var i = 0; i < config.scenes.length; i++) await run(config.scenes[i]);
      }
    })().catch(function () { stopped = true; stage.classList.remove('playing'); });
  }

  /* ---- motion: sections ease in once, and the highlight scenes loop only while they are on screen ---- */
  (function () {
    if (!('IntersectionObserver' in window)) return;
    var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var reveal = document.querySelectorAll('.rv, .sec-head, .step, .panels, .ai-copy, .mock-wrap, .priv-copy, .flow, .price, .faq-wrap .faq, .req');
    each(reveal, function (el, i) {
      el.classList.add('rv');
      el.style.setProperty('--rv-delay', ((i % 3) * 0.08).toFixed(2) + 's');
    });
    var seen = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('in');
        seen.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    each(document.querySelectorAll('.rv'), function (el) { if (still) el.classList.add('in'); else seen.observe(el); });
    if (still) return;
    var live = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) { entry.target.classList.toggle('live', entry.isIntersecting); });
    }, { threshold: 0.3 });
    each(document.querySelectorAll('[data-live]'), function (el) { live.observe(el); });
  })();
})();
