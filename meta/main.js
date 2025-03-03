let data = [];
let commits = [];                   // Will hold processed commits
let xScale, yScale;
let selectedCommits = [];
let filteredCommits = [];
let lines = filteredCommits.flatMap((d) => d.lines);
let files = [];

// Scrolling parameters—these are later updated based on commits length
let NUM_ITEMS;
let ITEM_HEIGHT = 150;              // Height of one commit item
let VISIBLE_COUNT = 20;             // Number of commits visible at one time
let totalHeight;

// Get scroll-related containers via D3
const scrollContainer = d3.select('#scroll-container');
const spacer = d3.select('#spacer');
const itemsContainer = d3.select('#items-container');

const scrollContainer2 = d3.select('#scroll-container-2');
const spacer2 = d3.select('#spacer-2');
const itemsContainer2 = d3.select('#items-container-2');

// loadData waits for the CSV to be loaded, then processes and sorts commits.
// After processing commits, it initializes the scrolling-related variables.
async function loadData() {
  data = await d3.csv('loc.csv', (row) => ({
    ...row,
    line: Number(row.line),
    depth: Number(row.depth),
    length: Number(row.length),
    date: new Date(row.date + 'T00:00' + row.timezone),
    datetime: new Date(row.datetime),
  }));

  processCommits();           // Processes and sorts commits
  displayStats();
  updateScatterplot(filteredCommits);
  brushSelector();

  // Initialize scrolling:
  NUM_ITEMS = commits.length;                    
  totalHeight = (NUM_ITEMS - VISIBLE_COUNT) * ITEM_HEIGHT; 
  spacer.style('height', `${totalHeight}px`);
  spacer2.style('height', `${totalHeight}px`);

  // Ensure some items show up right away
  renderItems(0);
  renderItems2(0);
}

// Set up the DOMContentLoaded event so that we load data first
document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  
  // Attach the scroll listener after data and commits are initialized.
  scrollContainer.on('scroll', () => {
    const scrollTop = scrollContainer.property('scrollTop');
    let startIndex = Math.floor(scrollTop / ITEM_HEIGHT);
    startIndex = Math.max(0, Math.min(startIndex, commits.length - VISIBLE_COUNT));
    renderItems(startIndex);
  });
  scrollContainer2.on('scroll', () => {
    const scrollTop = scrollContainer2.property('scrollTop');
    let startIndex = Math.floor(scrollTop / ITEM_HEIGHT);
    startIndex = Math.max(0, Math.min(startIndex, commits.length - VISIBLE_COUNT));
    renderItems2(startIndex);
  });
});

// Process the raw data into commits and sort them by datetime (chronologically)
function processCommits() {
  commits = d3
    .groups(data, (d) => d.commit)
    .map(([commit, lines]) => {
      let first = lines[0];
      let { author, date, time, timezone, datetime } = first;
      let ret = {
        id: commit,
        url: 'https://github.com/mtang24/portfolio/commit/' + commit,
        author,
        date,
        time,
        timezone,
        datetime,
        hourFrac: datetime.getHours() + datetime.getMinutes() / 60,
        totalLines: lines.length,
      };
      Object.defineProperty(ret, 'lines', {
        value: lines,
        configurable: true, // Property can be deleted and attributes can be modified
        writable: false, // Property value cannot be changed
        enumerable: true, // Property will be included in enumerations
      });
      return ret;
    });

  // Sort all commits chronologically
  commits.sort((a, b) => a.datetime - b.datetime);
}

