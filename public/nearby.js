/*
 * nearby.js — the ONLY JavaScript the browsing surface ships (list pages only).
 *
 * On-device "sort by distance" (§13, user-requested). It is a PROGRESSIVE
 * ENHANCEMENT: the page is fully usable without it (name/zip/recent sort + zip
 * filter are server-rendered, zero-JS). This script only ADDS a "sort by
 * distance" control when it runs AND at least one listing has coordinates — so
 * a no-JS visitor never sees an affordance that can't work.
 *
 * PRIVACY (§6): the visitor's location NEVER leaves the device. We read it via
 * navigator.geolocation, compute distances against the listing coordinates that
 * are already in the page (data-lat / data-lng), and reorder the DOM locally.
 * Nothing is sent to the server or put in a URL. (The page's CSP is
 * default-src 'none' with no connect-src, so this script physically cannot make
 * a network request even if it tried.)
 */
(function () {
  'use strict';

  var list = document.querySelector('ul.listing-list');
  if (!list) return;

  var cards = Array.prototype.slice.call(list.querySelectorAll('li.listing-card'));
  var withCoords = cards.filter(function (c) {
    return c.getAttribute('data-lat') !== null && c.getAttribute('data-lng') !== null;
  });
  // Nothing to sort by distance — leave the page exactly as the server sent it.
  if (withCoords.length === 0) return;

  var originalOrder = cards.slice(); // to restore the server order on reset

  // --- UI: a button + an assertive-but-polite status line (§5) ---------------
  var controls = document.createElement('div');
  controls.className = 'nearby-controls';

  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn nearby-btn';
  btn.textContent = 'Sort by distance (use my location)';

  var reset = document.createElement('button');
  reset.type = 'button';
  reset.className = 'nearby-reset';
  reset.textContent = 'Reset order';
  reset.hidden = true;

  var status = document.createElement('p');
  status.className = 'nearby-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-atomic', 'true');

  controls.appendChild(btn);
  controls.appendChild(reset);
  controls.appendChild(status);
  list.parentNode.insertBefore(controls, list);

  function haversineMiles(lat1, lon1, lat2, lon2) {
    var R = 3958.8; // Earth radius, miles
    var toRad = function (d) { return (d * Math.PI) / 180; };
    var dLat = toRad(lat2 - lat1);
    var dLon = toRad(lon2 - lon1);
    var a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  function clearDistanceNotes() {
    var notes = list.querySelectorAll('.distance-note');
    for (var i = 0; i < notes.length; i++) notes[i].parentNode.removeChild(notes[i]);
  }

  function restore() {
    clearDistanceNotes();
    for (var i = 0; i < originalOrder.length; i++) list.appendChild(originalOrder[i]);
    reset.hidden = true;
    btn.disabled = false;
    status.textContent = 'Order reset. Showing the default order.';
  }

  reset.addEventListener('click', restore);

  btn.addEventListener('click', function () {
    if (!('geolocation' in navigator)) {
      status.textContent = 'Your browser does not support location. The list is unchanged.';
      return;
    }
    btn.disabled = true;
    status.textContent = 'Getting your location…';

    navigator.geolocation.getCurrentPosition(
      function (pos) {
        var lat = pos.coords.latitude;
        var lng = pos.coords.longitude;

        // Score every card: cards with coords by distance, cards without → last.
        var scored = cards.map(function (card) {
          var dl = card.getAttribute('data-lat');
          var dn = card.getAttribute('data-lng');
          var d = dl !== null && dn !== null
            ? haversineMiles(lat, lng, parseFloat(dl), parseFloat(dn))
            : Infinity;
          return { card: card, dist: d };
        });
        scored.sort(function (a, b) { return a.dist - b.dist; });

        clearDistanceNotes();
        scored.forEach(function (s) {
          if (isFinite(s.dist)) {
            var note = document.createElement('p');
            note.className = 'listing-meta distance-note';
            // Approximate (ZIP-centroid) coords are labeled honestly — a leading
            // "~" and an "(approx.)" tag, never a precise-looking figure (§4).
            var approx = s.card.getAttribute('data-coords-approx') === '1';
            note.textContent = approx
              ? '~' + s.dist.toFixed(1) + ' mi away (approx.)'
              : s.dist.toFixed(1) + ' mi away';
            s.card.appendChild(note);
          }
          list.appendChild(s.card); // re-append in sorted order
        });

        var n = scored.filter(function (s) { return isFinite(s.dist); }).length;
        status.textContent =
          'Sorted by distance from your location — nearest first (' + n +
          (n === 1 ? ' listing has' : ' listings have') + ' a known location).';
        reset.hidden = false;
        btn.disabled = false;
      },
      function (err) {
        btn.disabled = false;
        var why = err && err.code === err.PERMISSION_DENIED
          ? 'Location permission was denied.'
          : 'Your location was unavailable.';
        status.textContent = why + ' The list is unchanged — you can still sort by ZIP.';
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  });
})();
