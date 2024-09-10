let points = [];
let delaunay, voronoi;
let frameCount = 0;
const maxFrames = 50; // Adjust this to control when stabilization occurs
const cellCount = 100;
const numFactions = cellCount / 5;

let cells = [];
let factions = [];
let isStabilized = false;

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
    let r = random(128, 255);
    let g = random(128, 255);
    let b = random(128, 255);

    // Ensure at least one component is very high (over 200)
    const highComponent = floor(random(3));
    if (highComponent === 0) r = random(200, 255);
    else if (highComponent === 1) g = random(200, 255);
    else b = random(200, 255);

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

class Cell {
  constructor(polygon, id) {
    this.polygon = polygon;
    this.id = id;
    this.centroid = calculateCentroid(polygon);
    this.faction = null;
    this.neighbors = [];
  }

  draw() {
    beginShape();
    for (let i = 0; i < this.polygon.length; i++) {
      vertex(this.polygon[i][0], this.polygon[i][1]);
    }
    endShape(CLOSE);
  }
}

class Faction {
  constructor(color) {
    this.color = color;
    this.cells = [];
  }

  addCell(cell) {
    this.cells.push(cell);
    cell.faction = this;
  }

  draw() {
    fill(this.color);
    for (let cell of this.cells) {
      cell.draw();
    }
  }
}
