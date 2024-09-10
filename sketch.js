let points = [];
let delaunay, voronoi;
let frameCount = 0;
const maxFrames = 50; // Adjust this to control when stabilization occurs
const cellCount = 200;
// const numFactions = cellCount / 5;
const numFactions = 4;
const populationChangeInterval = 1000;
const actionMinInterval = 3000;
const actionMaxInterval = 5000;
const animationSpeed = 0.5;
const showPopulationTransfers = true;
const cellPopulationLimit = 50;

let cells = [];
let factions = [];
let isStabilized = false;
let lastGrowthTime = 0;
let lastActionTime = 0;
let populationTransfers = [];
let colorTransitions = [];

function setup() {
  createCanvas(windowWidth * 0.98, windowHeight * 0.98);

  // Create initial points
  for (let i = 0; i < cellCount; i++) {
    let x = random(width);
    let y = random(height);
    points[i] = createVector(x, y);
  }

  updateVoronoi();
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
    // Draw stabilized Voronoi with factions
    drawStabilizedVoronoi();

    // Grow population every second
    if (millis() - lastGrowthTime > populationChangeInterval * animationSpeed) {
      growPopulation();
      lastGrowthTime = millis();
    }

    // Perform actions every 3-5 seconds
    if (
      millis() - lastActionTime >
      random(actionMinInterval, actionMaxInterval * animationSpeed)
    ) {
      performCellActions();
      lastActionTime = millis();
    }

    // Update and draw population transfers
    updatePopulationTransfers();
    updateColorTransitions();
  }
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

  function getPaleColor() {
    // Generate pale colors by ensuring at least one component is high
    let r = random(190, 255);
    let g = random(190, 255);
    let b = random(190, 255);

    // Ensure at least one component is very high (over 220)
    const highComponent = floor(random(3));
    if (highComponent === 0) r = random(220, 255);
    else if (highComponent === 1) g = random(220, 255);
    else b = random(220, 255);

    return color(r, g, b);
  }

  while (unassignedCells.length > 0 && factions.length < numFactions) {
    let startCell = random(unassignedCells);
    let faction = new Faction(getPaleColor());
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
    populationTransfers[i].update();
    if (showPopulationTransfers) {
      populationTransfers[i].draw();
    }
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
    this.population = floor(random(50, 80));
    this.currentColor = null;
  }

  draw() {
    beginShape();
    for (let i = 0; i < this.polygon.length; i++) {
      vertex(this.polygon[i][0], this.polygon[i][1]);
    }
    endShape(CLOSE);

    push();
    // Display population
    fill(0);
    noStroke();
    textAlign(CENTER, CENTER);
    textSize(12);
    // only display the integer part of the population
    text(floor(this.population), this.centroid.x, this.centroid.y);
    pop();
  }

  growPopulation() {
    this.population += random(0.2, 0.4);
  }

  performAction() {
    // Grow population naturally if under cellPopulationLimit
    if (this.population < cellPopulationLimit) {
      this.growPopulation();
    }

    // Choose an action based on probabilities,
    let randomValue = random();
    let action;

    if (randomValue < 0.1) {
      action = "stay";
    } else if (randomValue < 0.55) {
      action = "give";
    } else {
      action = "attack";
    }

    switch (action) {
      case "stay":
        // Do nothing
        break;
      case "give":
        this.givePopulation();
        break;
      case "attack":
        this.attackNeighbor();
        break;
    }
  }

  givePopulation() {
    let friendlyNeighbors = this.neighbors.filter(
      (n) => n.faction === this.faction
    );
    if (friendlyNeighbors.length > 0) {
      let recipient = random(friendlyNeighbors);
      let amount = random(0.1, 0.2) * this.population;
      this.population -= amount;
      recipient.population += amount;

      // Create a new population transfer animation
      populationTransfers.push(
        new PopulationTransfer(
          this.centroid,
          recipient.centroid,
          amount,
          color(0, 255, 0)
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
      let amount = floor(random(0.4, 0.8) * this.population);
      this.population -= amount;
      target.population -= amount;

      populationTransfers.push(
        new PopulationTransfer(
          this.centroid,
          target.centroid,
          amount,
          color(255, 0, 0)
        )
      );

      if (target.population <= 0) {
        let oldFaction = target.faction;
        oldFaction.removeCell(target);
        this.faction.addCell(target);
        target.population = abs(target.population);

        // Start color transition animation
        colorTransitions.push(
          new ColorTransition(target, oldFaction.color, this.faction.color)
        );
      }
    }
  }
}

class PopulationTransfer {
  constructor(start, end, amount, color) {
    this.start = start;
    this.end = end;
    this.amount = amount;
    this.color = color;
    this.startTime = millis();
    this.duration = actionMinInterval * animationSpeed; // 3 seconds
  }

  update() {
    // No need to update anything here, as we'll calculate the position in the draw method
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
      fill(cell.currentColor || this.color);
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
    return millis() - this.startTime > this.duration;
  }
}
