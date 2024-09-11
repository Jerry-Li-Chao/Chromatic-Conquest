let points = [];
let delaunay, voronoi;
let frameCount = 0;
const maxFrames = 50; // Adjust this to control when stabilization occurs
const cellCount = 500;
const numFactions = 8;
const populationChangeInterval = 1000;
const actionMinInterval = 3000;
const actionMaxInterval = 5000;
let animationSpeed = 0.01;
let showPopulationTransfers = false;
let showCellPopulation = false;
const cellPopulationLimit = 300;
const newFactionBonus = 300;
const minCellGrowth = 3;
const maxCellGrowth = 5;
const allowMutations = false;

let cells = [];
let factions = [];
let isStabilized = false;
let lastGrowthTime = 0;
let populationTransfers = [];
let colorTransitions = [];
let lastUpdateTime = 0;
const updateInterval = 128; // ms

const barHeight = 20;
const barMargin = 10;

let isMouseDragging = false;
let newFactionColor = null;
let cellsToConvert = new Set();

let viewMode = "faction"; // 'faction' or 'population' -> (density view)
let minPopulation, maxPopulation;
const MIN_POPULATION_RANGE = 1; // Minimum range to prevent division by zero

// Button and Slider variables
let viewMovementButton;
let viewPopulationButton;
let densityViewButton;
let animationSpeedSlider;
let animationSpeedLabel;

function toggleMovement() {
  showPopulationTransfers = !showPopulationTransfers;
}

function togglePopulation() {
  showCellPopulation = !showCellPopulation;
}

function toggleDensityView() {
  viewMode = viewMode === "faction" ? "population" : "faction";
}

function updateAnimationSpeed() {
  animationSpeed = animationSpeedSlider.value();
  animationSpeedLabel.html("Time step: " + animationSpeed.toFixed(2));
}

// Add this function to calculate grayscale color based on population
function getPopulationColor(population, currentColor) {
  let normalizedPopulation;
  if (maxPopulation === minPopulation) {
    normalizedPopulation = 0.5; // If all populations are the same, use middle gray
  } else {
    normalizedPopulation =
      (population - minPopulation) / (cellPopulationLimit - minPopulation);
  }

  // Ensure normalizedPopulation is between 0 and 1
  normalizedPopulation = constrain(normalizedPopulation, 0, 1);

  let colorValue = 255 - Math.floor(normalizedPopulation * 200);
  return color(colorValue);
}

function setup() {
  createCanvas(windowWidth * 0.99, windowHeight * 0.99);

  // Create initial points
  for (let i = 0; i < cellCount; i++) {
    let x = random(width);
    let y = random(height);
    points[i] = createVector(x, y);
  }

  updateVoronoi();

  // Create buttons
  viewMovementButton = createButton("View movement");
  viewMovementButton.position(10, height - 40);
  viewMovementButton.mousePressed(toggleMovement);

  viewPopulationButton = createButton("View population");
  viewPopulationButton.position(130, height - 40);
  viewPopulationButton.mousePressed(togglePopulation);

  densityViewButton = createButton("Density View");
  densityViewButton.position(250, height - 40);
  densityViewButton.mousePressed(toggleDensityView);

  animationSpeedSlider = createSlider(0.01, 1, 0.01, 0.01);
  animationSpeedSlider.position(10, height - 70);
  animationSpeedSlider.style("width", "200px");
  animationSpeedSlider.input(updateAnimationSpeed);

  animationSpeedLabel = createP("Time step: 0.01");
  animationSpeedLabel.position(220, height - 85);
}

function draw() {
  background(255);

  if (!isStabilized) {
    if (frameCount >= maxFrames) {
      stabilizePattern();
    } else {
      // Draw unstabilized Voronoi
      drawUnstabilizedVoronoi();

      // Move points towards centroids
      movePointsToCentroids();

      updateVoronoi();
      frameCount++;
    }
  } else {
    // Update min and max population values
    updatePopulationRange();

    // Draw stabilized Voronoi with factions
    drawStabilizedVoronoi();

    // Grow population every second
    if (millis() - lastGrowthTime > populationChangeInterval * animationSpeed) {
      growPopulation();
      lastGrowthTime = millis();
    }

    // Perform actions for each cell
    for (let cell of cells) {
      cell.checkAndPerformAction();
    }

    // Update and draw population transfers
    updatePopulationTransfers();
    updateColorTransitions();

    // Draw faction proportion bar
    drawFactionProportionBar();

    // Handle mouse dragging and highlight
    if (isMouseDragging) {
      handleMouseDrag();
      drawHighlight();
    }
  }
}

