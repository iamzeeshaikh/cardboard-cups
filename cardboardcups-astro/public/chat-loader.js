/* ZeeOps live chat loader.
 *
 * The widget itself is ~23KB plus a site-config fetch. Loading it on every page
 * view put both on the critical path for no benefit, so it is held back until
 * the visitor's first interaction, or 6s after load for visitors who never
 * interact. Kept as a static file rather than an Astro <script> because Astro
 * inlines chunks this small, and an inline script is blocked by the strict
 * script-src policy these sites ship.
 */
(function () {
  var events = ['pointerdown', 'keydown', 'touchstart', 'scroll'];
  var loaded = false;
  function load() {
    if (loaded) return;
    loaded = true;
    for (var i = 0; i < events.length; i++) window.removeEventListener(events[i], load);
    var s = document.createElement('script');
    s.src = 'https://chat.zeeops.dev/widget.js?siteId=cardboardcups';
    s.async = true;
    document.body.appendChild(s);
  }
  for (var i = 0; i < events.length; i++) {
    window.addEventListener(events[i], load, { passive: true, once: true });
  }
  addEventListener('load', function () {
    setTimeout(load, 6000);
  });
})();
