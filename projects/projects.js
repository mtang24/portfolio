import { fetchJSON, renderProjects } from '../global.js';
const projects = await fetchJSON('../lib/projects.json');
const projectsContainer = document.querySelector('.projects');  // Get the container element

// Render the projects
renderProjects(projects, projectsContainer, 'h2');

// Update the projects count in the <h1>
const projectCount = projects.length;  // Count the projects
const header = document.querySelector('h1.projects-title');  // Find the <h1> element
header.textContent = ` My Projects (${projectCount})`;  // Update the <h1> to display count