function displayStats() {
  const statsContainer = d3.select('#stats');
  statsContainer.html(''); // Clear any existing stats

  // Add a header for the stats
  statsContainer.append('h2').text('Summary');
  
  // Create the dl element
  const dl = d3.select('#stats').append('dl').attr('class', 'stats');

  // Add total LOC
  dl.append('dt').html('Total <abbr title="Lines of code">LOC</abbr>');
  dl.append('dd').text(data.length);

  // Add total commits
  dl.append('dt').text('Total commits');
  dl.append('dd')
    .attr('id', 'commit-count')
    .text(commits.length);

  // Add more stats as needed...

  // Add average file length
  const averageFileLength = d3.mean(data, d => d.length);
  dl.append('dt').html('Average <abbr title="Lines of code">LOC</abbr>');
  dl.append('dd').text(averageFileLength.toFixed(2));


  // Add numberOfFiles
  const numberOfFiles = d3.rollup(data, v => v.length, d => d.file).size;
  dl.append('dt').text('Number of files');
  dl.append('dd').text(numberOfFiles);

  // Calculate the average time of day in PST
  const totalMinutes = d3.sum(data, d => {
    const pstHour = (d.datetime.getUTCHours() - 8 + 24) % 24; // Convert to PST
    return pstHour * 60 + d.datetime.getUTCMinutes();
  });
  const averageMinutes = totalMinutes / data.length;
  const averageHour = Math.floor(averageMinutes / 60);
  const averageMinute = Math.round(averageMinutes % 60);
  const period = averageHour >= 12 ? 'PM' : 'AM';
  const formattedHour = averageHour % 12 || 12; // Convert to 12-hour format

  dl.append('dt').text('Average commit time');
  dl.append('dd').text(`${formattedHour}:${averageMinute.toString().padStart(2, '0')} ${period} PST`);

  // Add most active day of the week
  const dayOfWeek = d3.rollup(data, v => v.length, d => d.datetime.getDay());
  const mostCommonDayOfWeek = Array.from(dayOfWeek).reduce((a, b) => a[1] > b[1] ? a : b)[0];
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  dl.append('dt').text('Most active day of week');
  dl.append('dd').text(days[mostCommonDayOfWeek]);
}

function updateFiles() {
  // Recompute the lines from the current filtered commits
  const allLines = filteredCommits.flatMap(d => d.lines);

  // Group lines by file name
  files = d3
    .groups(allLines, d => d.file)
    .map(([name, lines]) => ({ name, lines }));
  
  // Clear the files container (dl)
  const container = d3.select('.files');
  container.selectAll('*').remove();

  // Create the ordinal scale mapping technology ids to colors
  let fileTypeColors = d3.scaleOrdinal(d3.schemeTableau10);

  files.forEach(file => {
    container.append('dt')
      .html(`<code>${file.name}</code><small>${file.lines.length} lines</small>`);
    
    // Append a <dd> container for the file's line dots
    const dd = container.append('dd');
    
    // For each line, create an empty div with class "line"
    dd.selectAll('div')
      .data(file.lines)
      .enter()
      .append('div')
      .attr('class', 'line')
      .style('background', d => fileTypeColors(d.type));
  });
}

