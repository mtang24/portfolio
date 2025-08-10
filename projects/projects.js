import { fetchJSON, renderProjects } from '../global.js';
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";


const projects = await fetchJSON('../lib/projects.json');
const projectsContainer = document.querySelector('.projects');  // Get the container element

// Get selector buttons from DOM
const legendElem = document.querySelector('.legend');

let filterType = 'language'; // Default to 'language'

// Render the projects
renderProjects(projects, projectsContainer, 'h2');

// Function to apply styles to the year elements
function applyYearStyles() {
  projectsContainer.querySelectorAll('.project-year').forEach(yearElement => {
    yearElement.style.fontFamily = 'Baskerville, serif';
    yearElement.style.fontVariantNumeric = 'oldstyle-nums';
  });
}

// Apply styles to the year elements on initial load
applyYearStyles();

let query = '';
let searchInput = document.querySelector('.searchBar');

let selectedIndex = -1;

// Language color mapping (should match CSS)
const languageColors = {
  'Python': '#3572A5',
  'HTML': '#e34c26',
  'JavaScript': '#f1e05a',
  'CSS': '#563d7c',
  'Java': '#b07219',
  'R': '#198CE7',
  'Snap': '#9147ff',
  'Scratch': '#ffae42',
};

function renderPieChart(projectsGiven) {
  // Group projects by year or language
  let newRolledData;
  let colors;
  if (filterType === 'year') {
    newRolledData = d3.rollups(
      projectsGiven,
      (v) => v.length,
      (d) => d.year,
    );
    colors = d3.scaleOrdinal(d3.schemePaired);
  } else {
    // Flatten all languages and count
    let langCounts = {};
    projectsGiven.forEach(project => {
      project.languages.forEach(lang => {
        langCounts[lang] = (langCounts[lang] || 0) + 1;
      });
    });
    newRolledData = Object.entries(langCounts);
    // Use languageColors for color mapping
    colors = (idx, label) => languageColors[label] || '#bbb';
  }

  // Prepare data for pie chart
  let newData = newRolledData.map(([label, count]) => {
    return { value: count, label: label };
  });

  // re-calculate slice generator, arc data, arc, etc.
  let arcGenerator = d3.arc().innerRadius(0).outerRadius(50);
  let newSliceGenerator = d3.pie().value((d) => d.value);
  let newArcData = newSliceGenerator(newData);
  let newArcs = newArcData.map((d) => arcGenerator(d));

  // Clear up paths and legends
  let newSVG = d3.select('svg'); 
  newSVG.selectAll('path').remove();
  let legendContainer = d3.select('.legend');
  legendContainer.selectAll('li').remove();

  // Check if there are projects to display
  if (projectsGiven.length === 0) {
    legendContainer.classed('hidden', true); // Hide the legend container
    return; // Exit the function if there are no projects to display
  } else {
    legendContainer.classed('hidden', false); // Show the legend container
  }

  // update paths and legends
  newArcs.forEach((arc, idx) => {
    const label = newData[idx].label;
    const fillColor = filterType === 'year' ? colors(idx) : colors(idx, label);
    d3.select('svg')
      .append('path')
      .attr('d', arc)
      .attr('fill', fillColor)
      .on('click', () => {
        selectedIndex = selectedIndex === idx ? -1 : idx;

        newSVG
          .selectAll('path')
          .attr('class', (_, i) => (i === selectedIndex ? 'selected' : ''))
          .attr('stroke', function(_, i) {
            return i === selectedIndex ? d3.select(this).attr('fill') : null;
          });

        legendContainer
          .selectAll('li')
          .attr('class', (_, i) => (i === selectedIndex ? 'selected' : ''));

        // Filter projects based on the selected wedge
        if (selectedIndex === -1) {
          renderProjects(projects, projectsContainer, 'h2');
        } else {
          const selectedLabel = newData[selectedIndex].label;
          let filteredProjects;
          if (filterType === 'year') {
            filteredProjects = projects.filter(project => project.year === selectedLabel);
          } else {
            filteredProjects = projects.filter(project => project.languages.includes(selectedLabel));
          }
          renderProjects(filteredProjects, projectsContainer, 'h2');
        }

        applyYearStyles();
      });
  });

  let legend = d3.select('.legend');
  newData.forEach((d, idx) => {
    const label = d.label;
    const color = filterType === 'year' ? colors(idx) : colors(idx, label);
    legend.append('li')
      .attr('style', `--color:${color}`)
      .html(`<span class="swatch"></span> ${label} <em>(${d.value})</em>`);
  });
}



// Call this function on page load (default: language)
renderPieChart(projects);

// Selector button event listeners
document.getElementById('filter-year').addEventListener('click', () => {
  filterType = 'year';
  document.getElementById('filter-year').classList.add('selected');
  document.getElementById('filter-language').classList.remove('selected');
  selectedIndex = -1;
  renderPieChart(projects);
  renderProjects(projects, projectsContainer, 'h2');
  applyYearStyles();
});

document.getElementById('filter-language').addEventListener('click', () => {
  filterType = 'language';
  document.getElementById('filter-language').classList.add('selected');
  document.getElementById('filter-year').classList.remove('selected');
  selectedIndex = -1;
  renderPieChart(projects);
  renderProjects(projects, projectsContainer, 'h2');
  applyYearStyles();
});

searchInput.addEventListener('change', (event) => {
  query = event.target.value;
  let filteredProjects = projects.filter((project) => {
    let values = Object.values(project).join('\n').toLowerCase();
    return values.includes(query.toLowerCase());
  });

  // re-render legends and pie chart when event triggers
  renderProjects(filteredProjects, projectsContainer, 'h2');
  applyYearStyles();
  renderPieChart(filteredProjects);
});