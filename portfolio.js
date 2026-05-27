/**
 * portfolio.js — Carga repos de GitHub y los renderiza en dos grids.
 *   - Destacados (pinned): repos fijados manualmente en PINNED_NAMES.
 *   - Todos: el resto de repos públicos no forkeados.
 *   - Vista detalle: al hacer clic en un repo, muestra archivos, README y links.
 *   - Navegación de archivos: explorar carpetas, ver archivos raw, submodules.
 *
 * Caché: sessionStorage con TTL de 10 minutos para evitar
 * agotar el límite de 60 req/h de la API sin autenticar.
 */
(function () {
  "use strict";

  var GITHUB_USER = "rricajos";
  var PINNED_NAMES = ["smm", "languages", "qrsgen", "unix"];
  var HIDDEN_REPOS = ["rricajos", "java", "php", "javascript"]; // profile readme + study repos (shown in About Me)

  var CONFIG = {
    CACHE_TTL: 10 * 60 * 1000,
    MAX_FILE_DISPLAY: 512 * 1024,
    DEBOUNCE_DELAY: 250
  };

  var CACHE_KEY = "rricajos_repos";

  // Preferencias de movimiento
  var prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  function scrollBehavior() {
    return prefersReducedMotion.matches ? "auto" : "smooth";
  }

  var pinnedContainer = document.getElementById("pinned-container");
  var allContainer = document.getElementById("all-repos-container");
  var gridView = document.getElementById("portfolio-grid-view");
  var detailView = document.getElementById("repo-detail");

  // Mapa nombre → repo para acceso rápido desde la vista detalle
  var repoMap = {};

  // Estado de la vista detalle
  var currentRepoName = "";
  var currentPath = []; // segmentos del path actual, e.g. ["src", "components"]
  var readmeHTMLCache = ""; // README renderizado, para restaurar tras ver un archivo
  var activeFilter = null; // { type: "tag"|"lang", value: "svelte" }

  // Límites para visualización de archivos
  var IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "svg", "webp", "ico", "bmp"];
  var BINARY_EXTENSIONS = [
    "pdf", "zip", "tar", "gz", "7z", "rar",
    "exe", "dll", "so", "dylib",
    "woff", "woff2", "ttf", "eot",
    "mp3", "mp4", "avi", "mov", "mkv",
    "class", "jar", "o", "pyc"
  ];

  // ===== Utilidades =====

  /** Fetch con timeout usando AbortController (default 10s). */
  function fetchWithTimeout(url, options, timeoutMs) {
    if (timeoutMs === undefined) timeoutMs = 10000;
    var controller = new AbortController();
    var id = setTimeout(function () { controller.abort(); }, timeoutMs);
    var opts = Object.assign({}, options || {}, { signal: controller.signal });
    return fetch(url, opts).finally(function () { clearTimeout(id); });
  }

  /** Escapa caracteres HTML para prevenir XSS con datos de la API. */
  function escapeHTML(str) {
    var div = document.createElement("div");
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  /** Decodifica base64 a UTF-8 (soporta caracteres multi-byte). */
  function decodeBase64UTF8(base64) {
    var raw = atob(base64);
    var bytes = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) {
      bytes[i] = raw.charCodeAt(i);
    }
    return new TextDecoder("utf-8").decode(bytes);
  }

  /** Formatea bytes a unidades legibles. */
  function formatSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  /** Devuelve la extensión de un archivo en minúsculas. */
  function getExtension(name) {
    var parts = name.split(".");
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
  }

  /** Caché de sessionStorage para llamadas a la API. */
  function getCached(key) {
    try {
      var raw = sessionStorage.getItem(key);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (Date.now() - parsed.timestamp < CONFIG.CACHE_TTL) return parsed.data;
    } catch (e) { /* corrupted — ignorar */ }
    return null;
  }

  function setCache(key, data) {
    try {
      sessionStorage.setItem(key, JSON.stringify({ data: data, timestamp: Date.now() }));
    } catch (e) { /* quota exceeded — ignorar */ }
  }

  // ===== Card background images from README =====

  /** Extracts the first meaningful image URL from README HTML (skips badges, SVGs, tiny icons). */
  function extractFirstImage(html) {
    var div = document.createElement("div");
    div.innerHTML = html;
    var imgs = div.querySelectorAll("img");
    for (var i = 0; i < imgs.length; i++) {
      var src = imgs[i].getAttribute("src") || "";
      if (src.indexOf("shields.io") !== -1) continue;
      if (src.indexOf("badge") !== -1) continue;
      if (src.indexOf("data:image/svg") !== -1) continue;
      if (/\.svg(\?|$)/i.test(src)) continue;
      var w = parseInt(imgs[i].getAttribute("width"), 10);
      var h = parseInt(imgs[i].getAttribute("height"), 10);
      if (w && w < 64) continue;
      if (h && h < 64) continue;
      return src;
    }
    return null;
  }

  /** Applies a background image to a repo card. */
  function applyCardBackground(card, imageUrl) {
    card.classList.add("repo-card-with-bg");
    card.style.backgroundImage = "url(\"" + imageUrl.replace(/"/g, "%22") + "\")";
  }

  /** Fetches README and extracts the first image for a card background. */
  function fetchCardImage(card, repoName) {
    var imgCacheKey = "repo_card_img_" + repoName;
    var cachedImg = getCached(imgCacheKey);

    if (cachedImg === "none") return;
    if (cachedImg) {
      applyCardBackground(card, cachedImg);
      return;
    }

    var readmeCacheKey = "repo_readme_" + repoName;
    var cachedReadme = getCached(readmeCacheKey);

    if (cachedReadme) {
      var url = extractFirstImage(cachedReadme);
      setCache(imgCacheKey, url || "none");
      if (url) applyCardBackground(card, url);
      return;
    }

    fetchWithTimeout(
      "https://api.github.com/repos/" + GITHUB_USER + "/" + repoName + "/readme",
      { headers: { Accept: "application/vnd.github.html" } }
    )
      .then(function (res) {
        if (!res.ok) throw new Error(res.status);
        return res.text();
      })
      .then(function (html) {
        setCache(readmeCacheKey, html);
        var url = extractFirstImage(html);
        setCache(imgCacheKey, url || "none");
        if (url) applyCardBackground(card, url);
      })
      .catch(function () {
        setCache(imgCacheKey, "none");
      });
  }

  /** IntersectionObserver for lazy-loading card background images. */
  var cardBgObserver = null;
  if ("IntersectionObserver" in window) {
    cardBgObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var card = entry.target;
          var repoName = card.dataset.repo;
          if (repoName && !card.classList.contains("skeleton-card")) {
            fetchCardImage(card, repoName);
          }
          cardBgObserver.unobserve(card);
        }
      });
    }, { rootMargin: "200px" });
  }

  /** Convierte una fecha ISO a texto relativo en español. */
  function timeAgo(dateStr) {
    var diff = Date.now() - new Date(dateStr).getTime();
    var days = Math.floor(diff / 86400000);
    var months = Math.floor(days / 30);
    var years = Math.floor(days / 365);

    if (years > 0)  return "hace " + years + (years === 1 ? " año" : " años");
    if (months > 0) return "hace " + months + (months === 1 ? " mes" : " meses");
    if (days > 0)   return "hace " + days + (days === 1 ? " día" : " días");
    return "hoy";
  }

  /** Parsea un query string "tag=svelte&lang=js" → { tag: "svelte", lang: "js" } */
  function parseQueryString(str) {
    var params = {};
    if (str) {
      str.split("&").forEach(function (pair) {
        var kv = pair.split("=");
        if (kv.length === 2) params[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1]);
      });
    }
    return params;
  }

  // ===== Skeleton loading =====
  function showSkeletons(container, count) {
    container.innerHTML = "";
    for (var i = 0; i < count; i++) {
      var skeleton = document.createElement("div");
      skeleton.classList.add("repo-card", "skeleton-card");
      skeleton.innerHTML =
        '<div class="skeleton-line skeleton-title"></div>' +
        '<div class="skeleton-line skeleton-text"></div>' +
        '<div class="skeleton-line skeleton-text short"></div>' +
        '<div class="skeleton-line skeleton-badges"></div>';
      container.appendChild(skeleton);
    }
  }

  // ===== Card de repositorio =====
  function createCard(repo, isPinned) {
    var card = document.createElement("div");
    card.classList.add("repo-card", "animate-in");
    card.setAttribute("data-repo", repo.name);
    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");
    if (isPinned) card.classList.add("pinned-card");

    var langHTML = "";
    if (repo.language) {
      langHTML = '<span class="language-badge" data-filter-lang="' + escapeHTML(repo.language) + '" role="button" tabindex="0" aria-label="Filtrar por lenguaje: ' + escapeHTML(repo.language) + '">' + escapeHTML(repo.language) + "</span>";
    }

    var starsHTML = "";
    if (repo.stargazers_count > 0) {
      starsHTML = '<span class="repo-stars">' +
        '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg> ' +
        repo.stargazers_count +
      "</span>";
    }

    var topicsHTML = "";
    if (repo.topics && repo.topics.length > 0) {
      topicsHTML = '<div class="repo-topics">';
      repo.topics.forEach(function (topic) {
        topicsHTML += '<span class="repo-topic" data-filter-tag="' + escapeHTML(topic) + '" role="button" tabindex="0" aria-label="Filtrar por tag: ' + escapeHTML(topic) + '">' + escapeHTML(topic) + "</span>";
      });
      topicsHTML += "</div>";
    }

    var updatedHTML = "";
    if (repo.updated_at) {
      updatedHTML = '<span class="repo-updated">' + timeAgo(repo.updated_at) + "</span>";
    }

    var homepageHTML = repo.homepage
      ? '<span class="repo-homepage">Demo &rarr;</span>'
      : "";

    var desc = repo.description || "Sin descripción.";
    if (desc.length > 100) desc = desc.substring(0, 100) + "\u2026";

    card.innerHTML =
      "<h3>" + escapeHTML(repo.name) + "</h3>" +
      "<p>" + escapeHTML(desc) + "</p>" +
      topicsHTML +
      '<div class="repo-meta">' +
        '<div class="repo-languages">' + langHTML + starsHTML + "</div>" +
        '<div class="repo-meta-right">' + updatedHTML + homepageHTML + "</div>" +
      "</div>";

    return card;
  }

  // ===== Renderizado del grid =====
  function renderRepos(allRepos) {
    var pinned = [];
    var others = [];

    allRepos.forEach(function (repo) {
      if (repo.fork) return;

      // Always index (needed for data-open-repo links from About Me)
      repoMap[repo.name] = repo;

      if (HIDDEN_REPOS.indexOf(repo.name) !== -1) return;

      if (PINNED_NAMES.indexOf(repo.name) !== -1) {
        pinned.push(repo);
      } else {
        others.push(repo);
      }
    });

    // Mantener el orden manual de PINNED_NAMES
    pinned.sort(function (a, b) {
      return PINNED_NAMES.indexOf(a.name) - PINNED_NAMES.indexOf(b.name);
    });

    pinnedContainer.innerHTML = "";
    pinned.forEach(function (repo) {
      pinnedContainer.appendChild(createCard(repo, true));
    });

    allContainer.innerHTML = "";
    if (others.length === 0) {
      allContainer.innerHTML = '<p class="portfolio-empty">No hay más repositorios.</p>';
    } else {
      others.forEach(function (repo) {
        allContainer.appendChild(createCard(repo, false));
      });
    }

    // Observe cards for lazy background images
    if (cardBgObserver) {
      var bgCards = gridView.querySelectorAll("[data-repo]:not(.skeleton-card)");
      bgCards.forEach(function (c) { cardBgObserver.observe(c); });
    }
  }

  // ===== Vista detalle =====

  /** Icono SVG para carpetas */
  var ICON_FOLDER = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>';
  /** Icono SVG para archivos */
  var ICON_FILE = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
  /** Icono SVG para submodules (link) */
  var ICON_SUBMODULE = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';

  /** Abre la vista detalle de un repositorio. */
  function openRepoDetail(repoName, pushHistory) {
    if (pushHistory === undefined) pushHistory = true;
    var repo = repoMap[repoName];
    if (!repo) {
      gridView.hidden = true;
      detailView.hidden = false;
      detailView.innerHTML =
        '<div class="portfolio-empty" style="padding:3rem">' +
          '<p>El repositorio <strong>' + escapeHTML(repoName) + '</strong> no existe o no se ha cargado.</p>' +
          '<button class="cta-button" data-repo-back style="margin-top:1rem">Volver al portfolio</button>' +
        '</div>';
      return;
    }

    currentRepoName = repoName;
    currentPath = [];
    readmeHTMLCache = "";

    gridView.hidden = true;
    detailView.hidden = false;

    // Scroll arriba
    var mainEl = document.querySelector("main");
    var navH = document.querySelector(".supernav").offsetHeight;
    window.scrollTo({ top: mainEl.offsetTop - navH, behavior: scrollBehavior() });

    // Renderizar estructura base
    var desc = repo.description ? escapeHTML(repo.description) : "Sin descripción.";
    var actionsHTML = "";
    if (repo.homepage) {
      actionsHTML += '<a href="' + escapeHTML(repo.homepage) + '" target="_blank" rel="noopener" class="cta-button">Ver demo</a>';
    }
    actionsHTML += '<a href="' + escapeHTML(repo.html_url) + '" target="_blank" rel="noopener" class="repo-detail-github">Ver en GitHub &rarr;</a>';

    // Skeleton de carga para archivos (8 filas)
    var filesSkeleton = '<div class="detail-skeleton">';
    for (var i = 0; i < 8; i++) {
      filesSkeleton += '<div class="skeleton-line skeleton-file-row"></div>';
    }
    filesSkeleton += "</div>";

    // Skeleton de carga para README
    var readmeSkeleton = '<div class="detail-skeleton">' +
      '<div class="skeleton-line skeleton-title"></div>' +
      '<div class="skeleton-line skeleton-text"></div>' +
      '<div class="skeleton-line skeleton-text"></div>' +
      '<div class="skeleton-line skeleton-text short"></div>' +
      '<div class="skeleton-line" style="height:10px;width:0"></div>' +
      '<div class="skeleton-line skeleton-title" style="width:45%"></div>' +
      '<div class="skeleton-line skeleton-text"></div>' +
      '<div class="skeleton-line skeleton-text short"></div>' +
      '<div class="skeleton-line skeleton-text"></div>' +
      '<div class="skeleton-line skeleton-text" style="width:85%"></div>' +
      "</div>";

    detailView.innerHTML =
      '<button class="repo-detail-back" data-repo-back>' +
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>' +
        " Volver" +
      "</button>" +
      '<div class="repo-detail-header">' +
        "<h2>" + escapeHTML(repo.name) + "</h2>" +
        "<p>" + desc + "</p>" +
        '<div class="repo-detail-actions">' + actionsHTML + "</div>" +
        '<div class="repo-detail-share">' +
          (navigator.share ? '<button class="share-btn share-btn-native" data-share="native" aria-label="Compartir"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg> Compartir</button>' : '') +
          '<button class="share-btn" data-share="twitter" aria-label="Compartir en X">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>' +
          '</button>' +
          '<button class="share-btn" data-share="linkedin" aria-label="Compartir en LinkedIn">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>' +
          '</button>' +
          '<button class="share-btn" data-share="whatsapp" aria-label="Compartir por WhatsApp">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>' +
          '</button>' +
          '<button class="share-btn" data-share="copy" aria-label="Copiar enlace">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>' +
          '</button>' +
        '</div>' +
      "</div>" +
      '<div class="repo-detail-body">' +
        '<div class="repo-detail-files">' +
          '<div class="files-header">' +
            "<h3>Archivos</h3>" +
            '<button class="files-toggle" data-files-toggle aria-expanded="false">' +
              "<span>Ver archivos</span>" +
              '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>' +
            "</button>" +
          "</div>" +
          '<div id="repo-files-list" class="repo-files-list">' + filesSkeleton + "</div>" +
        "</div>" +
        '<div class="repo-detail-readme">' +
          '<div class="repo-right-header">' +
            '<h3 id="repo-right-title">README</h3>' +
            '<button id="repo-show-readme" class="repo-show-readme" hidden data-show-readme>' +
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>' +
              " README" +
            "</button>" +
          "</div>" +
          '<div id="repo-right-content" class="repo-readme-content">' + readmeSkeleton + "</div>" +
        "</div>" +
      "</div>";

    // Actualizar hash en la URL
    if (pushHistory) {
      history.pushState(
        { section: "portfolio", subPath: repoName },
        "",
        "#portfolio/" + repoName
      );
    }

    // Fetch archivos y README en paralelo
    fetchContents(currentRepoName, "");
    fetchReadme(currentRepoName);
  }

  /** Cierra la vista detalle y vuelve al grid. */
  function closeRepoDetail(pushHistory) {
    if (pushHistory === undefined) pushHistory = true;
    currentRepoName = "";
    currentPath = [];
    readmeHTMLCache = "";
    detailView.hidden = true;
    detailView.innerHTML = "";
    gridView.hidden = false;

    if (pushHistory) {
      if (activeFilter) {
        history.pushState(
          { section: "portfolio", filter: { type: activeFilter.type, value: activeFilter.value } },
          "",
          "#portfolio?" + encodeURIComponent(activeFilter.type) + "=" + encodeURIComponent(activeFilter.value)
        );
      } else {
        history.pushState({ section: "portfolio" }, "", "#portfolio");
      }
    }
  }

  // ===== Apertura desde secciones externas (e.g. "Sobre mi") =====

  /** Abre un repo desde otra sección, navegando primero al portfolio. */
  function openRepoFromExternal(repoName) {
    var repo = repoMap[repoName];
    if (!repo) {
      // Repo no cargado aún — abrir en GitHub como fallback
      window.open("https://github.com/" + GITHUB_USER + "/" + repoName, "_blank");
      return;
    }

    var portfolioSection = document.getElementById("portfolio");
    if (portfolioSection.classList.contains("active")) {
      // Ya estamos en portfolio
      openRepoDetail(repoName);
    } else {
      // Navegar a portfolio clickando el botón del nav
      var portfolioBtn = document.querySelector('.supernav [data-section="portfolio"]');
      if (portfolioBtn) portfolioBtn.click();
      // Esperar a que la transición termine (100ms fade-out + 100ms fade-in + margen)
      setTimeout(function () {
        openRepoDetail(repoName);
      }, CONFIG.DEBOUNCE_DELAY);
    }
  }

  // ===== Navegación de archivos =====

  /** Navega a una carpeta del repositorio. */
  function navigateToFolder(path) {
    currentPath = path ? path.split("/") : [];
    fetchContents(currentRepoName, path);
    // Restaurar README si se estaba viendo un archivo
    showReadme();
  }

  /** Restaura el README en el panel derecho. */
  function showReadme() {
    var titleEl = document.getElementById("repo-right-title");
    var contentEl = document.getElementById("repo-right-content");
    var btnEl = document.getElementById("repo-show-readme");

    if (titleEl) titleEl.textContent = "README";
    if (btnEl) btnEl.hidden = true;
    if (contentEl && readmeHTMLCache) {
      contentEl.innerHTML = readmeHTMLCache;
    }
  }

  // ===== Fetch de contenidos (directorio) =====

  /** Fetch del listado de archivos de un path. */
  function fetchContents(repoName, path) {
    var cacheKey = "repo_contents_" + repoName + "_" + path;
    var cached = getCached(cacheKey);

    if (cached) {
      renderFiles(cached);
      return;
    }

    var el = document.getElementById("repo-files-list");
    if (el) {
      var sk = '<div class="detail-skeleton">';
      for (var s = 0; s < 6; s++) sk += '<div class="skeleton-line skeleton-file-row"></div>';
      sk += "</div>";
      el.innerHTML = sk;
    }

    var apiUrl = "https://api.github.com/repos/" + GITHUB_USER + "/" + repoName + "/contents";
    if (path) apiUrl += "/" + path;

    fetchWithTimeout(apiUrl)
      .then(function (res) {
        if (!res.ok) throw new Error("API " + res.status);
        return res.json();
      })
      .then(function (files) {
        setCache(cacheKey, files);
        renderFiles(files);
      })
      .catch(function (err) {
        var msg = err.name === "AbortError"
          ? "La petición tardó demasiado. Inténtalo de nuevo."
          : "No se pudieron cargar los archivos.";
        if (el) el.innerHTML = '<p class="portfolio-empty">' + msg + '</p>';
      });
  }

  /** Renderiza el listado de archivos con breadcrumbs y navegación. */
  function renderFiles(files) {
    var el = document.getElementById("repo-files-list");
    if (!el) return;

    // Ordenar: carpetas primero, luego submodules, luego archivos
    var typeOrder = { dir: 0, submodule: 1, file: 2 };
    files.sort(function (a, b) {
      var aOrd = typeOrder[a.type] !== undefined ? typeOrder[a.type] : 2;
      var bOrd = typeOrder[b.type] !== undefined ? typeOrder[b.type] : 2;
      if (aOrd !== bOrd) return aOrd - bOrd;
      return a.name.localeCompare(b.name);
    });

    // Breadcrumbs
    var bc = '<nav class="file-breadcrumbs" aria-label="Ruta de archivos">';
    bc += '<span class="file-breadcrumb" data-nav-path="" role="button" tabindex="0">' + escapeHTML(currentRepoName) + "</span>";

    var accumulated = "";
    currentPath.forEach(function (segment, i) {
      accumulated += (i === 0 ? "" : "/") + segment;
      bc += '<span class="file-breadcrumb-sep">/</span>';
      if (i === currentPath.length - 1) {
        bc += '<span class="file-breadcrumb active">' + escapeHTML(segment) + "</span>";
      } else {
        bc += '<span class="file-breadcrumb" data-nav-path="' + escapeHTML(accumulated) + '" role="button" tabindex="0">' + escapeHTML(segment) + "</span>";
      }
    });
    bc += "</nav>";

    var html = bc + '<ul class="file-tree">';

    // Entrada ".." para subir de nivel
    if (currentPath.length > 0) {
      var parentPath = currentPath.slice(0, -1).join("/");
      html += '<li class="file-tree-item">' +
        '<span class="file-tree-link" data-nav-path="' + escapeHTML(parentPath) + '" role="button" tabindex="0">' +
          '<span class="file-tree-icon">' + ICON_FOLDER + "</span>" +
          "<span>..</span>" +
        "</span>" +
      "</li>";
    }

    var currentDir = currentPath.join("/");

    files.forEach(function (f) {
      var name = escapeHTML(f.name);
      var fullPath = currentDir ? currentDir + "/" + f.name : f.name;

      if (f.type === "submodule") {
        // Submodule: abrir URL externa
        var subUrl = f.submodule_git_url || f.html_url || "";
        if (subUrl.indexOf("git://") === 0) subUrl = subUrl.replace("git://", "https://");
        if (subUrl.slice(-4) === ".git") subUrl = subUrl.slice(0, -4);

        html += '<li class="file-tree-item">' +
          '<a href="' + escapeHTML(subUrl) + '" target="_blank" rel="noopener" class="file-tree-link file-tree-submodule">' +
            '<span class="file-tree-icon">' + ICON_SUBMODULE + "</span>" +
            "<span>" + name + "</span>" +
            '<span class="file-tree-external">&nearr;</span>' +
          "</a>" +
        "</li>";
      } else if (f.type === "dir") {
        // Carpeta: navegar dentro
        html += '<li class="file-tree-item">' +
          '<span class="file-tree-link" data-nav-path="' + escapeHTML(fullPath) + '" role="button" tabindex="0">' +
            '<span class="file-tree-icon">' + ICON_FOLDER + "</span>" +
            "<span>" + name + "</span>" +
          "</span>" +
        "</li>";
      } else {
        // Archivo: ver contenido
        html += '<li class="file-tree-item">' +
          '<span class="file-tree-link" data-view-file="' + escapeHTML(fullPath) + '" role="button" tabindex="0">' +
            '<span class="file-tree-icon">' + ICON_FILE + "</span>" +
            "<span>" + name + "</span>" +
          "</span>" +
        "</li>";
      }
    });

    html += "</ul>";
    el.innerHTML = html;
  }

  // ===== Visor de archivos =====

  /** Fetch y muestra el contenido de un archivo en el panel derecho. */
  function fetchFileContent(filePath) {
    var cacheKey = "repo_file_" + currentRepoName + "_" + filePath;
    var cached = getCached(cacheKey);

    if (cached) {
      renderFileViewer(cached);
      return;
    }

    // Mostrar loading
    var titleEl = document.getElementById("repo-right-title");
    var contentEl = document.getElementById("repo-right-content");
    var btnEl = document.getElementById("repo-show-readme");
    var fileName = filePath.split("/").pop();

    if (titleEl) titleEl.textContent = fileName;
    if (contentEl) {
      contentEl.innerHTML =
        '<div class="detail-skeleton">' +
          '<div class="skeleton-line skeleton-text"></div>' +
          '<div class="skeleton-line skeleton-text"></div>' +
          '<div class="skeleton-line skeleton-text short"></div>' +
          '<div class="skeleton-line skeleton-text"></div>' +
          '<div class="skeleton-line skeleton-text" style="width:80%"></div>' +
        "</div>";
    }
    if (btnEl) btnEl.hidden = false;

    fetchWithTimeout("https://api.github.com/repos/" + GITHUB_USER + "/" + currentRepoName + "/contents/" + filePath)
      .then(function (res) {
        if (!res.ok) throw new Error("API " + res.status);
        return res.json();
      })
      .then(function (data) {
        setCache(cacheKey, data);
        renderFileViewer(data);
      })
      .catch(function (err) {
        var msg = err.name === "AbortError"
          ? "La petición tardó demasiado. Inténtalo de nuevo."
          : "No se pudo cargar el archivo.";
        if (contentEl) contentEl.innerHTML = '<p class="portfolio-empty">' + msg + '</p>';
      });
  }

  /** Renderiza el contenido de un archivo en el panel derecho. */
  function renderFileViewer(fileData) {
    var titleEl = document.getElementById("repo-right-title");
    var contentEl = document.getElementById("repo-right-content");
    var btnEl = document.getElementById("repo-show-readme");

    if (!contentEl) return;

    var fileName = fileData.name;
    var ext = getExtension(fileName);
    var htmlUrl = fileData.html_url || "";

    if (titleEl) titleEl.textContent = fileName;
    if (btnEl) btnEl.hidden = false;

    // Archivo demasiado grande
    if (fileData.size > CONFIG.MAX_FILE_DISPLAY) {
      contentEl.innerHTML =
        '<div class="file-viewer-info">' +
          "<p>Archivo demasiado grande para previsualizar (" + formatSize(fileData.size) + ").</p>" +
          '<a href="' + escapeHTML(htmlUrl) + '" target="_blank" rel="noopener" class="cta-button">Ver en GitHub</a>' +
        "</div>";
      return;
    }

    // Imagen
    if (IMAGE_EXTENSIONS.indexOf(ext) !== -1 && fileData.download_url) {
      contentEl.innerHTML =
        '<div class="file-viewer-image">' +
          '<img src="' + escapeHTML(fileData.download_url) + '" alt="' + escapeHTML(fileName) + '">' +
        "</div>" +
        '<div class="file-viewer-toolbar">' +
          '<span class="file-viewer-size">' + formatSize(fileData.size) + "</span>" +
          '<a href="' + escapeHTML(htmlUrl) + '" target="_blank" rel="noopener" class="file-viewer-github">Ver en GitHub &nearr;</a>' +
        "</div>";
      return;
    }

    // Archivo binario
    if (BINARY_EXTENSIONS.indexOf(ext) !== -1) {
      contentEl.innerHTML =
        '<div class="file-viewer-info">' +
          "<p>Archivo binario (" + formatSize(fileData.size) + ").</p>" +
          '<a href="' + escapeHTML(htmlUrl) + '" target="_blank" rel="noopener" class="cta-button">Ver en GitHub</a>' +
        "</div>";
      return;
    }

    // Archivo de texto: decodificar base64
    var content = "";
    try {
      var raw = (fileData.content || "").replace(/\n/g, "");
      content = decodeBase64UTF8(raw);
    } catch (e) {
      contentEl.innerHTML =
        '<div class="file-viewer-info">' +
          "<p>No se pudo decodificar el archivo.</p>" +
          '<a href="' + escapeHTML(htmlUrl) + '" target="_blank" rel="noopener" class="cta-button">Ver en GitHub</a>' +
        "</div>";
      return;
    }

    // Números de línea + código
    var lines = content.split("\n");
    var lineNums = "";
    var codeLines = "";
    lines.forEach(function (line, i) {
      lineNums += "<span>" + (i + 1) + "</span>\n";
      codeLines += escapeHTML(line) + "\n";
    });

    contentEl.innerHTML =
      '<div class="file-viewer-toolbar">' +
        '<span class="file-viewer-size">' + formatSize(fileData.size) + " &middot; " + lines.length + " líneas</span>" +
        '<a href="' + escapeHTML(htmlUrl) + '" target="_blank" rel="noopener" class="file-viewer-github">Ver en GitHub &nearr;</a>' +
      "</div>" +
      '<div class="file-viewer">' +
        '<div class="file-viewer-lines" aria-hidden="true">' + lineNums + "</div>" +
        '<pre class="file-viewer-code"><code>' + codeLines + "</code></pre>" +
      "</div>";
  }

  // ===== Fetch del README =====

  /** Fetch del README (HTML renderizado por GitHub). */
  function fetchReadme(repoName) {
    var cacheKey = "repo_readme_" + repoName;
    var cached = getCached(cacheKey);

    if (cached) {
      readmeHTMLCache = cached;
      renderReadme(cached);
      return;
    }

    fetchWithTimeout("https://api.github.com/repos/" + GITHUB_USER + "/" + repoName + "/readme", {
      headers: { Accept: "application/vnd.github.html" }
    })
      .then(function (res) {
        if (!res.ok) throw new Error("API " + res.status);
        return res.text();
      })
      .then(function (html) {
        setCache(cacheKey, html);
        readmeHTMLCache = html;
        renderReadme(html);
      })
      .catch(function () {
        var el = document.getElementById("repo-right-content");
        readmeHTMLCache = '<p class="portfolio-empty">Este repositorio no tiene README.</p>';
        if (el) el.innerHTML = readmeHTMLCache;
      });
  }

  /** Renderiza el README HTML. */
  function renderReadme(html) {
    var el = document.getElementById("repo-right-content");
    if (el) {
      el.innerHTML = html;
      var imgs = el.querySelectorAll("img");
      for (var i = 0; i < imgs.length; i++) {
        imgs[i].setAttribute("loading", "lazy");
      }
    }
  }

  // ===== Fetch paginado de repos =====
  async function fetchRepos() {
    var allRepos = [];
    var page = 1;
    var hasMore = true;

    while (hasMore) {
      var response = await fetchWithTimeout(
        "https://api.github.com/users/" + GITHUB_USER +
        "/repos?sort=updated&per_page=50&page=" + page
      );

      // Detectar rate limit de la API de GitHub
      if (response.status === 403) {
        var remaining = response.headers.get("X-RateLimit-Remaining");
        if (remaining === "0") {
          var resetTime = response.headers.get("X-RateLimit-Reset");
          var resetDate = resetTime ? new Date(parseInt(resetTime, 10) * 1000) : null;
          var msg = "Límite de la API de GitHub alcanzado.";
          if (resetDate) {
            msg += " Se restablece a las " + resetDate.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) + ".";
          }
          throw new Error(msg);
        }
      }

      if (!response.ok) throw new Error("API error: " + response.status);

      var batch = await response.json();
      if (batch.length === 0) {
        hasMore = false;
      } else {
        allRepos = allRepos.concat(batch);
        page++;
      }
    }

    return allRepos;
  }

  // ===== Filtro por tag / lenguaje =====

  var filterBar = document.createElement("div");
  filterBar.className = "portfolio-filter-bar";
  filterBar.setAttribute("aria-live", "polite");
  filterBar.hidden = true;
  gridView.insertBefore(filterBar, gridView.firstChild);

  // ===== Buscador y ordenación =====

  var portfolioControls = document.createElement("div");
  portfolioControls.className = "portfolio-controls";
  portfolioControls.innerHTML =
    '<div class="portfolio-search-wrap">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' +
      '<input type="search" id="portfolio-search" class="portfolio-search" placeholder="Buscar repositorio..." aria-label="Buscar repositorio" />' +
    '</div>' +
    '<select id="portfolio-sort" class="portfolio-sort" aria-label="Ordenar repositorios">' +
      '<option value="updated">Más recientes</option>' +
      '<option value="stars">Más estrellas</option>' +
      '<option value="name">Nombre A-Z</option>' +
    '</select>';
  // Insert before allContainer's heading
  var allHeading = gridView.querySelector(".portfolio-section-title");
  if (allHeading) {
    gridView.insertBefore(portfolioControls, allHeading);
  }

  var searchInput = document.getElementById("portfolio-search");
  var searchTimeout = null;
  if (searchInput) {
    searchInput.addEventListener("input", function () {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(function () {
        var query = searchInput.value.trim().toLowerCase();
        var cards = allContainer.querySelectorAll("[data-repo]");
        cards.forEach(function (card) {
          var repo = repoMap[card.dataset.repo];
          if (!repo) return;
          var name = repo.name.toLowerCase();
          var desc = (repo.description || "").toLowerCase();
          var match = !query || name.indexOf(query) !== -1 || desc.indexOf(query) !== -1;
          card.classList.toggle("search-hidden", !match);
        });
      }, CONFIG.DEBOUNCE_DELAY);
    });
  }

  var sortSelect = document.getElementById("portfolio-sort");
  if (sortSelect) {
    sortSelect.addEventListener("change", function () {
      var criteria = sortSelect.value;
      var cards = Array.from(allContainer.querySelectorAll("[data-repo]"));
      cards.sort(function (a, b) {
        var repoA = repoMap[a.dataset.repo];
        var repoB = repoMap[b.dataset.repo];
        if (!repoA || !repoB) return 0;
        if (criteria === "stars") return (repoB.stargazers_count || 0) - (repoA.stargazers_count || 0);
        if (criteria === "name") return repoA.name.localeCompare(repoB.name);
        return new Date(repoB.updated_at) - new Date(repoA.updated_at);
      });
      cards.forEach(function (card) { allContainer.appendChild(card); });
    });
  }

  function applyFilter(type, value, pushHistory) {
    if (pushHistory === undefined) pushHistory = true;
    activeFilter = { type: type, value: value };
    gridView.classList.add("filter-active");

    var allCards = gridView.querySelectorAll("[data-repo]");
    var visibleCount = 0;

    allCards.forEach(function (card) {
      var repo = repoMap[card.dataset.repo];
      if (!repo) { card.classList.add("filtered-out"); return; }

      var matches = false;
      if (type === "tag") {
        matches = repo.topics && repo.topics.indexOf(value) !== -1;
      } else if (type === "lang") {
        matches = repo.language && repo.language.toLowerCase() === value.toLowerCase();
      }

      if (matches) {
        card.classList.remove("filtered-out");
        visibleCount++;
      } else {
        card.classList.add("filtered-out");
      }
    });

    // Limpiar mensaje vacío previo
    var emptyMsg = document.getElementById("portfolio-filter-empty");
    if (emptyMsg) emptyMsg.remove();

    // Mostrar mensaje si no hay resultados
    if (visibleCount === 0) {
      var emptyEl = document.createElement("p");
      emptyEl.id = "portfolio-filter-empty";
      emptyEl.className = "portfolio-empty";
      emptyEl.style.gridColumn = "1 / -1";
      emptyEl.textContent = "No hay repositorios con este filtro.";
      gridView.appendChild(emptyEl);
    }

    var typeLabel = type === "tag" ? "tag" : "lenguaje";
    var countText = visibleCount + (visibleCount === 1 ? " repositorio" : " repositorios");
    filterBar.innerHTML =
      '<span>Filtrando por ' + typeLabel + ': <strong>' + escapeHTML(value) +
      '</strong> — ' + countText + '</span>' +
      '<button data-clear-filter>&times; Limpiar</button>';
    filterBar.hidden = false;

    if (pushHistory) {
      history.pushState(
        { section: "portfolio", filter: { type: type, value: value } },
        "",
        "#portfolio?" + encodeURIComponent(type) + "=" + encodeURIComponent(value)
      );
    }
  }

  function clearFilter(pushHistory) {
    if (pushHistory === undefined) pushHistory = true;
    activeFilter = null;
    gridView.classList.remove("filter-active");

    var allCards = gridView.querySelectorAll("[data-repo]");
    allCards.forEach(function (card) {
      card.classList.remove("filtered-out");
    });

    filterBar.hidden = true;

    var emptyMsg = document.getElementById("portfolio-filter-empty");
    if (emptyMsg) emptyMsg.remove();

    if (pushHistory) {
      history.pushState({ section: "portfolio" }, "", "#portfolio");
    }
  }

  // ===== Punto de entrada =====
  async function loadPortfolio() {
    showSkeletons(pinnedContainer, 4);
    showSkeletons(allContainer, 6);

    try {
      var cached = getCached(CACHE_KEY);
      if (cached) {
        renderRepos(cached);
      } else {
        var allRepos = await fetchRepos();
        setCache(CACHE_KEY, allRepos);
        renderRepos(allRepos);
      }

      // Deep-link: abrir repo si llegamos con #portfolio/nombre
      if (window.__pendingRepoDetail) {
        var pending = window.__pendingRepoDetail;
        delete window.__pendingRepoDetail;
        if (repoMap[pending]) {
          openRepoDetail(pending, false);
        }
      }

      // Deep-link: aplicar filtro si llegamos con #portfolio?tag=x
      if (window.__pendingPortfolioFilter) {
        var pf = window.__pendingPortfolioFilter;
        delete window.__pendingPortfolioFilter;
        if (pf.tag) {
          applyFilter("tag", pf.tag, false);
        } else if (pf.lang) {
          applyFilter("lang", pf.lang, false);
        }
      }

    } catch (error) {
      var errorMsg = error.name === "AbortError"
        ? "La petición tardó demasiado. Recarga la página para reintentar."
        : error.message || "No se pudieron cargar los repositorios.";
      pinnedContainer.innerHTML =
        '<p class="portfolio-error">' + escapeHTML(errorMsg) + ' ' +
        'Visita <a href="https://github.com/' + GITHUB_USER +
        '" target="_blank" rel="noopener">mi GitHub</a> directamente.</p>';
      allContainer.innerHTML = "";
    }
  }

  // ===== Event delegation =====
  document.addEventListener("click", function (e) {
    // Botón volver al grid
    var backBtn = e.target.closest("[data-repo-back]");
    if (backBtn) {
      e.preventDefault();
      closeRepoDetail();
      return;
    }

    // Botón "volver a README"
    var readmeBtn = e.target.closest("[data-show-readme]");
    if (readmeBtn) {
      e.preventDefault();
      showReadme();
      return;
    }

    // Toggle file browser (mobile collapsible)
    var filesToggle = e.target.closest("[data-files-toggle]");
    if (filesToggle) {
      e.preventDefault();
      var filesContainer = filesToggle.closest(".repo-detail-files");
      if (filesContainer) {
        var isOpen = filesContainer.classList.toggle("files-open");
        filesToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
        filesToggle.querySelector("span").textContent = isOpen ? "Ocultar archivos" : "Ver archivos";
      }
      return;
    }

    // Navegación por carpetas y breadcrumbs
    var navEl = e.target.closest("[data-nav-path]");
    if (navEl && currentRepoName) {
      e.preventDefault();
      navigateToFolder(navEl.dataset.navPath);
      return;
    }

    // Ver archivo
    var fileEl = e.target.closest("[data-view-file]");
    if (fileEl && currentRepoName) {
      e.preventDefault();
      fetchFileContent(fileEl.dataset.viewFile);
      return;
    }

    // Filtrar por tag (click en topic pill)
    var filterTag = e.target.closest("[data-filter-tag]");
    if (filterTag) {
      e.preventDefault();
      applyFilter("tag", filterTag.dataset.filterTag);
      return;
    }

    // Filtrar por lenguaje (click en language badge)
    var filterLang = e.target.closest("[data-filter-lang]");
    if (filterLang) {
      e.preventDefault();
      applyFilter("lang", filterLang.dataset.filterLang);
      return;
    }

    // Limpiar filtro
    var clearBtn = e.target.closest("[data-clear-filter]");
    if (clearBtn) {
      e.preventDefault();
      clearFilter();
      return;
    }

    // Share buttons
    var shareBtn = e.target.closest("[data-share]");
    if (shareBtn) {
      e.preventDefault();
      var shareType = shareBtn.dataset.share;
      var shareUrl = window.location.href;
      var shareTitle = "RRicajos - " + currentRepoName;
      if (shareType === "native" && navigator.share) {
        navigator.share({ title: shareTitle, url: shareUrl });
      } else if (shareType === "twitter") {
        window.open("https://twitter.com/intent/tweet?url=" + encodeURIComponent(shareUrl) + "&text=" + encodeURIComponent(shareTitle), "_blank");
      } else if (shareType === "linkedin") {
        window.open("https://www.linkedin.com/sharing/share-offsite/?url=" + encodeURIComponent(shareUrl), "_blank");
      } else if (shareType === "whatsapp") {
        window.open("https://wa.me/?text=" + encodeURIComponent(shareTitle + " " + shareUrl), "_blank");
      } else if (shareType === "copy") {
        navigator.clipboard.writeText(shareUrl).then(function () {
          shareBtn.setAttribute("aria-label", "Enlace copiado!");
          setTimeout(function () { shareBtn.setAttribute("aria-label", "Copiar enlace"); }, 2000);
        });
      }
      return;
    }

    // Abrir repo desde sección externa (e.g. "Sobre mi")
    var openRepoEl = e.target.closest("[data-open-repo]");
    if (openRepoEl) {
      e.preventDefault();
      openRepoFromExternal(openRepoEl.dataset.openRepo);
      return;
    }

    // Click en card de repo (desde grid)
    var repoCard = e.target.closest("[data-repo]");
    if (repoCard) {
      e.preventDefault();
      openRepoDetail(repoCard.dataset.repo);
    }
  });

  // Keyboard: Enter/Space en elementos interactivos
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Enter" && e.key !== " ") return;

    var target = e.target;

    var repoCard = target.closest("[data-repo]");
    if (repoCard) {
      e.preventDefault();
      openRepoDetail(repoCard.dataset.repo);
      return;
    }

    var navEl = target.closest("[data-nav-path]");
    if (navEl && currentRepoName) {
      e.preventDefault();
      navigateToFolder(navEl.dataset.navPath);
      return;
    }

    var fileEl = target.closest("[data-view-file]");
    if (fileEl && currentRepoName) {
      e.preventDefault();
      fetchFileContent(fileEl.dataset.viewFile);
      return;
    }

    var filterTag = target.closest("[data-filter-tag]");
    if (filterTag) {
      e.preventDefault();
      applyFilter("tag", filterTag.dataset.filterTag);
      return;
    }

    var filterLang = target.closest("[data-filter-lang]");
    if (filterLang) {
      e.preventDefault();
      applyFilter("lang", filterLang.dataset.filterLang);
      return;
    }

    var clearBtn = target.closest("[data-clear-filter]");
    if (clearBtn) {
      e.preventDefault();
      clearFilter();
    }
  });

  // Back / forward del navegador dentro de portfolio (sub-path + filtros)
  window.addEventListener("popstate", function () {
    var hash = window.location.hash.replace("#", "");
    var qIndex = hash.indexOf("?");
    var path = qIndex === -1 ? hash : hash.substring(0, qIndex);
    var queryStr = qIndex === -1 ? "" : hash.substring(qIndex + 1);
    var parts = path.split("/");
    if (parts[0] !== "portfolio") return;

    var subPath = parts[1] || null;

    if (subPath && repoMap[subPath]) {
      if (currentRepoName !== subPath) {
        openRepoDetail(subPath, false);
      }
    } else if (!subPath) {
      if (currentRepoName) {
        closeRepoDetail(false);
      }
      // Restaurar filtro si lo había
      var params = parseQueryString(queryStr);
      if (params.tag) {
        applyFilter("tag", params.tag, false);
      } else if (params.lang) {
        applyFilter("lang", params.lang, false);
      } else if (activeFilter) {
        clearFilter(false);
      }
    }
  });

  loadPortfolio();
})();