function updateScatterplot(filteredCommits) {
  // Clear the existing SVG
  d3.select('svg').remove();

  const width = 1000;
  const height = 600;

  const svg = d3
    .select('#chart')
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .style('overflow', 'visible');

  const margin = { top: 10, right: 10, bottom: 50, left: 40 };

  const usableArea = {
    top: margin.top,
    right: width - margin.right,
    bottom: height - margin.bottom,
    left: margin.left,
    width: width - margin.left - margin.right,
    height: height - margin.top - margin.bottom,
  };

  // Update xScale with dynamic minDate and maxDate
  xScale = d3
    .scaleTime()
    .domain(d3.extent(filteredCommits, (d) => d.datetime))
    .range([usableArea.left, usableArea.right])
    .nice();

  yScale = d3.scaleLinear().domain([0, 24]).range([usableArea.height, usableArea.top]);

  const [minLines, maxLines] = d3.extent(filteredCommits, (d) => d.totalLines);

  const rScale = d3
    .scaleSqrt()
    .domain([minLines, maxLines])
    .range([2, 30]);

  // Add gridlines BEFORE the axes
  const gridlines = svg
    .append('g')
    .attr('class', 'gridlines')
    .attr('transform', `translate(${usableArea.left}, 0)`);

  // Create gridlines as an axis with no labels and full-width ticks
  gridlines.call(d3.axisLeft(yScale).tickFormat('').tickSize(-usableArea.width));

  const dots = svg.append('g').attr('class', 'dots');

  dots
    .selectAll('circle')
    .data(filteredCommits)
    .join('circle')
    .attr('cx', (d) => xScale(d.datetime))
    .attr('cy', (d) => yScale(d.hourFrac))
    .attr('r', (d) => rScale(d.totalLines))
    .attr('fill', 'steelblue')
    .style('fill-opacity', 0.7); // Add transparency for overlapping dots

  // Create tick values starting from the minDate and going up to maxDate, at 2-day intervals
  const tickValues = [];
  let currentTick = d3.min(filteredCommits, (d) => d.datetime);

  while (currentTick < d3.max(filteredCommits, (d) => d.datetime)) {
    tickValues.push(currentTick);
    currentTick = d3.timeDay.offset(currentTick, 2); // Move by 2 days
  }

  // Set up the x-axis with custom tick values
  const xAxis = d3.axisBottom(xScale)
    .tickValues(tickValues)  // Use the dynamically generated tick values
    .tickFormat(d3.timeFormat('%b %d'));  // Format the tick labels as "Jan 07"

  const yAxis = d3
    .axisLeft(yScale)
    .tickFormat((d) => String(d % 24).padStart(2, '0') + ':00');

  // Add X axis
  svg
    .append('g')
    .attr('transform', `translate(0, ${usableArea.bottom})`)
    .call(xAxis);

  // Add Y axis
  svg
    .append('g')
    .attr('transform', `translate(${usableArea.left}, 0)`)
    .call(yAxis);

  let tooltipTimeout; // Declare timeout variable

  dots.selectAll('circle')
    .on('mouseenter', function (event) {
      const commit = this.__data__; // Get bound commit data
      updateTooltipContent(commit);
      updateTooltipVisibility(true);
      updateTooltipPosition(event);
      d3.select(event.currentTarget).style('fill-opacity', 1); // Full opacity on hover
      d3.select(event.currentTarget).classed('selected', true);

      clearTimeout(tooltipTimeout); // Cancel any pending hide action
    })
    .on('mousemove', (event) => {
      updateTooltipPosition(event);
    })
    .on('mouseleave', (event) => {
      tooltipTimeout = setTimeout(() => {
        updateTooltipVisibility(false); // Hide tooltip entirely in one step
      }, 200); // Short delay to allow movement to the tooltip
      d3.select(event.currentTarget).style('fill-opacity', 0.7); // Restore transparency
      d3.select(event.currentTarget).classed('selected', false);
    });

  // Prevent tooltip from disappearing when hovered over
  const tooltip = document.getElementById('commit-tooltip');
  
  tooltip.addEventListener('mouseenter', () => {
    clearTimeout(tooltipTimeout); // Cancel hiding when user enters tooltip
  });
  
  tooltip.addEventListener('mouseleave', () => {
    updateTooltipVisibility(false); // Hide tooltip when mouse leaves tooltip
  });
}

function updateTooltipContent(commit) {
  const link = document.getElementById('commit-link');
  const date = document.getElementById('commit-date');
  const time = document.getElementById('commit-time');

  if (!commit || !commit.id) {
    link.textContent = '';
    link.removeAttribute('href');
    date.textContent = '';
    time.textContent = '';
    return;
  }

  link.href = commit.url;
  link.textContent = commit.id;
  date.textContent = commit.datetime?.toLocaleString('en', {
    dateStyle: 'full',
  });
  time.textContent = commit.datetime?.toLocaleString('en', {
    timeStyle: 'short',
  });
}

function updateTooltipVisibility(isVisible) {
  const tooltip = document.getElementById('commit-tooltip');
  tooltip.hidden = !isVisible;
}

function updateTooltipPosition(event) {
  const tooltip = document.getElementById('commit-tooltip');
  tooltip.style.left = `${event.clientX + 10}px`; // Offset to avoid cursor overlap
  tooltip.style.top = `${event.clientY + 10}px`; // Offset to avoid cursor overlap
}

function brushSelector() {
  const svg = document.querySelector('svg');
  // Create brush
  d3.select(svg).call(d3.brush());

  // Raise dots and everything after overlay
  d3.select(svg).selectAll('.dots, .overlay ~ *').raise();
  d3.select(svg).call(d3.brush().on('start brush end', brushed));
}

function brushed(evt) {
  let brushSelection = evt.selection;
  selectedCommits = !brushSelection
    ? []
    : filteredCommits.filter((commit) => {
        let min = { x: brushSelection[0][0], y: brushSelection[0][1] };
        let max = { x: brushSelection[1][0], y: brushSelection[1][1] };
        let x = xScale(commit.datetime);
        let y = yScale(commit.hourFrac);

        return x >= min.x && x <= max.x && y <= max.y;
      });
}

function isCommitSelected(commit) {
  return selectedCommits.includes(commit);
}

function updateSelection() {
  // Update visual state of dots based on selection
  d3.selectAll('circle').classed('selected', (d) => isCommitSelected(d));
}

