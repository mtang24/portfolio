console.log('IT’S ALIVE!');

function $$(selector, context = document) {
  return Array.from(context.querySelectorAll(selector));
}

let pages = [
  { url: '', title: 'Home' },
  { url: 'projects/', title: 'Projects' },
  // add the rest of your pages here
  { url: 'resume/', title: 'Resume' },
  { url: 'contact/', title: 'Contact' },
  { url: 'meta/', title: 'Meta' },
  { url: 'https://github.com/mtang24', title: 'GitHub' },
];

let nav = document.createElement('nav');
document.body.prepend(nav);

for (let p of pages) {
  let url = p.url;
  let title = p.title;

  const ARE_WE_HOME = document.documentElement.classList.contains('home');
  if (!ARE_WE_HOME && !url.startsWith('http')) {
    url = '../' + url;
  }

  // Create link and add it to nav
  let a = document.createElement('a');
  a.href = url;
  a.textContent = title;
  nav.append(a);

  if (a.host === location.host && a.pathname === location.pathname) {
    a.classList.add('current');
  }

  if (a.host != location.host) {
    a.target = "_blank";
  }
}

document.body.insertAdjacentHTML(
  'afterbegin',
  `
	<label class="color-scheme">
    <i class="fas fa-lightbulb"></i> <!-- Icon for the color scheme -->
		<select>
			<!-- TODO add <option> elements here -->
      <option value="light dark">Automatic</option>
      <option value="light">Light</option>
      <option value="dark">Dark</option>
		</select>
	</label>`
);

const select = document.querySelector('select');

if (localStorage.colorScheme) {
  document.documentElement.style.setProperty('color-scheme', localStorage.colorScheme);
  select.value = localStorage.colorScheme; // Sync the dropdown value
}

select.addEventListener('input', function (event) {
  console.log('color scheme changed to', event.target.value);
  document.documentElement.style.setProperty('color-scheme', event.target.value);
  localStorage.colorScheme = event.target.value;
});

// Step 2
// // Use $$ to get all <a> tags inside a <nav>
// let navLinks = $$("nav a");

// let currentLink = navLinks.find(
//   (a) => a.host === location.host && a.pathname === location.pathname
// );

// if (currentLink) {
//   // or if (currentLink !== undefined)
//   currentLink.classList.add('current');
// }

export async function fetchJSON(url) {
  try {
      // Fetch the JSON file from the given URL
      const response = await fetch(url);
      if (!response.ok) {
          throw new Error(`Failed to fetch projects: ${response.statusText}`);
      }
      console.log(response);
      const data = await response.json();
      return data; 
  } catch (error) {
      console.error('Error fetching or parsing JSON data:', error);
  }
}

export function renderProjects(projects, containerElement, headingLevel = 'h2') {
  containerElement.innerHTML = '';

  // Determine base path from window.location.pathname.
  // E.g., if pathname is "/portfolio/", basePath will be "/portfolio"
  const pathParts = window.location.pathname.split('/');
  // Use the first non-empty part (if it exists)
  const basePath = pathParts.length > 1 && pathParts[1] ? `/${pathParts[1]}` : '';

  projects.forEach(project => {
    const article = document.createElement('article');

    let titleHTML = `<h3>${project.title}</h3>`;
    if (project.url) {
      titleHTML = `<h3><a href="${project.url}" target="_blank">${project.title}</a></h3>`;
    }
    
    // Build the full image URL taking into account the base path on GitHub Pages
    const imageSrc = project.image.startsWith('/')
      ? window.location.origin + basePath + project.image
      : project.image;
    
    article.innerHTML = `
      ${titleHTML}
      <img src="${imageSrc}" alt="${project.title}">
      <p>${project.description}</p>
      <p class="project-year">${project.year}</p>
    `;
    
    containerElement.appendChild(article);
  });
}

export async function fetchGitHubData(username) {
  // return statement here
  return fetchJSON(`https://api.github.com/users/${username}`);
}