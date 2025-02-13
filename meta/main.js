let data = [];

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

  // Define xScale with dynamic minDate and maxDate
  const xScale = d3
    .scaleTime()
    .domain([minDate, maxDate])  // Use the dynamic min and max dates
    .range([usableArea.left, usableArea.right])
    .nice();

  const yScale = d3.scaleLinear().domain([0, 24]).range([usableArea.height, usableArea.top]);

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

  while (currentTick <= maxDate) {
    tickValues.push(currentTick);
    currentTick = d3.timeDay.offset(currentTick, 2); // Move by 2 days
  }

  // Ensure maxDate is included as the last tick
  if (tickValues[tickValues.length - 1] !== maxDate) {
    tickValues.push(maxDate);
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

  // Add gridlines BEFORE the axes
  const gridlines = svg
    .append('g')
    .attr('class', 'gridlines')
    .attr('transform', `translate(${usableArea.left}, 0)`);

  // Create gridlines as an axis with no labels and full-width ticks
  gridlines.call(d3.axisLeft(yScale).tickFormat('').tickSize(-usableArea.width));
}

