/**
 * Draws math written as $...$ (inline) or $$...$$ (block) in questions, options and explanations,
 * e.g. "$\frac{2}{5} M R^2$" in the admission physics questions, using KaTeX (loaded in index.html).
 * Pages redraw their question lists often, so this watches the page and draws new text a moment later.
 */
(function () {
  const OPTS = {
    delimiters: [{ left: '$$', right: '$$', display: true }, { left: '$', right: '$', display: false }],
    throwOnError: false,
    ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code', 'option', 'input', 'select']
  };
  let timer = null;
  let busy = false;
  function draw() {
    timer = null;
    if (busy || typeof window.renderMathInElement !== 'function') return;
    const root = document.querySelector('main') || document.body;
    if (!root || root.textContent.indexOf('$') === -1) return;
    busy = true;
    try { window.renderMathInElement(root, OPTS); } catch { /* leave the text as it is */ }
    busy = false;
  }
  function soon() { if (!busy && !timer) timer = setTimeout(draw, 120); }
  function start() {
    new MutationObserver(soon).observe(document.body, { childList: true, subtree: true, characterData: true });
    soon();
  }
  // KaTeX scripts are deferred: wait for them
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start);
})();