function updateSelectionCount() {
  const selectedCommits = brushSelection
    ? filteredCommits.filter(isCommitSelected)
    : [];

  const countElement = document.getElementById('selection-count');
  countElement.textContent = `${
    selectedCommits.length || 'No'
  } commits selected`;

  return selectedCommits;
}

function updateLanguageBreakdown() {
  const selectedCommits = brushSelection
    ? filteredCommits.filter(isCommitSelected)
    : [];
  const container = document.getElementById('language-breakdown');

  if (selectedCommits.length === 0) {
    container.innerHTML = '';
    return;
  }
  const requiredCommits = selectedCommits.length ? selectedCommits : filteredCommits;
  const lines = requiredCommits.flatMap((d) => d.lines);

  // Use d3.rollup to count lines per language
  const breakdown = d3.rollup(
    lines,
    (v) => v.length,
    (d) => d.type
  );

  // Update DOM with breakdown
  container.innerHTML = '';

  for (const [language, count] of breakdown) {
    const proportion = count / lines.length;
    const formatted = d3.format('.1~%')(proportion);

    container.innerHTML += `
            <dt>${language}</dt>
            <dd>${count} lines (${formatted})</dd>
        `;
  }

  return breakdown;
}

function commitNarrative(commit, index) {
  const narratives = [
    // Remove the initial "One date at …" phrase since the full date is already provided.
    "I made my first commit by creating the index.html file. This commit involved editing 1 line to lay the foundation for the website structure, preparing it for further development.",
    "I made an update to the navigation menu by editing 1 line in the index.html file to better position the elements and ensure they align with the overall design.",
    "I continued refining the navigation menu, editing 14 lines across the index.html file to further improve its layout and design for a more user-friendly experience.",
    "I made a more extensive update to the navigation menu by editing 74 lines in the index.html file. This commit focused on restructuring the menu and improving its overall usability and visual design.",
    "I added the contact form to the project, editing 74 lines across 4 files. This commit involved creating the form structure and ensuring it was properly integrated into the index.html page.",
    "I made minor adjustments to the contact form, editing 41 lines across 2 files to improve its layout, spacing, and overall visual design for better usability.",
    "I cleaned up the code by editing 3 lines across 1 file. This commit involved removing redundant code and optimizing the structure of the form.",
    "I added a new resume page by editing 28 lines across 2 files. This update introduced the page structure and integrated it smoothly into the existing website.",
    "I refined the resume page further by editing 2 lines across 2 files, improving the layout and ensuring visual consistency with other parts of the site.",
    "I made significant updates by editing 132 lines across 6 files. This commit introduced several new sections to the site and enhanced the overall layout and design.",
    "I made minor layout adjustments by editing 5 lines across 2 files to improve the alignment and structure of various elements, ensuring better responsiveness.",
    "I made improvements to the website's layout and design by editing 5 lines across 5 files. This commit addressed a few minor issues to improve functionality and display.",
    "I made a major update by editing 91 lines across 6 files. This commit included adding JavaScript for interactive elements and updating the website theme to improve visual appeal.",
    "I made small refinements to the nav menu placement by editing 3 lines across 2 files to better position the elements for optimal usability.",
    "I updated the site’s layout and functionality by editing 69 lines across 3 files. This commit improved the user experience by enhancing the visual and functional elements of the website.",
    "I continued to improve the site by editing 78 lines across 3 files. This update focused on refining design elements and fixing small usability issues.",
    "I cleaned up the code by editing 53 lines across 2 files, organizing the project structure and fixing small bugs to ensure everything was properly aligned.",
    "I made a large update by editing 206 lines across 5 files. This commit introduced new features and enhancements, including improved interactivity and visual design.",
    "I made further improvements by editing 111 lines across 3 files, enhancing the functionality of the website and adding new interactive features to the existing layout.",
    "I made minor tweaks to the layout by editing 9 lines across 2 files to fine-tune the positioning and spacing of elements, improving overall user experience.",
    "I made another adjustment by editing 91 lines across 3 files to update the layout and fix a few visual inconsistencies across different pages.",
    "I edited 11 lines across 3 files to introduce additional styling changes and align the visual design with the overall theme of the website.",
    "I made a small fix by editing 12 lines across 2 files to resolve text alignment and spacing issues, ensuring a more polished appearance.",
    "I made a quick fix by editing 1 line in 1 file to correct an issue in the footer section, making sure the layout was consistent across the site.",
    "I edited 21 lines across 2 files to enhance the functionality of the contact form, improving its interaction with users and adjusting the layout to match the rest of the site.",
    "I edited 7 lines across 1 file to refine the layout and adjust the presentation of the homepage, improving its alignment and flow for better user navigation.",
    "I made a small edit by changing 1 line across 1 file to fix a bug with one of the navigation links, ensuring proper routing and display.",
    "I updated the homepage layout by editing 13 lines across 1 file, addressing some spacing and alignment issues to improve the user interface.",
    "I made a major update to the site by editing 130 lines across 2 files, adding new interactive elements and improving the overall structure of the site for better performance.",
    "I edited 139 lines across 4 files to improve the layout and design of several pages, enhancing the consistency and visual appeal of the site.",
    "I edited 7 lines across 2 files to fix minor layout issues, ensuring proper display and alignment of content across different devices.",
    "I made the final update for the day by editing 94 lines across 3 files, polishing the design, finalizing the layout, and ensuring a smooth, responsive user experience."
  ];
  
  if (index < narratives.length) {
    return narratives[index];
  }
  
  // Fallback: calculate unique file count from commit.lines
  const fileCount = Array.from(new Set(commit.lines.map(line => line.file))).length;
  return `For this recent commit, I edited ${commit.totalLines} lines across ${fileCount} file${fileCount === 1 ? '' : 's'}.`;
}

