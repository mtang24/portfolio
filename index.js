import { fetchJSON, renderProjects, fetchGitHubData } from './global.js';
const projects = await fetchJSON('./lib/projects.json');

// List your featured project titles here (update as needed)
const FEATURED_PROJECT_TITLES = [
  "Macronutrient Data Scrollytelling",
  "Visualizing Mice Activity",
  "Power Outage Data Analysis"
];

const featuredProjects = projects.filter(p => FEATURED_PROJECT_TITLES.includes(p.title));

const projectsContainer = document.querySelector('.projects');

renderProjects(featuredProjects, projectsContainer, 'h2');

const githubData = await fetchGitHubData('mtang24');
const profileStats = document.querySelector('#profile-stats');
if (profileStats) {
    profileStats.innerHTML = `
          <dl>
            <dt>Public Repos</dt><dd>${githubData.public_repos}</dd>
            <dt>Public Gists</dt><dd>${githubData.public_gists}</dd>
            <dt>Followers</dt><dd>${githubData.followers}</dd>
            <dt>Following</dt><dd>${githubData.following}</dd>
          </dl>
      `;
  }