/// Update the updatePopulationRange function
function updatePopulationRange() {
  minPopulation = Infinity;
  maxPopulation = -Infinity;
  for (let cell of cells) {
    minPopulation = Math.min(minPopulation, cell.population);
    maxPopulation = Math.max(maxPopulation, cell.population);
  }

  // Ensure there's always a minimum range
  if (maxPopulation - minPopulation < MIN_POPULATION_RANGE) {
    maxPopulation = minPopulation + MIN_POPULATION_RANGE;
  }
}

function drawFactionProportionBar() {
  let totalCells = cells.length;
  let barWidth = width - 2 * barMargin;
  let x = barMargin;
  let y = 0 + barHeight;

  // Draw background
  fill(200);
  noStroke();
  rect(x, y, barWidth, barHeight);

  // Check if it's time to update positions
  let currentTime = millis();
  let shouldUpdatePositions = currentTime - lastUpdateTime >= updateInterval;

  if (shouldUpdatePositions) {
    lastUpdateTime = currentTime;
  }

  // Calculate and draw proportions for each faction
  for (let i = 0; i < factions.length; i++) {
    let faction = factions[i];
    let proportion = faction.cells.length / totalCells;
    let sectionWidth = proportion * barWidth;

    if (sectionWidth > 0) {
      fill(faction.color);
      rect(x, y, sectionWidth, barHeight);

      // Draw label only if the proportion is greater than 0
      if (proportion > 0) {
        let percentage = Math.round(proportion * 100);
        let labelX = x + sectionWidth / 2;
        let labelY = y + barHeight / 2;

        // Update persisted positions if it's time
        if (shouldUpdatePositions) {
          if (!faction.persistedInfo) {
            faction.persistedInfo = {};
          }
          faction.persistedInfo.x = labelX;
          faction.persistedInfo.y = labelY;
          faction.persistedInfo.percentage = percentage;
        }

        textAlign(CENTER, CENTER);
        textSize(12);

        // Choose text color based on background brightness
        let brightness =
          (red(faction.color) * 299 +
            green(faction.color) * 587 +
            blue(faction.color) * 114) /
          1000;
        fill(brightness > 128 ? 0 : 255);

        // Only draw label if there's enough space and we have persisted positions
        if (
          sectionWidth > textWidth(percentage + "%") + 4 &&
          faction.persistedInfo
        ) {
          text(
            faction.persistedInfo.percentage + "%",
            faction.persistedInfo.x,
            faction.persistedInfo.y
          );
        }
      }

      x += sectionWidth;
    }
  }

  // Draw border
  noFill();
  stroke(0);
  strokeWeight(2);
  rect(barMargin, y, barWidth, barHeight);
}

function drawUnstabilizedVoronoi() {
  stroke(0);
  strokeWeight(2);
  noFill();

  let polygons = Array.from(voronoi.cellPolygons());
  for (let poly of polygons) {
    beginShape();
    for (let i = 0; i < poly.length; i++) {
      vertex(poly[i][0], poly[i][1]);
    }
    endShape(CLOSE);
  }
}

function movePointsToCentroids() {
  let polygons = Array.from(voronoi.cellPolygons());
  for (let i = 0; i < points.length; i++) {
    let centroid = calculateCentroid(polygons[i]);
    points[i].lerp(centroid, 0.1);
  }
}

function stabilizePattern() {
  isStabilized = true;

  // Create cells
  let polygons = Array.from(voronoi.cellPolygons());
  for (let i = 0; i < polygons.length; i++) {
    cells.push(new Cell(polygons[i], i));
  }

  // Find neighbors for each cell
  findNeighbors();

  // Create factions with neighboring cells
  createFactionsWithNeighboringCells();

  console.log("Pattern stabilized. Cells and Factions initialized.");
}

