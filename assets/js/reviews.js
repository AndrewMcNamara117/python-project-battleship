/* ============================================================
   IRON MILES — review behaviour
   Zero dependencies. Progressive enhancement only: every page is
   fully readable with this file blocked.

   Responsibilities
     · dev/draft gating          (draft copy never renders in production)
     · card + CTA state from the registry in reviews-data.js
     · category filters (live categories only — no dead controls)
     · section-nav scrollspy
     · imTrack(): privacy-safe event hook, no cookies, no PII
   ============================================================ */
(function (root, doc) {
  "use strict";

  var data = root.IronReviews;
  if (!data) return;

  var docEl = doc.documentElement;
  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------------------------------------------------
     Dev / draft mode
     Draft material renders on localhost or with ?draft=1 only.
     ironmiles.ie never shows unfinished copy.
     --------------------------------------------------------- */
  var host = location.hostname;
  var isDev =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "" ||
    /\.local$/.test(host) ||
    /(?:^|[?&])draft=1(?:&|$)/.test(location.search);
  if (isDev) docEl.classList.add("rv-dev");

  /* ---------------------------------------------------------
     imTrack — analytics hook
     The site currently ships no analytics vendor. Rather than
     inventing one, this forwards to whichever provider is added
     later and no-ops until then. It never sends personal data.
     --------------------------------------------------------- */
  function imTrack(event, props) {
    var payload = {};
    if (props) {
      for (var k in props) {
        if (Object.prototype.hasOwnProperty.call(props, k)) payload[k] = props[k];
      }
    }
    try {
      if (typeof root.plausible === "function") root.plausible(event, { props: payload });
      if (typeof root.gtag === "function") root.gtag("event", event, payload);
      if (root.dataLayer && typeof root.dataLayer.push === "function") {
        payload.event = event;
        root.dataLayer.push(payload);
      }
      /* Always dispatch, so anything can subscribe without a vendor. */
      doc.dispatchEvent(new CustomEvent("im:track", { detail: { event: event, props: payload } }));
    } catch (e) { /* analytics must never break the page */ }
  }
  root.imTrack = imTrack;

  /* ---------------------------------------------------------
     Review detail page
     --------------------------------------------------------- */
  var page = doc.querySelector("[data-review-slug]");
  if (page) {
    var slug = page.getAttribute("data-review-slug");
    var review = data.bySlug(slug);

    if (review) {
      imTrack("review_view", {
        slug: review.slug,
        product: review.productName,
        status: review.status
      });

      /* --- rating: renders ONLY when a real number exists ---
         ratingLabel is required alongside a scoped score (e.g. "Recovery
         rating"), so a rating given for one use case is never presented as
         an overall verdict for the product. */
      var ratingHost = doc.querySelector("[data-rv-rating]");
      if (ratingHost) {
        if (typeof review.rating === "number" && isFinite(review.rating)) {
          var max = typeof review.ratingMax === "number" ? review.ratingMax : 10;
          ratingHost.innerHTML =
            '<div class="rv-rating">' +
            (review.ratingLabel ? '<span class="rlbl">' + esc(review.ratingLabel) + "</span>" : "") +
            '<span class="score">' + review.rating + "</span>" +
            '<span class="out">out of ' + max + "</span></div>";
        } else {
          ratingHost.remove();
        }
      }

      /* --- product CTA: only a real affiliate URL becomes a link --- */
      var ctaHost = doc.querySelector("[data-rv-cta]");
      if (ctaHost) {
        var url = review.affiliateUrl;
        var valid = typeof url === "string" && /^https?:\/\//i.test(url);
        if (valid) {
          var a = doc.createElement("a");
          a.className = "btn btn-green";
          a.href = url;
          a.target = "_blank";
          a.rel = "sponsored noopener";
          a.textContent = "View current product information";
          a.addEventListener("click", function () {
            imTrack("product_link_click", {
              slug: review.slug, product: review.productName, brand: review.brand
            });
          });
          ctaHost.innerHTML = "";
          ctaHost.appendChild(a);
        } else {
          ctaHost.innerHTML =
            '<span class="rv-inert">View current product information</span>';
        }
      }

      /* --- specs: printed only once verified against an official source ---
         Unverified specs are never written into the HTML, so a blocked script
         can't leak them either. They only appear when verified === true. */
      var specHost = doc.querySelector("[data-rv-specs]");
      if (specHost) {
        var sp = review.specs;
        if (sp && sp.verified && sp.items && sp.items.length) {
          specHost.innerHTML =
            '<dl style="margin-top:16px;padding-top:14px;border-top:1px solid var(--line)">' +
            sp.items.map(function (i) {
              return "<dt>" + esc(i.label) + "</dt><dd>" + esc(i.value) + "</dd>";
            }).join("") + "</dl>";
          var note = doc.querySelector(".rv-unverified");
          if (note) note.remove();
        } else {
          specHost.remove();
        }
      }

      /* --- draft "needs input" list, dev only --- */
      var needsHost = doc.querySelector("[data-rv-needs]");
      if (needsHost && review.needsInput && review.needsInput.length && isDev) {
        needsHost.innerHTML = review.needsInput
          .map(function (t) { return "<li>" + esc(t) + "</li>"; })
          .join("");
      }
    }

    /* --- section-nav scrollspy --- */
    var toc = doc.querySelector(".rv-toc");
    if (toc) {
      var links = [].slice.call(toc.querySelectorAll("a[href^='#']"));
      var targets = links
        .map(function (a) { return doc.getElementById(a.getAttribute("href").slice(1)); })
        .filter(Boolean);

      if (targets.length && "IntersectionObserver" in root) {
        var spy = new IntersectionObserver(function (entries) {
          entries.forEach(function (e) {
            if (!e.isIntersecting) return;
            links.forEach(function (a) {
              var on = a.getAttribute("href") === "#" + e.target.id;
              if (on) a.setAttribute("aria-current", "true");
              else a.removeAttribute("aria-current");
            });
          });
        }, { rootMargin: "-15% 0px -70% 0px", threshold: 0 });
        targets.forEach(function (t) { spy.observe(t); });
      }
    }
  }

  /* ---------------------------------------------------------
     Reviews hub
     --------------------------------------------------------- */
  var hub = doc.querySelector("[data-rv-hub]");
  if (hub) {
    var cards = [].slice.call(hub.querySelectorAll(".rv-card"));

    /* --- apply registry state to each card --- */
    cards.forEach(function (card) {
      var r = data.bySlug(card.getAttribute("data-slug"));
      if (!r) return;
      var foot = card.querySelector(".cfoot");

      if (r.status !== "published") {
        card.classList.add("is-draft");
        if (foot) foot.innerHTML = "Full long-term review coming soon";
        /* A draft card is not a link out to an unfinished page in production. */
        if (!isDev && card.tagName === "A") {
          var span = doc.createElement("div");
          span.className = card.className;
          span.setAttribute("data-slug", r.slug);
          span.innerHTML = card.innerHTML;
          card.parentNode.replaceChild(span, card);
          return;
        }
      }

      card.addEventListener("click", function () {
        imTrack("review_card_click", { slug: r.slug, product: r.productName, status: r.status });
      });
    });

    /* --- category filters: only categories with published reviews are live --- */
    var filterHost = hub.querySelector("[data-rv-filters]");
    if (filterHost) {
      data.categories.forEach(function (cat) {
        var live = data.isCategoryLive(cat.id);
        var b = doc.createElement("button");
        b.type = "button";
        b.className = "rv-chip";
        b.textContent = cat.label;
        b.setAttribute("aria-pressed", cat.id === "all" ? "true" : "false");
        if (!live) {
          b.disabled = true;
          b.title = "No reviews published in this category yet";
        }
        b.addEventListener("click", function () {
          filterHost.querySelectorAll(".rv-chip").forEach(function (o) {
            o.setAttribute("aria-pressed", "false");
          });
          b.setAttribute("aria-pressed", "true");
          applyFilter(cat.id);
          imTrack("review_filter", { category: cat.id });
        });
        filterHost.appendChild(b);
      });
    }

    function applyFilter(id) {
      [].slice.call(hub.querySelectorAll("[data-slug]")).forEach(function (card) {
        var r = data.bySlug(card.getAttribute("data-slug"));
        var show = !r || id === "all" || r.category === id;
        card.style.display = show ? "" : "none";
      });
    }
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* Expose for debugging in dev only. */
  if (isDev) root.__ironReviewsDev = { data: data, reduced: reduced };
})(window, document);
