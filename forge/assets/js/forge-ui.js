/* ============================================================
   THE FORGE — shared chrome + motion engine
   Injects the header/nav/footer/toast/progress bar, then runs
   scroll reveals, scroll progress, 3D card tilt, count-ups and
   the hero glow drift. Plain script with zero dependencies so
   the page chrome never depends on the Firebase CDN — load it
   with `defer` BEFORE the page's module script.
   Everything collapses to static, readable content under
   prefers-reduced-motion (see forge.css).
   ============================================================ */
(() => {
  "use strict";

  /* ================= chrome ================= */

  const MARK = `<svg class="mark" viewBox="0 0 780 660" aria-hidden="true"><polygon points="9,17 131,130 131,628 9,628" fill="#eeeeee"/><polygon points="172,162 381,365 729,17 729,628 607,628 607,311 376,541 172,337" fill="#2dff8a"/></svg>`;

  const NAV_LINKS = [
    ["index.html", "Hub"],
    ["join.html", "Join"],
    ["sessions.html", "Sessions"],
    ["check-in.html", "Check-In"],
    ["coaching-apply.html", "Coaching"],
    ["dashboard.html", "Dashboard"],
  ];

  // works with .html paths and Firebase Hosting cleanUrls (/join)
  const seg = location.pathname.replace(/\/+$/, "").split("/").pop() || "index.html";
  const current = seg.endsWith(".html") ? seg : `${seg}.html`;
  const activeAttr = (href) =>
    href === current ? ' class="active" aria-current="page"' : "";

  document.body.insertAdjacentHTML("afterbegin", `
    <a class="skip" href="#main">Skip to content</a>
    <div class="fx-progress" aria-hidden="true"></div>
    <header class="forge-header">
      <div class="bar">
        <a class="brand" href="index.html" aria-label="The Forge — Iron Miles hub home">
          ${MARK}
          <span class="wordmark">Iron <span class="green">Miles</span><small>The Forge</small></span>
        </a>
        <button class="navtoggle" aria-label="Menu" aria-expanded="false">☰</button>
        <nav class="links" aria-label="Main">
          ${NAV_LINKS.map(([href, label]) => `<a href="${href}"${activeAttr(href)}>${label}</a>`).join("")}
          <a href="admin.html" data-admin-link hidden${activeAttr("admin.html")}>Admin</a>
          <a class="ext" href="https://ironmiles.ie" rel="noopener">ironmiles.ie</a>
          <button class="navbtn" data-auth-btn hidden>Log In</button>
        </nav>
      </div>
    </header>`);

  document.body.insertAdjacentHTML("beforeend", `
    <footer class="forge-footer">
      <div class="foot">
        <div class="id">
          ${MARK}
          <span class="wordmark" style="display:block;margin-top:12px">Iron <span class="green">Miles</span></span>
          <p class="mantra">Forge One More</p>
          <p>Limerick, Ireland<br><a href="https://ironmiles.ie" rel="noopener">ironmiles.ie</a></p>
        </div>
        <div class="cols">
          <nav aria-label="Footer — The Forge">
            <a href="index.html">Hub</a>
            <a href="join.html">Join</a>
            <a href="sessions.html">Sessions</a>
            <a href="coaching-apply.html">Coaching</a>
          </nav>
          <nav aria-label="Footer — Iron Miles">
            <a href="https://ironmiles.ie/privacy.html" rel="noopener">Privacy</a>
            <a href="https://ironmiles.ie/waiver.html" rel="noopener">Waiver</a>
            <a href="https://ironmiles.ie" rel="noopener">Back to ironmiles.ie</a>
          </nav>
        </div>
      </div>
    </footer>
    <div class="toast" role="status" aria-live="polite"></div>`);

  const toggle = document.querySelector(".navtoggle");
  const links = document.querySelector("nav.links");
  toggle.addEventListener("click", () => {
    const open = links.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
  });

  /* ================= motion ================= */

  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = matchMedia("(pointer: fine)").matches;

  /* Gate entrance states behind fx-on so content stays fully visible
     if JS fails or motion is reduced. */
  if (!reduced) document.documentElement.classList.add("fx-on");

  let revealIO = null;
  let countIO = null;

  const runCount = (el) => {
    const target = parseInt(el.dataset.count, 10) || 0;
    if (reduced || target === 0) { el.textContent = String(target); return; }
    const dur = 900;
    const t0 = performance.now();
    const step = (t) => {
      const p = Math.min((t - t0) / dur, 1);
      el.textContent = String(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  /** Observe .fx and [data-count] elements inside `root`.
      Pages call window.forgeMotionRefresh(container) after rendering
      dynamic content (session cards, dashboard panels, admin lists). */
  const observe = (root = document) => {
    root.querySelectorAll("[data-stagger]").forEach((group) => {
      [...group.querySelectorAll(":scope > .fx")].forEach((el, i) => {
        el.style.setProperty("--fxd", `${Math.min(i * 0.09, 0.55)}s`);
      });
    });
    if (revealIO) root.querySelectorAll(".fx:not(.in)").forEach((el) => revealIO.observe(el));
    root.querySelectorAll("[data-count]").forEach((el) => {
      if (countIO) countIO.observe(el);
      else el.textContent = el.dataset.count;
    });
  };

  /* ---- scroll progress bar ---- */
  const bar = document.querySelector(".fx-progress");
  if (bar && !reduced) {
    let ticking = false;
    const update = () => {
      const max = document.documentElement.scrollHeight - innerHeight;
      bar.style.transform = `scaleX(${max > 0 ? Math.min(scrollY / max, 1) : 0})`;
      ticking = false;
    };
    addEventListener("scroll", () => {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }

  /* ---- scroll reveals (trigger once on viewport entry) ---- */
  if (!reduced && "IntersectionObserver" in window) {
    revealIO = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add("in"); revealIO.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });

    countIO = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { runCount(e.target); countIO.unobserve(e.target); }
      });
    }, { threshold: 0.4 });
  }
  observe(document);

  /* ---- subtle 3D tilt on [data-tilt] cards (fine pointers only) ---- */
  if (fine && !reduced) {
    const MAX = 5; // degrees — controlled, not gimmicky
    document.addEventListener("pointermove", (ev) => {
      const card = ev.target.closest?.("[data-tilt]");
      if (!card) return;
      const r = card.getBoundingClientRect();
      const x = (ev.clientX - r.left) / r.width - 0.5;
      const y = (ev.clientY - r.top) / r.height - 0.5;
      card.style.transform =
        `perspective(900px) rotateX(${(-y * MAX).toFixed(2)}deg) rotateY(${(x * MAX).toFixed(2)}deg) translateY(-2px)`;
    }, { passive: true });
    document.addEventListener("pointerout", (ev) => {
      const card = ev.target.closest?.("[data-tilt]");
      if (card && !card.contains(ev.relatedTarget)) card.style.transform = "";
    }, { passive: true });
  }

  /* ---- hero glow drifts toward the pointer, slowly (desktop) ---- */
  const glow = document.querySelector(".bg-forge .glow");
  if (glow && fine && !reduced) {
    let tx = 0, ty = 0, cx = 0, cy = 0, raf = null;
    const drift = () => {
      cx += (tx - cx) * 0.04;
      cy += (ty - cy) * 0.04;
      glow.style.translate = `${cx.toFixed(1)}px ${cy.toFixed(1)}px`;
      if (Math.abs(tx - cx) + Math.abs(ty - cy) > 0.5) raf = requestAnimationFrame(drift);
      else raf = null;
    };
    addEventListener("pointermove", (e) => {
      tx = (e.clientX / innerWidth - 0.5) * 70;
      ty = (e.clientY / innerHeight - 0.5) * 50;
      if (!raf) raf = requestAnimationFrame(drift);
    }, { passive: true });
  }

  /* hooks for pages that render content or stats asynchronously */
  window.forgeMotionRefresh = (root) => observe(root || document);
  window.forgeCount = (el, n) => { el.dataset.count = String(n); runCount(el); };
})();
