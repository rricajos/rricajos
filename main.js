/**
 * main.js — Navegación SPA, tabla ordenable y formulario de contacto.
 *
 * Flujo de navegación:
 *   1. click en [data-section] → nav(sectionId)
 *   2. fade-out de la sección actual (100 ms)
 *   3. swap display:none / display:block
 *   4. fade-in de la nueva sección (100 ms)
 *   5. pushState al historial del navegador
 *
 * Estado: se mantiene en un closure (IIFE) para no contaminar el ámbito global.
 */
(function () {
  "use strict";

  // ===== Service Worker =====
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js");
  }

  // ===== Estado interno =====
  var currentSection = "home";
  var navigating = false;
  var activeDetail = null;   // panel de servicio abierto
  var sortDirection = false; // alternar ASC / DESC en la tabla
  var calLoaded = false;     // Cal.com cargado bajo demanda

  var VALID_SECTIONS = ["home", "services", "portfolio", "contact"];

  // ===== Preferencias de movimiento =====
  var prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  function scrollBehavior() {
    return prefersReducedMotion.matches ? "auto" : "smooth";
  }

  // ===== Detalle de servicio (acordeón) =====
  function toggleDetail(id) {
    var details = document.querySelectorAll(".service-close-detail");
    var target = document.getElementById(id);
    var trigger = document.querySelector('[data-detail="' + id + '"]');

    // Si ya está abierto, cerrar
    if (activeDetail === target) {
      target.classList.remove("open");
      if (trigger) trigger.setAttribute("aria-expanded", "false");
      activeDetail = null;
      return;
    }

    // Cerrar todos, luego abrir el seleccionado
    details.forEach(function (d) { d.classList.remove("open"); });
    document.querySelectorAll("[data-detail]").forEach(function (btn) {
      btn.setAttribute("aria-expanded", "false");
    });

    if (target) {
      target.classList.add("open");
      if (trigger) trigger.setAttribute("aria-expanded", "true");
      activeDetail = target;

      // Smooth scroll the opened card into view
      // On mobile, wait for the CSS max-height transition (400ms) and use "start"
      var isMobile = window.innerWidth <= 720;
      setTimeout(function () {
        if (trigger) {
          trigger.scrollIntoView({ behavior: scrollBehavior(), block: isMobile ? "start" : "nearest" });
        }
      }, isMobile ? 350 : 100);
    }
  }

  // ===== Tabla ordenable =====
  function sortTable(columnIndex) {
    var table = document.getElementById("services-table");
    if (!table) return;

    var tbody = table.tBodies[0];
    var rows = Array.from(tbody.rows);

    table.querySelectorAll("th").forEach(function (th) {
      th.classList.remove("asc", "desc");
      th.removeAttribute("aria-sort");
    });

    sortDirection = !sortDirection;

    rows.sort(function (rowA, rowB) {
      var cellA = rowA.cells[columnIndex].innerText.trim();
      var cellB = rowB.cells[columnIndex].innerText.trim();

      if (columnIndex === 1) {
        var numA = parseFloat(cellA.replace(/[^\d.-]/g, "")) || 0;
        var numB = parseFloat(cellB.replace(/[^\d.-]/g, "")) || 0;
        return sortDirection ? numA - numB : numB - numA;
      }
      return sortDirection
        ? cellA.localeCompare(cellB)
        : cellB.localeCompare(cellA);
    });

    rows.forEach(function (row) { tbody.appendChild(row); });

    var header = table.querySelectorAll("th")[columnIndex];
    header.classList.toggle("asc", sortDirection);
    header.classList.toggle("desc", !sortDirection);
    header.setAttribute("aria-sort", sortDirection ? "ascending" : "descending");
  }

  // ===== Lazy load Cal.com =====
  function loadCal() {
    if (calLoaded) return;
    calLoaded = true;
    (function (C, A, L) {
      var p = function (a, ar) { a.q.push(ar); };
      var d = C.document;
      C.Cal = C.Cal || function () {
        var cal = C.Cal;
        var ar = arguments;
        if (!cal.loaded) {
          cal.ns = {};
          cal.q = cal.q || [];
          d.head.appendChild(d.createElement("script")).src = A;
          cal.loaded = true;
        }
        if (ar[0] === L) {
          var api = function () { p(api, arguments); };
          var namespace = ar[1];
          api.q = api.q || [];
          if (typeof namespace === "string") {
            cal.ns[namespace] = api;
            p(api, ar);
          } else {
            p(cal, ar);
          }
          return;
        }
        p(cal, ar);
      };
    })(window, "https://app.cal.com/embed/embed.js", "init");
    Cal("init", { origin: "https://cal.com" });
    Cal("inline", {
      elementOrSelector: "#cal-inline",
      calLink: "ricard-penin-lwzsun/consulta",
      config: { layout: "month_view", theme: "dark" }
    });
    Cal("ui", {
      theme: "dark",
      styles: { branding: { brandColor: "#007bff" } },
      hideEventTypeDetails: false
    });
  }

  // ===== Navegación entre secciones =====
  function nav(sectionId, pushState) {
    if (pushState === undefined) pushState = true;
    if (navigating || currentSection === sectionId) return;

    navigating = true;

    var fout = document.getElementById(currentSection);
    var fin = document.getElementById(sectionId);

    // Actualizar botones activos (desktop + mobile)
    document.querySelectorAll('[data-section="' + currentSection + '"]')
      .forEach(function (btn) { btn.classList.remove("active"); });
    document.querySelectorAll('[data-section="' + sectionId + '"]')
      .forEach(function (btn) { btn.classList.add("active"); });

    try {
      fout.classList.remove("fade-in");
      fout.classList.add("fade-out");

      setTimeout(function () {
        fout.classList.remove("active");
        fin.classList.add("active");

        // Scroll al inicio de <main> descontando la altura del nav
        var mainEl = document.querySelector("main");
        var navH = document.querySelector(".supernav").offsetHeight;
        window.scrollTo({ top: mainEl.offsetTop - navH, behavior: scrollBehavior() });

        setTimeout(function () {
          fin.classList.remove("fade-out");
          fin.classList.add("fade-in");
          navigating = false;
        }, 100);
      }, 100);

      currentSection = sectionId;
      if (sectionId === "contact") loadCal();
      if (pushState) {
        history.pushState({ section: sectionId }, "", "#" + sectionId);
      }
    } catch (error) {
      console.error("Navigation error:", error);
      navigating = false;
    }
  }

  /** Parsea el hash → { section, subPath, params } o null.
   *  Soporta #portfolio/smm y #portfolio?tag=svelte */
  function parseHash() {
    var hash = window.location.hash.replace("#", "");
    if (!hash) return null;
    var qIndex = hash.indexOf("?");
    var path = qIndex === -1 ? hash : hash.substring(0, qIndex);
    var queryStr = qIndex === -1 ? "" : hash.substring(qIndex + 1);
    var slash = path.indexOf("/");
    var section = slash === -1 ? path : path.substring(0, slash);
    var subPath = slash === -1 ? null : path.substring(slash + 1) || null;
    if (VALID_SECTIONS.indexOf(section) === -1) return null;
    var params = {};
    if (queryStr) {
      queryStr.split("&").forEach(function (pair) {
        var kv = pair.split("=");
        if (kv.length === 2) params[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1]);
      });
    }
    return { section: section, subPath: subPath, params: params };
  }

  // Back / forward del navegador
  window.addEventListener("popstate", function (e) {
    var parsed = (e.state && e.state.section)
      ? { section: e.state.section, subPath: e.state.subPath || null }
      : parseHash();
    if (parsed && parsed.section !== currentSection) {
      nav(parsed.section, false);
    }
    // Cambios de sub-path dentro de la misma sección los gestiona cada módulo
  });

  // ===== Delegación de eventos (click) =====
  document.addEventListener("click", function (e) {
    var navBtn = e.target.closest("[data-section]");
    if (navBtn) {
      e.preventDefault();
      nav(navBtn.dataset.section);
      return;
    }

    var detailBtn = e.target.closest("[data-detail]");
    if (detailBtn) {
      toggleDetail(detailBtn.dataset.detail);
      return;
    }

    var sortBtn = e.target.closest("[data-sort]");
    if (sortBtn) {
      sortTable(parseInt(sortBtn.dataset.sort, 10));
      return;
    }

    var scrollBtn = e.target.closest("[data-scroll-top]");
    if (scrollBtn) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: scrollBehavior() });
    }
  });

  // ===== Delegación de eventos (keydown) =====
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Enter" && e.key !== " ") return;

    var sortBtn = e.target.closest("[data-sort]");
    if (sortBtn) {
      e.preventDefault();
      sortTable(parseInt(sortBtn.dataset.sort, 10));
    }
  });

  // ===== Inicialización =====
  document.addEventListener("DOMContentLoaded", function () {
    // Navegar a la sección del hash (soporta sub-path y query params)
    var originalHash = window.location.hash;
    var parsed = parseHash();
    if (parsed) {
      if (parsed.subPath) {
        window.__pendingRepoDetail = parsed.subPath;
      }
      var hasParams = parsed.params && Object.keys(parsed.params).length > 0;
      if (hasParams) {
        window.__pendingPortfolioFilter = parsed.params;
      }
      if (parsed.section !== currentSection) {
        nav(parsed.section);
        // Restaurar hash original si tenía sub-path o query params
        if (parsed.subPath || hasParams) {
          history.replaceState(
            { section: parsed.section, subPath: parsed.subPath, params: parsed.params },
            "",
            originalHash
          );
        }
      } else {
        history.replaceState(
          { section: currentSection },
          "",
          originalHash || "#" + currentSection
        );
      }
    } else {
      history.replaceState({ section: currentSection }, "", "#" + currentSection);
    }

    // Cargar Cal.com si la sección inicial es contacto
    if (currentSection === "contact") loadCal();

    // Orden inicial de la tabla por precio (columna 1)
    sortTable(1);

    // Inicializar aria-expanded en botones de servicio
    document.querySelectorAll("[data-detail]").forEach(function (btn) {
      btn.setAttribute("aria-expanded", "false");
    });

    // Formulario de contacto (FormSubmit.co)
    var form = document.getElementById("contact-form");
    var feedback = document.getElementById("form-feedback");

    if (form && feedback) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var btn = form.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.setAttribute("aria-busy", "true");
        btn.textContent = "Enviando...";
        feedback.hidden = true;

        fetch(form.action, {
          method: "POST",
          body: new FormData(form),
          headers: { Accept: "application/json" }
        })
        .then(function (res) {
          if (res.ok) {
            feedback.textContent = "Mensaje enviado. Te responderé lo antes posible.";
            feedback.className = "form-feedback success";
            feedback.hidden = false;
            form.reset();
            form.querySelectorAll(".field-error, .field-valid").forEach(function (el) {
              el.classList.remove("field-error", "field-valid");
            });
          } else {
            throw new Error("Error " + res.status);
          }
        })
        .catch(function () {
          feedback.textContent = "No se pudo enviar. Prueba con el email directamente.";
          feedback.className = "form-feedback error";
          feedback.hidden = false;
        })
        .finally(function () {
          btn.disabled = false;
          btn.removeAttribute("aria-busy");
          btn.textContent = "Enviar mensaje";
        });
      });

      // Validación en tiempo real (blur)
      form.querySelectorAll("[required]").forEach(function (field) {
        field.addEventListener("blur", function () {
          if (field.value.trim() === "") {
            field.classList.add("field-error");
            field.classList.remove("field-valid");
          } else if (field.type === "email" && !field.validity.valid) {
            field.classList.add("field-error");
            field.classList.remove("field-valid");
          } else {
            field.classList.remove("field-error");
            field.classList.add("field-valid");
          }
        });
        field.addEventListener("input", function () {
          field.classList.remove("field-error");
        });
      });

      // Contador de caracteres para textarea
      var messageField = document.getElementById("contact-message");
      if (messageField) {
        var maxChars = 1000;
        var counter = document.createElement("span");
        counter.className = "char-counter";
        counter.textContent = "0 / " + maxChars;
        messageField.parentNode.insertBefore(counter, messageField.nextSibling);

        messageField.addEventListener("input", function () {
          var len = messageField.value.length;
          counter.textContent = len + " / " + maxChars;
          counter.classList.toggle("char-counter-warn", len > maxChars * 0.9);
          counter.classList.toggle("char-counter-over", len >= maxChars);
        });
      }
    }
  });
})();