function findNeighbors() {
  for (let i = 0; i < cells.length; i++) {
    for (let j = i + 1; j < cells.length; j++) {
      if (areNeighbors(cells[i], cells[j])) {
        cells[i].neighbors.push(cells[j]);
        cells[j].neighbors.push(cells[i]);
      }
    }
  }
}

function areNeighbors(cell1, cell2) {
  // Two cells are neighbors if they share at least one vertex
  for (let vertex1 of cell1.polygon) {
    for (let vertex2 of cell2.polygon) {
      if (
        Math.abs(vertex1[0] - vertex2[0]) < 0.01 &&
        Math.abs(vertex1[1] - vertex2[1]) < 0.01
      ) {
        return true;
      }
    }
  }
  return false;
}

function createFactionsWithNeighboringCells() {
  let unassignedCells = [...cells];

  // Generate distinct colors for factions
  let factionColors = generateDistinctColors(numFactions);

  while (unassignedCells.length > 0 && factions.length < numFactions) {
    let startCell = random(unassignedCells);
    let faction = new Faction(factionColors[factions.length]);
    let factionCells = [startCell];
    let candidates = [...startCell.neighbors];

    while (factionCells.length < 5 && candidates.length > 0) {
      let nextCell = random(candidates);
      factionCells.push(nextCell);
      candidates = candidates.filter(
        (c) => c !== nextCell && !factionCells.includes(c)
      );
      candidates.push(
        ...nextCell.neighbors.filter(
          (c) => !factionCells.includes(c) && !candidates.includes(c)
        )
      );
    }

    if (factionCells.length >= 3) {
      for (let cell of factionCells) {
        faction.addCell(cell);
        unassignedCells = unassignedCells.filter((c) => c !== cell);
      }
      factions.push(faction);
    }
  }

  // Assign any remaining cells to random existing factions
  for (let cell of unassignedCells) {
    random(factions).addCell(cell);
  }
}

function generateDistinctColors(numColors) {
  let colors = [];
  let hueStep = 360 / numColors;

  // Add randomness to the first hue
  let randomHueOffset = random(0, 360); // Random offset between 0 and 360 degrees

  for (let i = 0; i < numColors; i++) {
    // Apply the random offset only to the first color
    let hue = (i * hueStep + randomHueOffset) % 360;
    let saturation = 70 + random(-10, 10); // 60-80% saturation
    let lightness = 70 + random(-10, 10); // 60-80% lightness

    // Convert HSL to RGB
    let rgb = hslToRgb(hue, saturation, lightness);
    colors.push(color(rgb[0], rgb[1], rgb[2]));
  }

  // Shuffle the colors to avoid predictable order
  shuffle(colors, true);

  return colors;
}

