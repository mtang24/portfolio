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

// let data = [1, 2];
// let total = 0;

// for (let d of data) {
//     total += d;
//   }

// let angle = 0;
// let arcData = [];

// for (let d of data) {
//   let endAngle = angle + (d / total) * 2 * Math.PI;
//   arcData.push({ startAngle: angle, endAngle });
//   angle = endAngle;
// }

// let arcs = arcData.map((d) => arcGenerator(d));

let query = '';
let searchInput = document.querySelector('.searchBar');

// searchInput.addEventListener('change', (event) => {
//   // update query value
//   query = event.target.value;
//   // filter projects
//   let filteredProjects = projects.filter((project) => {
//     let values = Object.values(project).join('\n').toLowerCase();
//     return values.includes(query.toLowerCase());
//   });
//   // render filtered projects
//   renderProjects(filteredProjects, projectsContainer, 'h2');
// });

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

  let colors = d3.scaleOrdinal(d3.schemeTableau10);

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
  // let filteredProjects = setQuery(event.target.value);
  // re-render legends and pie chart when event triggers
  renderProjects(filteredProjects, projectsContainer, 'h2');
  applyYearStyles(); // Reapply styles to the year elements
  renderPieChart(filteredProjects);
});

// searchInput.addEventListener('change', (event) => {
//   // update query value
//   query = event.target.value;
//   // filter projects
//   let filteredProjects = projects.filter((project) => {
//     let values = Object.values(project).join('\n').toLowerCase();
//     return values.includes(query.toLowerCase());
//   });

//   // d3 code
//   let arcGenerator = d3.arc().innerRadius(0).outerRadius(50);
//   let arc = arcGenerator({
//       startAngle: 0,
//       endAngle: 2 * Math.PI,
//     });

//   d3.select('svg').append('path').attr('d', arc).attr('fill', 'red');

//   let rolledData = d3.rollups(
//     filteredProjects,
//     (v) => v.length,
//     (d) => d.year,
//   );

//   let data = rolledData.map(([year, count]) => {
//       return { value: count, label: year };
//     });

//   let sliceGenerator = d3.pie().value((d) => d.value);
//   let arcData = sliceGenerator(data);
//   let arcs = arcData.map((d) => arcGenerator(d));
//   let colors = d3.scaleOrdinal(d3.schemeTableau10);

//   arcs.forEach((arc, idx) => {
//       d3.select('svg')
//         .append('path')
//         .attr('d', arc)
//         .attr('fill', colors(idx)) // Fill in the attribute for fill color via indexing the colors variable
//   })

//   let legend = d3.select('.legend');
//   data.forEach((d, idx) => {
//       legend.append('li')
//             .attr('style', `--color:${colors(idx)}`) // set the style attribute while passing in parameters
//             .html(`<span class="swatch"></span> ${d.label} <em>(${d.value})</em>`); // set the inner html of <li>
//   })


//   // render filtered projects
//   renderProjects(filteredProjects, projectsContainer, 'h2');
// });