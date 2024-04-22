


const languageColors = {
    "java": "rgba(215, 148, 54, 0.25)",
    "kotlin": "rgba(210, 0, 165, 0.25)",
    "javascript": "rgba(213, 192, 0, 0.25)",
    "typescript": "rgba(43, 116, 137, 0.25)",
    "html": "rgba(227, 76, 38, 0.25)",
    "css": "rgba(131, 0, 208, 0.25)",
    "python": "rgba(53, 114, 165, 0.25)",
    "svelte": "rgba(153, 0, 0, 0.25)",
    "swift": "rgba(153, 77, 0, 0.25)"
    // Agregar colores para otros lenguajes...
    // Ejemplo: ruby: '#701516'
};

async function fetchRepositories() {
    try {
        const response = await fetch('https://api.github.com/users/rricajos/repos');
        const repos = await response.json();

        repos.forEach(async repo => {

            if (`${repo.name}` != "rricajos") {

                const repoContainer = document.createElement('div');
                repoContainer.className = 'repo-container';
                repoContainer.dataset.category = determineCategory(repo);

                const repoHeader = document.createElement('div');
                repoHeader.className = 'repo-header';


                const repoName = document.createElement('div');
                repoName.className = 'repo-name';
                repoName.textContent = `${repo.name}`;


                const repoDescription = document.createElement('div');
                repoDescription.className = 'repo-description';
                repoDescription.textContent = `${repo.description}`;

                const repoLanguages = document.createElement('div');
                repoLanguages.className = 'repo-languages';

                const languages = await fetchLanguages(repo.languages_url);
                const totalCode = languages.reduce((sum, lang) => sum + lang.size, 0);
                languages.forEach(language => {
                    const repoLanguage = document.createElement('span');
                    repoLanguage.className = 'repo-language';
                    repoLanguage.style.backgroundColor = languageColors[language.name.toLowerCase()] || '#ddd';
                    repoLanguage.textContent = language.name;
                    repoLanguage.style.width = `${(language.size / totalCode) * 100}%`;
                    repoLanguages.appendChild(repoLanguage);
                });

                const repoLinks = document.createElement('div');
                repoLinks.className = 'repo-links';

                const repoLink = document.createElement('a');
                repoLink.className = 'repo-link';
                repoLink.textContent = '.git';
                repoLink.href = repo.html_url;
                repoLink.target = '_blank';

                repoLinks.appendChild(repoLink);

                if (repo.homepage) {
                    const repoPageLink = document.createElement('a');
                    repoPageLink.className = 'repo-link';
                    repoPageLink.textContent = '.io';
                    repoPageLink.href = repo.homepage;
                    repoPageLink.target = '_blank';

                    repoLinks.appendChild(repoPageLink);
                }

                const imageSrc = await fetchReadmeImage(repo.name);
                if (imageSrc) {
                    repoContainer.style.backgroundImage = `linear-gradient(to right, rgba(0, 0, 0, 0.25), rgba(0, 0, 0, 0.25)), url('${imageSrc}')`;
                    repoContainer.style.textShadow = '2px 2px 4px rgba(0, 0, 0, 0.25)';
                }

                repoHeader.appendChild(repoName);
                repoHeader.appendChild(repoLinks);
                repoContainer.appendChild(repoHeader);
                repoContainer.appendChild(repoDescription);

                repoContainer.appendChild(repoLanguages);
                repoList.appendChild(repoContainer);
            }

        });
    } catch (error) {
        console.error('Error fetching repositories:', error);
    }
}

async function fetchLanguages(languagesUrl) {
    try {
        const response = await fetch(languagesUrl);
        const languagesData = await response.json();
        return Object.keys(languagesData).map(language => ({
            name: language,
            size: languagesData[language]
        }));
    } catch (error) {
        console.error('Error fetching languages:', error);
        return [];
    }
}

async function fetchReadmeImage(repoName) {
    try {
        const response = await fetch(`https://raw.githubusercontent.com/rricajos/${repoName}/main/README.md`);
        const text = await response.text();
        const imageRegex = /!\[.*?\]\((.*?)\)/; // Regular expression to match image URLs in Markdown
        const match = text.match(imageRegex);
        if (match && match[1]) {
            return match[1];
        }
        return null;
    } catch (error) {
        console.error("Error al obtener la imagen del README.md:", error);
        return null;
    }
}


function determineCategory(repo) {
    const hasFrontend = repo.language && ['javascript', 'typescript', 'html', 'css'].includes(repo.language.toLowerCase());
    const hasBackend = repo.language && ['python', 'java', 'php', 'ruby', 'c', 'cplusplus', 'csharp'].includes(repo.language.toLowerCase());
    const hasDatabase = repo.language && ['sql', 'plsql'].includes(repo.language.toLowerCase());
    const hasDevOps = repo.language && ['docker', 'kubernetes', 'jenkins'].includes(repo.language.toLowerCase());
    const hasMobile = repo.language && ['swift', 'java', 'kotlin'].includes(repo.language.toLowerCase());

    if (hasFrontend && hasBackend) {
        return 'fullstack';
    } else if (hasFrontend) {
        return 'frontend';
    } else if (hasBackend) {
        return 'backend';
    } else if (hasDatabase) {
        return 'database';
    } else if (hasDevOps) {
        return 'devops';
    } else if (hasMobile) {
        return 'mobile';
    } else {
        return 'other';
    }
}

function filterByCategory(category) {
    const repoContainers = document.querySelectorAll('.repo-container');
    repoContainers.forEach(container => {
        const repoCategory = container.dataset.category;

        if (category === 'all' || repoCategory === category) {
            container.style.display = 'flex';

        } else {
            container.style.display = 'none';
            console.log(category);
        }
    });
}



const repoList = document.getElementById('repo-list');
const categoryButtons = document.querySelectorAll('.category-button');

categoryButtons.forEach(button => {
    button.addEventListener('click', () => filterByCategory(button.dataset.category));
});

fetchRepositories();