function hslToRgb(h, s, l) {
  h /= 360;
  s /= 100;
  l /= 100;
  let r, g, b;

  if (s === 0) {
    r = g = b = l; // achromatic
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function drawStabilizedVoronoi() {
  // Draw all factions
  for (let faction of factions) {
    faction.draw();
  }

  // Draw cell borders
  stroke(0);
  strokeWeight(2);
  for (let cell of cells) {
    noFill();
    cell.draw();
  }
}

function updateVoronoi() {
  delaunay = calculateDelaunay(points);
  voronoi = delaunay.voronoi([0, 0, width, height]);
}

function calculateDelaunay(points) {
  let pointsArray = [];
  for (let v of points) {
    pointsArray.push(v.x, v.y);
  }
  return new d3.Delaunay(pointsArray);
}

function calculateCentroid(poly) {
  let area = 0;
  let centroid = createVector(0, 0);
  for (let i = 0; i < poly.length; i++) {
    let v0 = poly[i];
    let v1 = poly[(i + 1) % poly.length];
    let crossValue = v0[0] * v1[1] - v1[0] * v0[1];
    area += crossValue;
    centroid.x += (v0[0] + v1[0]) * crossValue;
    centroid.y += (v0[1] + v1[1]) * crossValue;
  }
  area /= 2;
  centroid.div(6 * area);
  return centroid;
}

function growPopulation() {
  for (let cell of cells) {
    cell.growPopulation();
  }
  for (let faction of factions) {
    faction.updatePopulation();
  }
}

function performCellActions() {
  for (let cell of cells) {
    cell.performAction();
  }
}

function updatePopulationTransfers() {
  for (let i = populationTransfers.length - 1; i >= 0; i--) {
    if (!populationTransfers[i].isUpdated) {
      populationTransfers[i].update();
    }
    if (showPopulationTransfers) {
      populationTransfers[i].draw();
    }
    populationTransfers[i].update();
    if (populationTransfers[i].isDone()) {
      populationTransfers.splice(i, 1);
    }
  }
}

function updateColorTransitions() {
  for (let i = colorTransitions.length - 1; i >= 0; i--) {
    colorTransitions[i].update();
    if (colorTransitions[i].isDone()) {
      colorTransitions.splice(i, 1);
    }
  }
}

class Cell {
  constructor(polygon, id) {
    this.polygon = polygon;
    this.id = id;
    this.centroid = calculateCentroid(polygon);
    this.faction = null;
    this.neighbors = [];
    this.population = floor(random(5, 10));
    this.currentColor = null;
    this.lastActionTime = millis();
    this.nextActionTime = this.calculateNextActionTime();
    this.minCellGrowthRate = random(minCellGrowth - 2, minCellGrowth);
    this.maxCellGrowthRate = random(maxCellGrowth - 10, maxCellGrowth);
    this.minAttack = random(0.25, 0.45);
    this.maxAttack = random(0.7, 0.9);
    this.minGive = random(0.05, 0.1);
    this.maxGive = random(0.15, 0.3);
    this.populationLimit = cellPopulationLimit + random(-20, 20) * 10; // Range: 100 - 500
  }

  calculateNextActionTime() {
    return (
      this.lastActionTime +
      random(actionMinInterval, actionMaxInterval) * animationSpeed
    );
  }

  draw() {
    if (viewMode === "faction") {
      fill(this.currentColor || this.faction.color);
    } else if (viewMode === "population") {
      fill(getPopulationColor(this.population, this.currentColor));
    }

    beginShape();
    for (let i = 0; i < this.polygon.length; i++) {
      vertex(this.polygon[i][0], this.polygon[i][1]);
    }
    endShape(CLOSE);

    if (showCellPopulation) {
      push();
      fill(0);
      noStroke();
      textAlign(CENTER, CENTER);
      textSize(12);
      text(floor(this.population), this.centroid.x, this.centroid.y);
      pop();
    }
  }

  growPopulation() {
    if (this.population < this.populationLimit) {
      // scale the growth rate based on the current population against max cell population
      this.population += lerp(
        // linear interpolation
        this.minCellGrowthRate,
        this.maxCellGrowthRate,
        this.population / maxPopulation
      );
    }
  }

  checkAndPerformAction() {
    if (millis() >= this.nextActionTime) {
      this.performAction();
      this.lastActionTime = millis();
      this.nextActionTime = this.calculateNextActionTime();
    }
  }

  performAction() {
    // Grow population naturally if under cellPopulationLimit
    if (this.population < cellPopulationLimit) {
      this.growPopulation();
    }

    let friendlyNeighbors = this.neighbors.filter(
      (n) => n.faction === this.faction
    );
    // All enemy neighbors
    if (friendlyNeighbors.length === 0) {
      // 25% attack, 75% do nothing
      if (random() > 0.75) {
        this.attackNeighbor();
        return;
      } else {
        return;
      }
    } else {
      // some enemy some friendly
      let enemyNeighbors = this.neighbors.filter(
        (n) => n.faction !== this.faction
      );
      if (enemyNeighbors.length > 0) {
        // 25% attack, 75% do nothing
        if (random() > 0.75) {
          this.attackNeighbor();
          return;
        } else {
          // 1% chance to mutate and change faction
          if (random() < 0.001 && allowMutations) {
            newFactionColor = generateDistinctColors(1)[0];
            createNewFaction([this], cellPopulationLimit);
            return;
          }
          return;
        }
      } else {
        // or all friendly
        // if all friendly neighbors exceed the population limit, do nothing
        if (
          friendlyNeighbors.every((n) => n.population >= cellPopulationLimit)
        ) {
          return;
        } else {
          if (random() < 0.001 && allowMutations) {
            newFactionColor = generateDistinctColors(1)[0];
            // create new faction with this cell and all friendly neighbors
            createNewFaction([this, ...friendlyNeighbors], cellPopulationLimit);
            return;
          }
          // 25% give, 75% do nothing
          if (random() > 0.75) {
            this.givePopulation();
            return;
          } else {
            return;
          }
        }
      }
    }
  }

  givePopulation() {
    let friendlyNeighbors = this.neighbors.filter(
      (n) => n.faction === this.faction
    );
    if (friendlyNeighbors.length > 0) {
      // prioritize neighbors with lower population
      let recipient = friendlyNeighbors.reduce((a, b) =>
        a.population < b.population ? a : b
      );
      let amount =
        lerp(this.minGive, this.maxGive, this.population / maxPopulation) *
        this.population;
      this.population -= amount;

      // Create a new population transfer animation
      populationTransfers.push(
        new PopulationTransfer(
          this.centroid,
          recipient.centroid,
          this,
          recipient,
          amount,
          color(0, 255, 0),
          "give"
        )
      );
    }
  }

  attackNeighbor() {
    let enemyNeighbors = this.neighbors.filter(
      (n) => n.faction !== this.faction
    );
    if (enemyNeighbors.length > 0) {
      let target = random(enemyNeighbors);
      let amount = floor(
        random(this.minAttack, this.maxAttack) * this.population
      );
      this.population -= amount;

      populationTransfers.push(
        new PopulationTransfer(
          this.centroid,
          target.centroid,
          this,
          target,
          amount,
          color(255, 0, 0),
          "attack"
        )
      );
    }
  }
}

class PopulationTransfer {
  constructor(start, end, originCell, recipient, amount, color, type) {
    this.start = start;
    this.end = end;
    this.originCell = originCell;
    this.recipient = recipient;
    this.amount = amount;
    this.color = color;
    this.startTime = millis();
    this.duration = actionMinInterval * animationSpeed; // 3 seconds
    this.type = type;
    this.isUpdated = false; // New flag to track if update has been called
  }

  update() {
    if (this.isUpdated) return; // Skip if already updated

    let progress = (millis() - this.startTime) / this.duration;

    if (progress >= 1) {
      if (this.recipient.faction !== this.originCell.faction) {
        this.recipient.population -= this.amount;

        if (this.recipient.population <= 0) {
          let oldFaction = this.recipient.faction;
          oldFaction.removeCell(this.recipient);
          this.originCell.faction.addCell(this.recipient);
          this.recipient.population = abs(this.recipient.population);

          // Start color transition animation
          colorTransitions.push(
            new ColorTransition(
              this.recipient,
              oldFaction.color,
              this.originCell.faction.color
            )
          );
        }
      } else if (this.recipient.faction === this.originCell.faction) {
        this.recipient.population += this.amount;
      }
      this.isUpdated = true; // Mark as updated
    }
  }

  draw() {
    let progress = (millis() - this.startTime) / this.duration;
    let alpha = sin(progress * PI) * 255; // Fade in and out

    push();
    stroke(
      this.color.levels[0],
      this.color.levels[1],
      this.color.levels[2],
      alpha
    );
    fill(
      this.color.levels[0],
      this.color.levels[1],
      this.color.levels[2],
      alpha
    );
    strokeWeight(2);

    // Calculate current position
    let x = lerp(this.start.x, this.end.x, progress);
    let y = lerp(this.start.y, this.end.y, progress);

    // Draw arrow
    let angle = atan2(this.end.y - this.start.y, this.end.x - this.start.x);
    push();
    translate(x, y);
    rotate(angle);
    line(0, 0, -15, -5);
    line(0, 0, -15, 5);
    pop();

    // Draw amount text
    textAlign(CENTER, CENTER);
    textSize(12);
    // only display the integer part and one decimal of the population
    text(floor(this.amount), x, y - 15);

    pop();
  }

  isDone() {
    return millis() - this.startTime > this.duration;
  }
}

class Faction {
  constructor(color) {
    this.color = color;
    this.cells = [];
    this.faction_population = 0;
  }

  addCell(cell) {
    this.cells.push(cell);
    cell.faction = this;
    cell.currentColor = this.color;
    this.faction_population += cell.population;
  }

  removeCell(cell) {
    this.cells = this.cells.filter((c) => c !== cell);
    this.faction_population -= cell.population;
  }

  draw() {
    for (let cell of this.cells) {
      cell.draw();
    }
  }

  updatePopulation() {
    this.faction_population = this.cells.reduce(
      (sum, cell) => sum + cell.population,
      0
    );
  }
}

class ColorTransition {
  constructor(cell, startColor, endColor) {
    this.cell = cell;
    this.startColor = startColor;
    this.endColor = endColor;
    this.startTime = millis();
    this.duration = actionMinInterval * animationSpeed;
  }

  update() {
    let progress = (millis() - this.startTime) / this.duration;
    progress = constrain(progress, 0, 1);

    let r = lerp(this.startColor.levels[0], this.endColor.levels[0], progress);
    let g = lerp(this.startColor.levels[1], this.endColor.levels[1], progress);
    let b = lerp(this.startColor.levels[2], this.endColor.levels[2], progress);

    this.cell.currentColor = color(r, g, b);
  }

  isDone() {
    if (millis() - this.startTime > this.duration) {
      this.cell.currentColor = null;
      return true;
    }
    return false;
  }
}

// ------------------------------
function mousePressed() {
  if (isStabilized) {
    // console.log("mousePressed");
    isMouseDragging = true;
    newFactionColor = generateDistinctColors(1)[0];
    cellsToConvert.clear();
  }
}

// Add a new keyPressed function to handle view mode toggle
function keyPressed() {
  // console.log("keyPressed");
  if (key === "v" || key === "V") {
    toggleViewMode();
  }
}

// The toggleViewMode function remains the same
function toggleViewMode() {
  viewMode = viewMode === "faction" ? "population" : "faction";
}

function mouseReleased() {
  if (isStabilized) {
    isMouseDragging = false;
    if (cellsToConvert.size > 0) {
      createNewFaction(Array.from(cellsToConvert), newFactionBonus);
    }
    cellsToConvert.clear();
  }
}

function handleMouseDrag() {
  let mouseCell = cells.find((cell) =>
    pointInPolygon(mouseX, mouseY, cell.polygon)
  );

  if (mouseCell && !cellsToConvert.has(mouseCell)) {
    cellsToConvert.add(mouseCell);
  }
}

function drawHighlight() {
  for (let cell of cellsToConvert) {
    // 50% transparency
    fill(
      newFactionColor.levels[0],
      newFactionColor.levels[1],
      newFactionColor.levels[2],
      127
    );
    noStroke();
    beginShape();
    for (let i = 0; i < cell.polygon.length; i++) {
      vertex(cell.polygon[i][0], cell.polygon[i][1]);
    }
    endShape(CLOSE);
  }
}
function createNewFaction(cellsToConvert, bonus = 30) {
  let newFaction = new Faction(newFactionColor);
  factions.push(newFaction);

  for (let cell of cellsToConvert) {
    let oldFaction = cell.faction;
    if (oldFaction) {
      oldFaction.removeCell(cell);
    }
    cell.population += bonus;
    newFaction.addCell(cell);

    // Start color transition animation
    colorTransitions.push(
      new ColorTransition(cell, cell.currentColor, newFactionColor)
    );

    // Check if the old faction should be removed
    if (oldFaction && oldFaction.cells.length === 0) {
      factions = factions.filter((f) => f !== oldFaction);
    }
  }
}

function pointInPolygon(x, y, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    let xi = polygon[i][0],
      yi = polygon[i][1];
    let xj = polygon[j][0],
      yj = polygon[j][1];

    let intersect =
      yi > y != yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
