const username = "rricajos"; // Reemplaza con tu nombre de usuario de GitHub

async function fetchRepos() {
    try {
        const response = await fetch(`https://api.github.com/users/${username}/repos`);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Error al obtener los repositorios:", error);
        return [];
    }
}

async function fetchReadmeImage(repoName) {
    try {
        const response = await fetch(`https://raw.githubusercontent.com/${username}/${repoName}/main/README.md`);
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

async function displayProjects() {
    const projectsContainer = document.getElementById("projects-container");
    if (!projectsContainer) return;

    const repos = await fetchRepos();

    for (const repo of repos) {
        if (repo.name != "rricajos") { // evita mostrar el cv como proyecto
            const projectElement = document.createElement("div");
           
            projectElement.classList.add("project");
    
            const titleElement = document.createElement("h3");
            titleElement.textContent = repo.name;
    
            const descriptionElement = document.createElement("p");
            descriptionElement.textContent = repo.description || "Sin descripción.";
    
            const linkElement = document.createElement("a");
            linkElement.textContent = "。ｇｉｔ";
            linkElement.href = repo.html_url;
            linkElement.target = "_blank";
    
            const imageSrc = await fetchReadmeImage(repo.name);
            if (imageSrc) {
                projectElement.style.backgroundImage = `linear-gradient(to right, rgba(0, 0, 0, 0.8), rgba(0, 0, 0, 0.2)), url('${imageSrc}')`;
            }
    
            projectElement.appendChild(titleElement);
            projectElement.appendChild(descriptionElement);
            projectElement.appendChild(linkElement);
    
            projectsContainer.appendChild(projectElement);
        }
        
    }
}