function commitNarrative2(commit, index) {
  const narratives = [
    "I edited 1 line to create the index.html file, laying the foundation for the website structure, preparing it for further development.",
    "I edited 1 line in the index.html file to update the navigation menu, improving its positioning and alignment with the overall design.",
    "I edited 14 lines in the index.html file to refine the navigation menu further, enhancing its layout and design for a better user experience.",
    "I edited 74 lines in the index.html file to make a more extensive update to the navigation menu, restructuring it for improved usability and visual appeal.",
    "I edited 74 lines across 4 files to add the contact form to the project, including its structure and integration into the index.html page.",
    "I edited 41 lines across 2 files to make minor adjustments to the contact form, enhancing its layout, spacing, and overall visual design for better usability.",
    "I edited 3 lines across 1 file to clean up the code, removing redundancies and optimizing the structure of the contact form.",
    "I edited 28 lines across 2 files to add a new resume page, introducing the page structure and integrating it into the existing website layout.",
    "I edited 2 lines across 2 files to refine the resume page, improving its layout and ensuring visual consistency with other parts of the site.",
    "I edited 132 lines across 6 files to make significant updates, introducing new sections to the site and enhancing the overall layout and design.",
    "I edited 5 lines across 2 files to make minor layout adjustments, improving the alignment and structure of various elements for better responsiveness.",
    "I edited 5 lines across 5 files to improve the website's layout and design, addressing minor issues to enhance functionality and display.",
    "I edited 91 lines across 6 files to make a major update, adding JavaScript for interactive elements and updating the website theme for better visual appeal.",
    "I edited 3 lines across 2 files to make small refinements to the nav menu placement, ensuring the elements are better positioned for optimal usability.",
    "I edited 69 lines across 3 files to update the site’s layout and functionality, improving the user experience by enhancing both visual and functional elements.",
    "I edited 78 lines across 3 files to further improve the site, refining design elements and fixing small usability issues.",
    "I edited 53 lines across 2 files to clean up the code, organizing the project structure and fixing small bugs for better alignment.",
    "I edited 206 lines across 5 files to make a large update, introducing new features and enhancements including improved interactivity and visual design.",
    "I edited 111 lines across 3 files to make further improvements, enhancing the site’s functionality and adding new interactive features.",
    "I edited 9 lines across 2 files to make minor tweaks to the layout, fine-tuning the positioning and spacing of elements for a better user experience.",
    "I edited 91 lines across 3 files to update the layout, addressing visual inconsistencies and ensuring better consistency across pages.",
    "I edited 11 lines across 3 files to introduce additional styling changes, aligning the visual design with the overall theme of the website.",
    "I edited 12 lines across 2 files to make a small fix, resolving text alignment and spacing issues for a more polished appearance.",
    "I edited 1 line across 1 file to fix an issue in the footer section, ensuring consistent layout across the site.",
    "I edited 21 lines across 2 files to enhance the contact form's functionality, improving interaction with users and adjusting the layout to match the rest of the site.",
    "I edited 7 lines across 1 file to refine the layout of the homepage, adjusting its presentation for better user navigation.",
    "I edited 1 line across 1 file to fix a bug with one of the navigation links, ensuring proper routing and display.",
    "I edited 13 lines across 1 file to update the homepage layout, addressing spacing and alignment issues to improve the user interface.",
    "I edited 130 lines across 2 files to make a major update, adding new interactive elements and improving the overall structure for better performance.",
    "I edited 139 lines across 4 files to improve the layout and design, enhancing the consistency and visual appeal of several pages.",
    "I edited 7 lines across 2 files to fix minor layout issues, ensuring proper display and alignment of content across different devices.",
    "I edited 94 lines across 3 files to make the final update for the day, polishing the design, finalizing the layout, and ensuring a smooth, responsive user experience."
  ];

  if (index < narratives.length) {
    return narratives[index];
  }

  // Fallback: calculate unique file count from commit.lines
  const fileCount = Array.from(new Set(commit.lines.map(line => line.file))).length;
  return `For this recent commit, I edited ${commit.totalLines} lines across ${fileCount} file${fileCount === 1 ? '' : 's'}.`;
}

