/* Runs in <head>, before the page is painted: applies the theme the visitor chose, marks the page as scripted, and
   sends visitors whose browser prefers Spanish to the Spanish home page (once; their own choice wins afterwards). */
(function () {
  var root = document.documentElement;
  root.classList.add('js');
  try {
    var theme = localStorage.getItem('pawlish-theme');
    if (theme === 'dark' || theme === 'light') root.setAttribute('data-theme', theme);
  } catch (e) { /* storage blocked: the system setting applies */ }

  var spanishHome = root.getAttribute('data-redirect-es');
  if (!spanishHome) return;
  var chosen = null;
  try { chosen = localStorage.getItem('pawlish-lang'); } catch (e) { /* ignore */ }
  if (/[?&]lang=en\b/.test(location.search)) {
    // The visitor picked English on the Spanish page: remember it and tidy the address.
    try { localStorage.setItem('pawlish-lang', 'en'); } catch (e) { /* ignore */ }
    if (history.replaceState) history.replaceState(null, '', location.pathname + location.hash);
    return;
  }
  var first = (navigator.languages && navigator.languages[0]) || navigator.language || '';
  var cameFromHere = false;
  try { cameFromHere = !!document.referrer && new URL(document.referrer).origin === location.origin; } catch (e) { /* ignore */ }
  if (chosen === 'es' || (!chosen && !cameFromHere && /^es(-|$)/i.test(first))) {
    location.replace(new URL(spanishHome, location.href).href + location.hash);
  }
})();
