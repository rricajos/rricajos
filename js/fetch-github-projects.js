  // JavaScript para cargar los proyectos desde GitHub
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

        async function displayProjects() {
            const projectsContainer = document.getElementById("projects-container");
            if (!projectsContainer) return;

            const repos = await fetchRepos();

            repos.forEach((repo) => {
                const projectElement = document.createElement("div");
                projectElement.classList.add("project");

                const titleElement = document.createElement("h3");
                titleElement.textContent = repo.name;

                const descriptionElement = document.createElement("p");
                descriptionElement.textContent = repo.description || "Sin descripción.";

                const linkElement = document.createElement("a");
                linkElement.textContent = "Ver proyecto en GitHub";
                linkElement.href = repo.html_url;
                linkElement.target = "_blank";

                projectElement.appendChild(titleElement);
                projectElement.appendChild(descriptionElement);
                projectElement.appendChild(linkElement);

                projectsContainer.appendChild(projectElement);
            });
        }
