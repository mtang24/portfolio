let data = [];

let xScale;

let yScale;

async function loadData() {
    data = await d3.csv('loc.csv', (row) => ({
      ...row,
      line: Number(row.line), // or just +row.line
      depth: Number(row.depth),
      length: Number(row.length),
      date: new Date(row.date + 'T00:00' + row.timezone),
      datetime: new Date(row.datetime),
    }));
    
    displayStats()
    createScatterplot()
    brushSelector()
  }

document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
});

let commits = [];

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
        // What other options do we need to set?
        // Hint: look up configurable, writable, and enumerable
        configurable: true, // Property can be deleted and attributes can be modified
        writable: false, // Property value cannot be changed
        enumerable: true, // Property will be included in enumerations
      });

      return ret;
    });
}

function displayStats() {
  // Process commits first
  processCommits();

  // Create the stats container
  const statsContainer = d3.select('#stats');

  // Add a header for the stats
  statsContainer.append('h2').text('Summary');
  
  // Create the dl element
  const dl = d3.select('#stats').append('dl').attr('class', 'stats');

  // Add total LOC
  dl.append('dt').html('Total <abbr title="Lines of code">LOC</abbr>');
  dl.append('dd').text(data.length);

  // Add total commits
  dl.append('dt').text('Total commits');
  dl.append('dd').text(commits.length);

  // Add more stats as needed...

  // Add average file length
  const averageFileLength = d3.mean(data, d => d.length);
  dl.append('dt').html('Average <abbr title="Lines of code">LOC</abbr>');
  dl.append('dd').text(averageFileLength.toFixed(2));

  // Add number of files
  const numberOfFiles = d3.rollup(data, v => v.length, d => d.file).size;
  dl.append('dt').text('Number of files');
  dl.append('dd').text(numberOfFiles);

  // Add most active time of day in PST
  const timeOfDay = d3.rollup(data, v => v.length, d => {
    let pstHour = (d.datetime.getUTCHours() - 8 + 24) % 24; // Convert to PST
    let period = pstHour >= 12 ? 'PM' : 'AM';
    pstHour = pstHour % 12 || 12; // Convert to 12-hour format
    return `${pstHour} ${period}`;
  });
  const mostCommonTimeOfDay = Array.from(timeOfDay).reduce((a, b) => a[1] > b[1] ? a : b)[0];
  dl.append('dt').text('Most active time of day (PST)');
  dl.append('dd').text(mostCommonTimeOfDay);

  // Add most active day of the week
  const dayOfWeek = d3.rollup(data, v => v.length, d => d.datetime.getDay());
  const mostCommonDayOfWeek = Array.from(dayOfWeek).reduce((a, b) => a[1] > b[1] ? a : b)[0];
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  dl.append('dt').text('Most active day of week');
  dl.append('dd').text(days[mostCommonDayOfWeek]);
}

// Creating scatterplot
function createScatterplot() {
  const width = 1000;
  const height = 600;

  const svg = d3
    .select('#chart')
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .style('overflow', 'visible');

  // Get the min and max datetime from commits
  const minDate = d3.min(commits, (d) => d.datetime); 
  const maxDate = d3.max(commits, (d) => d.datetime); 

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
    .domain([minDate, maxDate])  // Use the dynamic min and max dates
    .range([usableArea.left, usableArea.right])
    .nice();

  yScale = d3.scaleLinear().domain([0, 24]).range([usableArea.height, usableArea.top]);

  const [minLines, maxLines] = d3.extent(commits, (d) => d.totalLines);

  const rScale = d3
  .scaleSqrt() // Change only this line
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
    .data(commits)
    .join('circle')
    .attr('cx', (d) => xScale(d.datetime))
    .attr('cy', (d) => yScale(d.hourFrac))
    .attr('r', 5)
    .attr('fill', 'steelblue');

  // Create tick values starting from the minDate and going up to maxDate, at 2-day intervals
  const tickValues = [];
  let currentTick = minDate;

  while (currentTick < maxDate) {
    tickValues.push(currentTick);
    currentTick = d3.timeDay.offset(currentTick, 2); // Move by 2 days
  }

  // Ensure maxDate is included as the last tick
  // tickValues.push(maxDate);

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
    })
    .attr('r', (d) => rScale(d.totalLines))
    .style('fill-opacity', 0.7) // Add transparency for overlapping dots;
   
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

let brushSelection = null;

function brushed(event) {
  brushSelection = event.selection;
  updateSelection();
  updateSelectionCount();
  updateLanguageBreakdown();
}

function isCommitSelected(commit) {
  if (!brushSelection) {
    return false;
  }
  // TODO: return true if commit is within brushSelection
  // and false if not
  const min = { x: brushSelection[0][0], 
      y: brushSelection[0][1] }; 
  const max = { x: brushSelection[1][0], 
      y: brushSelection[1][1] }; 
  const x = xScale(commit.date); 
  const y = yScale(commit.hourFrac); 
  return x >= min.x && x <= max.x && y >= min.y && y <= max.y; 
}

function updateSelection() {
  // Update visual state of dots based on selection
  d3.selectAll('circle').classed('selected', (d) => isCommitSelected(d));
}

function updateSelectionCount() {
  const selectedCommits = brushSelection
    ? commits.filter(isCommitSelected)
    : [];

  const countElement = document.getElementById('selection-count');
  countElement.textContent = `${
    selectedCommits.length || 'No'
  } commits selected`;

  return selectedCommits;
}

function updateLanguageBreakdown() {
  const selectedCommits = brushSelection
    ? commits.filter(isCommitSelected)
    : [];
  const container = document.getElementById('language-breakdown');

  if (selectedCommits.length === 0) {
    container.innerHTML = '';
    return;
  }
  const requiredCommits = selectedCommits.length ? selectedCommits : commits;
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