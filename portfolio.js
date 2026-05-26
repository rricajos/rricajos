// Portfolio: Destacados (pinned) + Todos los repos
const GITHUB_USER = "rricajos";
const PINNED_NAMES = ["qrsgen", "smm", "outlink", "DAM", "languages"];
const HIDDEN_REPOS = ["rricajos"]; // profile repo

const pinnedContainer = document.getElementById("pinned-container");
const allContainer = document.getElementById("all-repos-container");

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

function createCard(repo, isPinned) {
  var card = document.createElement("a");
  card.href = repo.html_url;
  card.target = "_blank";
  card.rel = "noopener";
  card.classList.add("repo-card", "animate-in");
  if (isPinned) card.classList.add("pinned-card");

  var langHTML = "";
  if (repo.language) {
    langHTML = '<span class="language-badge">' + repo.language + "</span>";
  }

  var homepageHTML = repo.homepage
    ? '<span class="repo-homepage">Demo &rarr;</span>'
    : "";

  var desc = repo.description || "Sin descripcion.";
  if (desc.length > 100) desc = desc.substring(0, 100) + "...";

  card.innerHTML =
    "<h3>" + repo.name + "</h3>" +
    "<p>" + desc + "</p>" +
    '<div class="repo-meta">' +
    '<div class="repo-languages">' + langHTML + "</div>" +
    homepageHTML +
    "</div>";

  return card;
}

async function loadPortfolio() {
  showSkeletons(pinnedContainer, 5);
  showSkeletons(allContainer, 6);

  try {
    // Cargar todos los repos (paginados)
    var allRepos = [];
    var page = 1;
    var hasMore = true;

    while (hasMore) {
      var response = await fetch(
        "https://api.github.com/users/" + GITHUB_USER + "/repos?sort=updated&per_page=50&page=" + page
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

    // Separar pinned y el resto
    var pinned = [];
    var others = [];

    allRepos.forEach(function(repo) {
      if (HIDDEN_REPOS.indexOf(repo.name) !== -1) return;
      if (repo.fork) return;

      if (PINNED_NAMES.indexOf(repo.name) !== -1) {
        pinned.push(repo);
      } else {
        others.push(repo);
      }
    });

    // Ordenar pinned segun el orden definido
    pinned.sort(function(a, b) {
      return PINNED_NAMES.indexOf(a.name) - PINNED_NAMES.indexOf(b.name);
    });

    // Renderizar destacados
    pinnedContainer.innerHTML = "";
    pinned.forEach(function(repo) {
      pinnedContainer.appendChild(createCard(repo, true));
    });

    // Renderizar otros
    allContainer.innerHTML = "";
    if (others.length === 0) {
      allContainer.innerHTML = '<p style="color:#777;">No hay mas repositorios.</p>';
    } else {
      others.forEach(function(repo) {
        allContainer.appendChild(createCard(repo, false));
      });
    }

  } catch (error) {
    console.error("Error loading repos:", error);
    pinnedContainer.innerHTML =
      '<p class="portfolio-error">No se pudieron cargar los repositorios. ' +
      'Visita <a href="https://github.com/' + GITHUB_USER + '" target="_blank" rel="noopener">mi GitHub</a> directamente.</p>';
    allContainer.innerHTML = "";
  }
}

loadPortfolio();
