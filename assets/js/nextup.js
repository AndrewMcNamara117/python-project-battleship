/* ============================================================
   NEXT SESSION CLOCK — the Forge Five

   Counts down to Saturday 10:00, Europe/Dublin.

   The timezone is not optional. Computing this in the viewer's own zone would
   tell a member in Limerick the truth and a member abroad a lie, and the club
   has both. Irish wall-clock time is resolved through Intl, so the clock stays
   right across the March and October changes without anybody editing a file.

   Its own file rather than a block inside im-motion.js, because index.html is
   deliberately self-contained and does not load the motion engine — this is
   information, not decoration, and it has to run on the page that carries it.
   One copy of the logic, loaded by whichever pages show the band.

   No dependencies. Degrades to the server-rendered sentence already in the
   markup if anything here fails.
   ============================================================ */
(function () {
  var out = document.querySelector('[data-nextup]');
  if (!out || !window.Intl || !Intl.DateTimeFormat) return;

  var note = document.querySelector('[data-nextup-note]');
  var band = out.closest ? out.closest('.nextup') : null;

  var SESSION_DAY = 6;   // Saturday, in JS day numbering
  var SESSION_HOUR = 10;
  var RUNS_FOR_MIN = 90; // treated as "on now" for this long after the off

  var calm = window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var ZONE = 'Europe/Dublin';

  /** How far Irish local time sits from UTC at a given instant. */
  function offset(ts) {
    var f = new Intl.DateTimeFormat('en-GB', {
      timeZone: ZONE, hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    var p = {};
    f.formatToParts(new Date(ts)).forEach(function (x) { p[x.type] = x.value; });
    return Date.UTC(+p.year, +p.month - 1, +p.day, (+p.hour) % 24, +p.minute, +p.second) - ts;
  }

  /** Irish calendar fields for an instant. */
  function fields(ts) {
    var f = new Intl.DateTimeFormat('en-GB', {
      timeZone: ZONE, hour12: false, weekday: 'short',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit'
    });
    var p = {};
    f.formatToParts(new Date(ts)).forEach(function (x) { p[x.type] = x.value; });
    var days = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return { y: +p.year, m: +p.month, d: +p.day, dow: days[p.weekday] };
  }

  /** The UTC instant of a given Irish wall-clock time. Resolved twice so a
      target landing on a clock change settles on the right side of it. */
  function instant(y, m, d, hh) {
    var naive = Date.UTC(y, m - 1, d, hh, 0, 0);
    var ts = naive - offset(naive);
    return naive - offset(ts);
  }

  function nextSession(now) {
    var f = fields(now);
    var ahead = (SESSION_DAY - f.dow + 7) % 7;
    var target = instant(f.y, f.m, f.d + ahead, SESSION_HOUR);
    // It is Saturday, but the session has been and gone: aim at next week.
    if (now >= target + RUNS_FOR_MIN * 60000) {
      target = instant(f.y, f.m, f.d + ahead + 7, SESSION_HOUR);
    }
    return target;
  }

  function two(n) { return n < 10 ? '0' + n : '' + n; }

  function tick() {
    var now = Date.now();
    var target = nextSession(now);

    if (now >= target) {
      if (band) band.classList.add('is-live');
      out.textContent = 'Happening now';
      if (note) note.textContent = 'Maguire’s Pitches · come down';
      return;
    }
    if (band) band.classList.remove('is-live');

    var left = target - now;
    var days = Math.floor(left / 86400000);
    var hrs = Math.floor(left / 3600000) % 24;
    var mins = Math.floor(left / 60000) % 60;
    var secs = Math.floor(left / 1000) % 60;

    var text;
    if (days > 0) text = days + 'd ' + two(hrs) + 'h ' + two(mins) + 'm';
    else if (calm) text = two(hrs) + 'h ' + two(mins) + 'm';
    else text = two(hrs) + ':' + two(mins) + ':' + two(secs);

    out.innerHTML = text + '<small>TO THE OFF</small>';
    if (note) note.textContent = 'Everyone welcome. All paces.';
  }

  tick();
  setInterval(tick, calm ? 30000 : 1000);
})();
