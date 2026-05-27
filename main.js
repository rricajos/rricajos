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

  var VALID_SECTIONS = ["home", "services", "portfolio", "contact"];

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
        window.scrollTo({ top: mainEl.offsetTop - navH, behavior: "smooth" });

        setTimeout(function () {
          fin.classList.remove("fade-out");
          fin.classList.add("fade-in");
          navigating = false;
        }, 100);
      }, 100);

      currentSection = sectionId;
      if (pushState) {
        history.pushState({ section: sectionId }, "", "#" + sectionId);
      }
    } catch (error) {
      console.error("Navigation error:", error);
      navigating = false;
    }
  }

  /** Devuelve la sección del hash actual, o null si no es válida. */
  function getHashSection() {
    var hash = window.location.hash.replace("#", "");
    return VALID_SECTIONS.indexOf(hash) !== -1 ? hash : null;
  }

  // Back / forward del navegador
  window.addEventListener("popstate", function (e) {
    var section = (e.state && e.state.section) || getHashSection();
    if (section) nav(section, false);
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
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  });

  // ===== Inicialización =====
  document.addEventListener("DOMContentLoaded", function () {
    // Navegar a la sección del hash si existe
    var hashSection = getHashSection();
    if (hashSection && hashSection !== currentSection) {
      nav(hashSection);
    } else {
      history.replaceState({ section: currentSection }, "", "#" + currentSection);
    }

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
          btn.textContent = "Enviar mensaje";
        });
      });
    }
  });
})();
