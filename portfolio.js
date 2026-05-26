// Repos pinneados de rricajos
const pinnedRepos = [
  "https://api.github.com/repos/rricajos/DAM",
  "https://api.github.com/repos/rricajos/outlink",
  "https://api.github.com/repos/rricajos/smm",
  "https://api.github.com/repos/rricajos/languages",
  "https://api.github.com/repos/rricajos/qrsgen",
];

const reposContainer = document.getElementById("repos-container");

async function loadPinnedRepos() {
  try {
    const repos = await Promise.all(
      pinnedRepos.map(async (url) => {
        const response = await fetch(url);
        if (!response.ok) throw new Error("Failed to fetch " + url);
        const repo = await response.json();

        const langResponse = await fetch(repo.languages_url);
        const languages = langResponse.ok ? await langResponse.json() : {};

        return {
          name: repo.name,
          description: repo.description || "Sin descripcion disponible.",
          html_url: repo.html_url,
          homepage: repo.homepage,
          languages: languages,
        };
      })
    );

    renderRepos(repos);
  } catch (error) {
    console.error("Error loading repos:", error);
    reposContainer.innerHTML =
      '<p class="portfolio-error">No se pudieron cargar los repositorios. Visita <a href="https://github.com/rricajos" target="_blank" rel="noopener">mi GitHub</a> directamente.</p>';
  }
}

function renderRepos(repos) {
  reposContainer.innerHTML = "";

  repos.forEach((repo) => {
    const card = document.createElement("a");
    card.href = repo.html_url;
    card.target = "_blank";
    card.rel = "noopener";
    card.classList.add("repo-card");

    const langKeys = Object.keys(repo.languages);
    const langHTML = langKeys
      .map((lang) => '<span class="language-badge">' + lang + "</span>")
      .join("");

    const homepageHTML = repo.homepage
      ? '<span class="repo-homepage">Demo disponible</span>'
      : "";

    card.innerHTML =
      "<h3>" +
      repo.name +
      "</h3>" +
      "<p>" +
      repo.description +
      "</p>" +
      '<div class="repo-meta">' +
      '<div class="repo-languages">' +
      langHTML +
      "</div>" +
      homepageHTML +
      "</div>";

    reposContainer.appendChild(card);
  });
}

loadPinnedRepos();
