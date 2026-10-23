/* Statistics for pawlish.app with PostHog (US cloud): page views, time on page, scroll depth and a click heatmap.

   Privacy by construction. scripts/check-site.py fails if any of these lines go missing:
   - cookieless_mode "always": no cookies and no local or session storage. PostHog tells visitors apart for a single
     day with a hash it computes on its servers.
   - no person profiles, no session recordings, no surveys, product tours, chat or experiments, no web vitals and no
     exception capture, whatever the PostHog project settings say.
   - nothing is sent when the browser sends Do Not Track or Global Privacy Control, when the visitor turned the
     statistics off (privacy page), or when the page is not served from pawlish.app (previews, localhost).

   The PostHog project needs two settings for this to work: Web analytics -> "Cookieless server hash mode" (events
   without it are dropped) and Heatmaps (enabled, with the pages to capture). */
(function () {
  'use strict';

  var KEY = 'phc_tu2jHdJsBoDh5pt4Qj5yw4aejuvHAAMW8C39vQ8xowdT'; // public ingestion key; it can only add events
  var API_HOST = 'https://us.i.posthog.com';
  var SCRIPT = 'https://us-assets.i.posthog.com/static/array.js';
  var OFF_KEY = 'pawlish-analytics';
  var queue = [];

  // Until PostHog is ready (or if it never loads) events wait here; site.js calls this for clicks.
  window.pawlishTrack = function (name, props) { if (queue.length < 50) queue.push([name, props]); };

  var text = {};
  try { text = JSON.parse(document.getElementById('site-data').textContent); } catch (e) { /* ignore */ }

  var turnedOff = false;
  try {
    if (/[?&]analytics=off\b/.test(location.search)) localStorage.setItem(OFF_KEY, 'off');
    if (/[?&]analytics=on\b/.test(location.search)) localStorage.removeItem(OFF_KEY);
    turnedOff = localStorage.getItem(OFF_KEY) === 'off';
  } catch (e) { /* storage blocked: statistics stay on unless the browser says otherwise */ }

  var browserSaysNo = navigator.doNotTrack === '1' || window.doNotTrack === '1' || navigator.msDoNotTrack === '1' ||
    navigator.globalPrivacyControl === true;

  /* ---- the switch on the privacy page ---- */
  var button = document.getElementById('analytics-toggle');
  var state = document.getElementById('analytics-state');
  function showState() {
    var off = turnedOff || browserSaysNo;
    if (button) {
      button.hidden = false;
      button.setAttribute('aria-pressed', String(turnedOff));
      button.disabled = browserSaysNo;
    }
    if (state) state.textContent = off ? text.analytics_off : text.analytics_on;
  }
  if (button) {
    button.addEventListener('click', function () {
      turnedOff = !turnedOff;
      try {
        if (turnedOff) localStorage.setItem(OFF_KEY, 'off'); else localStorage.removeItem(OFF_KEY);
      } catch (e) { /* ignore */ }
      showState();
    });
    showState();
  }

  var onTheSite = /^(www\.)?pawlish\.app$/.test(location.hostname);
  if (!onTheSite || turnedOff || browserSaysNo) return;

  var tag = document.createElement('script');
  tag.async = true;
  tag.crossOrigin = 'anonymous';
  tag.src = SCRIPT;
  tag.onload = function () {
    var posthog = window.posthog;
    if (!posthog || typeof posthog.init !== 'function') return;
    posthog.init(KEY, {
      api_host: API_HOST,
      ui_host: 'https://us.posthog.com',
      cookieless_mode: 'always',
      person_profiles: 'never',
      respect_dnt: true,
      capture_pageview: true,
      capture_pageleave: true,
      capture_heatmaps: true,
      autocapture: { dom_event_allowlist: ['click'], capture_copied_text: false },
      capture_dead_clicks: false,
      capture_exceptions: false,
      capture_performance: false, // no web vitals or network timings
      disable_session_recording: true,
      disable_surveys: true,
      disable_product_tours: true,
      disable_conversations: true,
      disable_web_experiments: true,
      advanced_disable_toolbar_metrics: true,
      loaded: function (ph) {
        ph.register({ site_lang: document.documentElement.lang });
        window.pawlishTrack = function (name, props) { ph.capture(name, props || {}); };
        queue.splice(0).forEach(function (event) { ph.capture(event[0], event[1] || {}); });
      }
    });
  };
  tag.onerror = function () { queue.length = 0; };
  document.head.appendChild(tag);
})();