function renderItems(startIndex) {
  // Clear things off
  itemsContainer.selectAll('div').remove();
  const endIndex = Math.min(startIndex + VISIBLE_COUNT, commits.length);
  let newCommitSlice = commits.slice(startIndex, endIndex);
  // Update the scatterplot
  updateScatterplot(newCommitSlice);
  // Re-bind the commit data to the container and represent each using a div
  itemsContainer.selectAll('div')
  .data(newCommitSlice)
  .enter()
  .append('div')
  .html((commit, index) => `
    <p>
      On <a href="${commit.url}" target="_blank">${commit.datetime.toLocaleString("en", { dateStyle: "full", timeStyle: "short" })}</a>,
      ${commitNarrative(commit, index)}
    </p>
  `)
  .style('position', 'absolute')
  .style('top', (_, idx) => `${idx * ITEM_HEIGHT}px`);
}

function renderItems2(startIndex) {
  // Clear things off
  itemsContainer2.selectAll('div').remove();
  const endIndex = Math.min(startIndex + VISIBLE_COUNT, commits.length);
  let newCommitSlice = commits.slice(startIndex, endIndex);

  // Render file size info in the dot plot container (#chart-2)
  displayCommitFiles(newCommitSlice, '#chart-2');
  
  // Render commit items into the scrolly container 2 as before
  itemsContainer2.selectAll('div')
  .data(newCommitSlice)
  .enter()
  .append('div')
  .html((commit, index) => `
    <p>
      On <a href="${commit.url}" target="_blank">${commit.datetime.toLocaleString("en", { dateStyle: "full", timeStyle: "short" })}</a>,
      ${commitNarrative2(commit, index)}
    </p>
  `)
  .style('position', 'absolute')
  .style('top', (_, idx) => `${idx * ITEM_HEIGHT}px`);
}

// Update file display based on the current commit slice
function displayCommitFiles(commitSlice, containerSelector = '.files') {
  // Combine all lines from your entire data set or ensure a fixed domain
  const types = Array.from(new Set(data.map(d => d.type))).sort();
  const fileTypeColors = d3.scaleOrdinal()
                           .domain(types)
                           .range(d3.schemeTableau10);

  const lines = commitSlice.flatMap(d => d.lines);
  let files = d3.groups(lines, d => d.file)
                .map(([name, lines]) => ({ name, lines }));
  files = d3.sort(files, (a, b) => b.lines.length - a.lines.length);

  // Remove existing content in the container
  d3.select(containerSelector).selectAll('div').remove();

  let filesContainer = d3.select(containerSelector)
                         .selectAll('div')
                         .data(files)
                         .enter()
                         .append('div')
                         .style('display', 'block')
                         .style('margin-bottom', '1em');

  filesContainer.append('dt')
                .html(d => `<code>${d.name}</code><br><small>${d.lines.length} lines</small>`);

  filesContainer.append('dd')
                .style('display', 'flex')
                .style('flex-wrap', 'wrap')
                .selectAll('div')
                .data(d => d.lines)
                .enter()
                .append('div')
                .attr('class', 'line')
                .style('background', d => fileTypeColors(d.type));
}