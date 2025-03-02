let data = [];
let commits = [];                   // Will hold processed commits
let xScale, yScale;
let selectedCommits = [];
let filteredCommits = [];
let commitProgress = 100;
const timeSlider = document.getElementById('timeSlider');
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
  filterCommitsByTime();      // Updates filteredCommits based on slider value
  displayStats();
  updateScatterplot(filteredCommits);
  brushSelector();

  // Initialize scrolling:
  NUM_ITEMS = commits.length;                    
  totalHeight = (NUM_ITEMS - VISIBLE_COUNT) * ITEM_HEIGHT; 
  spacer.style('height', `${totalHeight}px`);

  // Ensure some items show up right away
  renderItems(0);
}

// Set up the DOMContentLoaded event so that we load data first
document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  timeSlider.addEventListener('input', updateTimeDisplay);
  
  // Attach the scroll listener after data and commits are initialized.
  scrollContainer.on('scroll', () => {
    const scrollTop = scrollContainer.property('scrollTop');
    let startIndex = Math.floor(scrollTop / ITEM_HEIGHT);
    startIndex = Math.max(0, Math.min(startIndex, commits.length - VISIBLE_COUNT));
    renderItems(startIndex);
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
    .text(filteredCommits.length);

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

function filterCommitsByTime() {
  const minTime = d3.min(commits, d => d.datetime);
  const maxTime = d3.max(commits, d => d.datetime);
  const timeScale = d3.scaleTime().domain([minTime, maxTime]).range([0, 100]);
  let commitMaxTime = timeScale.invert(commitProgress);

  // Update the displayed current slider time.
  const selectedTime = document.getElementById('selectedTime');
  selectedTime.textContent = commitMaxTime.toLocaleString('en-US', {
    dateStyle: 'long',
    timeStyle: 'short'
  });

  // Filter commits based on the slider's max time.
  filteredCommits = commits.filter(commit => commit.datetime <= commitMaxTime);
}

function updateTimeDisplay() {
  commitProgress = Number(timeSlider.value);
  filterCommitsByTime();
  updateScatterplot(filteredCommits);
  
  // Update the displayed current slider time (in filterCommitsByTime)
  // Now update the commit count dynamically
  const commitCountElem = document.getElementById('commit-count');
  if (commitCountElem) {
    commitCountElem.textContent = filteredCommits.length;
  }

  updateFiles();
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
                .each((commit, index) => {
                  console.log('Rendering commit:', commit);
                })
                .html((commit, index) => `
                  <p>
                    On ${commit.datetime.toLocaleString("en", { dateStyle: "full", timeStyle: "short" })}, I made
                    <a href="${commit.url}" target="_blank">
                      ${index > 0 ? 'another glorious commit' : 'my first commit, and it was glorious'}
                    </a>.
                    I edited ${commit.totalLines} lines across ${d3.rollups(commit.lines, D => D.length, d => d.file).length} files.
                    Then I looked over all I had made, and I saw that it was very good.
                  </p>
                `)
                .style('position', 'absolute')
                .style('top', (_, idx) => `${idx * ITEM_HEIGHT}px`);
}


function displayCommitFiles() {
  const lines = filteredCommits.flatMap((d) => d.lines);
  let fileTypeColors = d3.scaleOrdinal(d3.schemeTableau10);
  let files = d3.groups(lines, (d) => d.file).map(([name, lines]) => {
    return { name, lines };
  });
  files = d3.sort(files, (d) => -d.lines.length);
  d3.select('.files').selectAll('div').remove();
  let filesContainer = d3.select('.files').selectAll('div').data(files).enter().append('div');
  filesContainer.append('dt').html(d => `<code>${d.name}</code><small>${d.lines.length} lines</small>`);
  filesContainer.append('dd')
                .selectAll('div')
                .data(d => d.lines)
                .enter()
                .append('div')
                .attr('class', 'line')
                .style('background', d => fileTypeColors(d.type));
}