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

  var CACHE_KEY = "rricajos_repos";
  var CACHE_TTL = 10 * 60 * 1000; // 10 min

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

  // Límites para visualización de archivos
  var MAX_FILE_DISPLAY = 512 * 1024; // 512 KB
  var IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "svg", "webp", "ico", "bmp"];
  var BINARY_EXTENSIONS = [
    "pdf", "zip", "tar", "gz", "7z", "rar",
    "exe", "dll", "so", "dylib",
    "woff", "woff2", "ttf", "eot",
    "mp3", "mp4", "avi", "mov", "mkv",
    "class", "jar", "o", "pyc"
  ];

  // ===== Utilidades =====

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
      if (Date.now() - parsed.timestamp < CACHE_TTL) return parsed.data;
    } catch (e) { /* corrupted — ignorar */ }
    return null;
  }

  function setCache(key, data) {
    try {
      sessionStorage.setItem(key, JSON.stringify({ data: data, timestamp: Date.now() }));
    } catch (e) { /* quota exceeded — ignorar */ }
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
      langHTML = '<span class="language-badge">' + escapeHTML(repo.language) + "</span>";
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
        topicsHTML += '<span class="repo-topic">' + escapeHTML(topic) + "</span>";
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
    if (!repo) return;

    currentRepoName = repoName;
    currentPath = [];
    readmeHTMLCache = "";

    gridView.hidden = true;
    detailView.hidden = false;

    // Scroll arriba
    var mainEl = document.querySelector("main");
    var navH = document.querySelector(".supernav").offsetHeight;
    window.scrollTo({ top: mainEl.offsetTop - navH, behavior: "smooth" });

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
      history.pushState({ section: "portfolio" }, "", "#portfolio");
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
      }, 250);
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

    fetch(apiUrl)
      .then(function (res) {
        if (!res.ok) throw new Error("API " + res.status);
        return res.json();
      })
      .then(function (files) {
        setCache(cacheKey, files);
        renderFiles(files);
      })
      .catch(function () {
        if (el) el.innerHTML = '<p class="portfolio-empty">No se pudieron cargar los archivos.</p>';
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

    fetch("https://api.github.com/repos/" + GITHUB_USER + "/" + currentRepoName + "/contents/" + filePath)
      .then(function (res) {
        if (!res.ok) throw new Error("API " + res.status);
        return res.json();
      })
      .then(function (data) {
        setCache(cacheKey, data);
        renderFileViewer(data);
      })
      .catch(function () {
        if (contentEl) contentEl.innerHTML = '<p class="portfolio-empty">No se pudo cargar el archivo.</p>';
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
    if (fileData.size > MAX_FILE_DISPLAY) {
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

    fetch("https://api.github.com/repos/" + GITHUB_USER + "/" + repoName + "/readme", {
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
    if (el) el.innerHTML = html;
  }

  // ===== Fetch paginado de repos =====
  async function fetchRepos() {
    var allRepos = [];
    var page = 1;
    var hasMore = true;

    while (hasMore) {
      var response = await fetch(
        "https://api.github.com/users/" + GITHUB_USER +
        "/repos?sort=updated&per_page=50&page=" + page
      );
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

    } catch (error) {
      console.error("Error loading repos:", error);
      pinnedContainer.innerHTML =
        '<p class="portfolio-error">No se pudieron cargar los repositorios. ' +
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
    }
  });

  // Back / forward del navegador dentro de portfolio (sub-path)
  window.addEventListener("popstate", function () {
    var hash = window.location.hash.replace("#", "");
    var parts = hash.split("/");
    if (parts[0] !== "portfolio") return;

    var subPath = parts[1] || null;
    if (subPath && repoMap[subPath]) {
      if (currentRepoName !== subPath) {
        openRepoDetail(subPath, false);
      }
    } else if (!subPath && currentRepoName) {
      closeRepoDetail(false);
    }
  });

  loadPortfolio();
})();
