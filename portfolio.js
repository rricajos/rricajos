// URLs de repositorios de ejemplo
const repoUrls = [
  "https://api.github.com/repos/rricajos/DAM",
  "https://api.github.com/repos/rricajos/DAW",
  "https://api.github.com/repos/rricajos/sierra",
  "https://api.github.com/repos/rricajos/rick-api-junkie",
  "https://api.github.com/repos/rricajos/cafe-bar-castillo",
  "https://api.github.com/repos/torvalds/linux"

];

// Elementos del DOM
const reposContainer = document.getElementById('repos-container');
const selectedLanguagesContainer = document.getElementById('selected-languages-container');
const searchInput = document.getElementById('search-input');

let selectedLanguages = new Set(); // Para mantener un seguimiento de los lenguajes seleccionados

// Función principal que inicia el proceso
async function init() {
  const reposData = await fetchReposData(repoUrls);
  renderRepos(reposData);
  setupSearchListener(reposData);
}

// 1. Obtener datos de los repositorios desde GitHub
async function fetchReposData(urls) {
  const repoDataPromises = urls.map(async url => {
    const response = await fetch(url);
    const repo = await response.json();

    const languagesResponse = await fetch(repo.languages_url);
    const languages = await languagesResponse.json();

    return {
      name: repo.name,
      description: repo.description,
      languages
    };
  });

  return Promise.all(repoDataPromises);
}

// 2. Renderizar las cartas de los repositorios
function renderRepos(repos) {
  reposContainer.innerHTML = '';

  repos.forEach(repo => {
    const card = createRepoCard(repo);
    reposContainer.appendChild(card);
  });
}

// 3. Crear la carta de un repositorio
function createRepoCard(repo) {
  const card = document.createElement('div');
  card.classList.add('repo-card');

  // Título
  const title = document.createElement('h3');
  title.textContent = repo.name;
  card.appendChild(title);

  // Descripción
  const description = document.createElement('p');
  description.textContent = repo.description || 'No description provided.';
  card.appendChild(description);

  // Lenguajes
  const languagesContainer = document.createElement('div');
  languagesContainer.classList.add('languages-container');

  const languageEntries = Object.entries(repo.languages);
  languageEntries.forEach(([language, size]) => {
    const langButton = document.createElement('button');
    
    // Aquí aplicamos la conversión de bytes
    langButton.textContent = `${language} (${formatBytes(size)})`;
    langButton.dataset.language = language;
    langButton.classList.add('language-button');

    // Modificación: al hacer clic en un lenguaje, agregar al contenedor de lenguajes seleccionados
    langButton.addEventListener('click', () => {
      if (!selectedLanguages.has(language)) {
        selectedLanguages.add(language);
        addLanguageToSelected(language);
      }
      filterReposBySelectedLanguages();
    });

    languagesContainer.appendChild(langButton);
  });

  card.appendChild(languagesContainer);

  // Guardamos el lenguaje en el dataset del card para el filtrado
  card.dataset.languages = languageEntries.map(([lang]) => lang).join(',');
  card.dataset.repoName = repo.name.toLowerCase();  // Guardamos el nombre del repo en minúsculas para comparaciones
  return card;
}

// 4. Agregar un lenguaje al contenedor de lenguajes seleccionados
function addLanguageToSelected(language) {
  const languageButton = document.createElement('button');
  languageButton.textContent = language;
  languageButton.classList.add('selected-language');
  languageButton.classList.add('language-button');
  
  // Al hacer clic en un lenguaje seleccionado, se elimina del contenedor y del filtro
  languageButton.addEventListener('click', () => {
    selectedLanguages.delete(language);
    languageButton.remove();
    filterReposBySelectedLanguages();
  });

  selectedLanguagesContainer.appendChild(languageButton);
}

// 5. Filtrar los repositorios por lenguajes seleccionados
function filterReposBySelectedLanguages() {
  const repoCards = document.querySelectorAll('.repo-card');

  repoCards.forEach(card => {
    const repoLanguages = card.dataset.languages.split(',');
    // Mostrar solo los repos que contengan todos los lenguajes seleccionados
    if ([...selectedLanguages].every(lang => repoLanguages.includes(lang))) {
      card.style.display = 'block';
    } else {
      card.style.display = 'none';
    }
  });
}

// 6. Configurar el listener del input para búsqueda
function setupSearchListener(repos) {
  searchInput.addEventListener('input', (event) => {
    const query = event.target.value.toLowerCase();
    filterByRepoName(query);
  });
}

// 7. Filtrar nombres de repositorios
function filterByRepoName(query) {
  const repoCards = document.querySelectorAll('.repo-card');
  
  repoCards.forEach(card => {
    const repoName = card.dataset.repoName;
    if (repoName.includes(query)) {
      card.style.display = 'block';
    } else {
      card.style.display = 'none';
    }
  });
}

// Función auxiliar para convertir bytes a KB, MB, GB, etc.
function formatBytes(bytes) {
  const units = ['bytes', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let value = bytes;

  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }

  return `${Math.max(value.toFixed(2), parseFloat(value.toFixed(0)))} ${units[i]}`;
}

// Iniciar el proceso al cargar la página
init();
