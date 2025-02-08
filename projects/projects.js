import { fetchJSON, renderProjects } from '../global.js';
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

const projects = await fetchJSON('../lib/projects.json');
const projectsContainer = document.querySelector('.projects');  // Get the container element

// Render the projects
renderProjects(projects, projectsContainer, 'h2');

// Update the projects count in the <h1>
const projectCount = projects.length;  // Count the projects
const header = document.querySelector('h1.projects-title');  // Find the <h1> element
header.textContent = ` My Projects (${projectCount})`;  // Update the <h1> to display count

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

// Refactor all plotting into one function
function renderPieChart(projectsGiven) {

  // re-calculate rolled data
  let newRolledData = d3.rollups(
    projectsGiven,
    (v) => v.length,
    (d) => d.year,
  );

  // re-calculate data
  let newData = newRolledData.map(([year, count]) => {
    return { value: count, label: year }; // TODO
  });

  // re-calculate slice generator, arc data, arc, etc.
  let arcGenerator = d3.arc().innerRadius(0).outerRadius(50);
  let newSliceGenerator = d3.pie().value((d) => d.value);
  let newArcData = newSliceGenerator(newData);
  let newArcs = newArcData.map((d) => arcGenerator(d));
  let colors = d3.scaleOrdinal(d3.schemePaired);

  // TODO: clear up paths and legends
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

  // update paths and legends, refer to steps 1.4 and 2.2
  newArcs.forEach((arc, idx) => {
    d3.select('svg')
      .append('path')
      .attr('d', arc)
      .attr('fill', colors(idx)) // Fill in the attribute for fill color via indexing the colors variable
      .on('click', () => {
        selectedIndex = selectedIndex === idx ? -1 : idx;

        newSVG
          .selectAll('path')
          .attr('class', (_, i) => (i === selectedIndex ? 'selected' : ''))
          .attr('stroke', function(_, i) {
            return i === selectedIndex ? d3.select(this).attr('fill') : null;
          }); // Set stroke color to the fill color of the selected path

        legendContainer
          .selectAll('li')
          .attr('class', (_, i) => (i === selectedIndex ? 'selected' : ''));

        // Filter projects based on the selected wedge
        if (selectedIndex === -1) {
          renderProjects(projects, projectsContainer, 'h2');
        } else {
          const selectedYear = newData[selectedIndex].label;
          const filteredProjects = projects.filter(project => project.year === selectedYear);
          renderProjects(filteredProjects, projectsContainer, 'h2');
        }

        applyYearStyles(); // Reapply styles to the year elements
      });
  })

  let legend = d3.select('.legend');
  newData.forEach((d, idx) => {
      legend.append('li')
            .attr('style', `--color:${colors(idx)}`) // set the style attribute while passing in parameters
            .html(`<span class="swatch"></span> ${d.label} <em>(${d.value})</em>`); // set the inner html of <li>
  })
}

// Call this function on page load
renderPieChart(projects);

searchInput.addEventListener('change', (event) => {
  query = event.target.value;
  let filteredProjects = projects.filter((project) => {
    let values = Object.values(project).join('\n').toLowerCase();
    return values.includes(query.toLowerCase());
  });

  // re-render legends and pie chart when event triggers
  renderProjects(filteredProjects, projectsContainer, 'h2');
  applyYearStyles(); // Reapply styles to the year elements
  renderPieChart(filteredProjects);
});