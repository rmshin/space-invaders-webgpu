function getTriangleVertexData() {
  const numVertices = 3;
  const vertexData = new Float32Array(numVertices * 2);

  let offset = 0;
  const addVertex = (x, y) => {
    vertexData[offset++] = x;
    vertexData[offset++] = y;
  };

  addVertex(0, 0.5);
  addVertex(-0.25, 0);
  addVertex(0.25, 0);

  return { numTriangleVertices: numVertices, triangleVertexData: vertexData };
}

function getRectVertexData(width = 0.75, height = 0.5) {
  // 0---2
  // | //|
  // |// |
  // 1---3
  const numVertices = 4;
  const vertexData = new Float32Array(numVertices * 2);
  const indexData = new Uint32Array(6);

  let offset = 0;
  const addVertex = (x, y) => {
    vertexData[offset++] = x;
    vertexData[offset++] = y;
  };

  // base of rectangle at y = 0
  // horizontally centred at x = 0
  const x = width / 2;
  addVertex(-x, height);
  addVertex(-x, 0);
  addVertex(x, height);
  addVertex(x, 0);

  offset = 0;
  // first triangle
  indexData[offset++] = 0;
  indexData[offset++] = 1;
  indexData[offset++] = 2;
  // second triangle
  indexData[offset++] = 2;
  indexData[offset++] = 3;
  indexData[offset++] = 1;

  return {
    numRectVertices: indexData.length,
    rectVertexData: vertexData,
    rectIndexData: indexData,
  };
}

function getCircleVertexData({ radius = 0.35, numSubdivisions = 24 } = {}) {
  // num subdivisions + origin
  const numVertices = numSubdivisions + 1;
  const vertexData = new Float32Array(numVertices * 2);
  const indexData = new Uint32Array((numVertices + 1) * 3); // add 1 to wrap around

  let offset = 0;
  const addVertex = (x, y) => {
    vertexData[offset++] = x;
    vertexData[offset++] = y;
  };
  addVertex(0, 0.25); // origin
  for (let i = 0; i <= numSubdivisions; ++i) {
    const angle = (i * Math.PI * 2) / numSubdivisions;

    const c = Math.cos(angle);
    const s = Math.sin(angle);

    addVertex(c * radius, s * radius + 0.25);
  }

  offset = 0;
  for (let i = 0; i < numSubdivisions; ++i) {
    indexData[offset++] = 0;
    indexData[offset++] = i;
    indexData[offset++] = i + 1;
  }
  indexData[offset++] = 0;
  indexData[offset++] = numSubdivisions;
  indexData[offset++] = 1;

  return {
    numCircleVertices: indexData.length,
    circleVertexData: vertexData,
    circleIndexData: indexData,
  };
}

function getVertexScaleColourData(numRows, numCols) {
  const unitSize = 4 + 2 * 4;
  const colourData = new Uint8Array(unitSize * numRows * numCols);
  const scaleData = new Float32Array(colourData.buffer);

  for (let i = 0; i < numRows; i++) {
    for (let j = 0; j < numCols; j++) {
      const colOffset = i * numCols * unitSize + j * unitSize;
      const scaleOffset = colOffset / 4 + 1;
      colourData.set([255, 255, 255, 255], colOffset);
      scaleData.set([0.15, 0.15], scaleOffset);
    }
  }

  return { vScaleColourData: scaleData, vScaleColourUnitSize: unitSize };
}

function getVertexOffsetData(numRows, numCols) {
  const unitSize = 2 * 4;
  const offsetData = new Float32Array((unitSize / 4) * numRows * numCols);

  for (let i = 0; i < numRows; i++) {
    for (let j = 0; j < numCols; j++) {
      const offset = ((i * numCols + j) * unitSize) / 4;
      offsetData.set([-0.65 + j * 0.13, 0.25 - i * 0.13], offset);
    }
  }

  return { vOffsetData: offsetData, vOffsetUnitSize: unitSize };
}

function getShooterVertexData() {
  const numVertices = 12;
  const vertexData = new Float32Array(numVertices * 2);
  const indexData = new Uint32Array(6 * 3);

  let offset = 0;
  const addVertex = (x, y) => {
    vertexData[offset++] = x;
    vertexData[offset++] = y;
  };

  // base rectangle
  addVertex(-0.375, -0.45);
  addVertex(-0.375, -0.95);
  addVertex(0.375, -0.45);
  addVertex(0.375, -0.95);
  // top rectangle
  addVertex(-0.225, -0.4);
  addVertex(-0.225, -0.45);
  addVertex(0.225, -0.4);
  addVertex(0.225, -0.45);
  // shooting barrel
  addVertex(-0.05, -0.2);
  addVertex(-0.05, -0.4);
  addVertex(0.05, -0.2);
  addVertex(0.05, -0.4);

  offset = 0;
  // base first triangle
  indexData[offset++] = 0;
  indexData[offset++] = 1;
  indexData[offset++] = 2;
  // base second triangle
  indexData[offset++] = 2;
  indexData[offset++] = 3;
  indexData[offset++] = 1;
  // top first triangle
  indexData[offset++] = 4;
  indexData[offset++] = 5;
  indexData[offset++] = 6;
  // top second triangle
  indexData[offset++] = 6;
  indexData[offset++] = 7;
  indexData[offset++] = 5;
  // barrel first triangle
  indexData[offset++] = 8;
  indexData[offset++] = 9;
  indexData[offset++] = 10;
  // barrel second triangle
  indexData[offset++] = 10;
  indexData[offset++] = 11;
  indexData[offset++] = 9;

  return {
    numShooterVertices: indexData.length,
    shooterVertexData: vertexData,
    shooterIndexData: indexData,
  };
}

function getShooterAttributesData() {
  const scaleColourUnitSize = 4 + 2 * 4;
  const colourData = new Uint8Array(scaleColourUnitSize);
  const scaleData = new Float32Array(colourData.buffer);
  colourData.set([0, 255, 0, 255]);
  scaleData.set([0.2, 0.12], 1);

  const offsetUnitSize = 2 * 4;
  const offsetData = new Float32Array(offsetUnitSize / 4);
  offsetData.set([0, -0.85]);

  return { shooterColourScaleData: scaleData, shooterOffsetData: offsetData };
}

function getProjectileVertexData() {
  const {
    numRectVertices: numProjVertices,
    rectVertexData: projVertexData,
    rectIndexData: projIndexData,
  } = getRectVertexData(0.04, 0.35);
  return { numProjVertices, projVertexData, projIndexData };
}
function getProjectileColourScaleData(maxProjectiles = 20) {
  const scaleColourUnitSize = 4 + 2 * 4;
  const colourData = new Uint8Array(scaleColourUnitSize * maxProjectiles);
  const scaleData = new Float32Array(colourData.buffer);
  for (let i = 0; i < maxProjectiles; i++) {
    const colOffset = i * scaleColourUnitSize;
    const scaleOffset = colOffset / 4 + 1;
    colourData.set([255, 0, 0, 255], colOffset);
    scaleData.set([0.1, 0.1], scaleOffset);
  }
  return scaleData;
}

export {
  getTriangleVertexData,
  getRectVertexData,
  getCircleVertexData,
  getVertexScaleColourData,
  getVertexOffsetData,
  getShooterVertexData,
  getShooterAttributesData,
  getProjectileVertexData,
  getProjectileColourScaleData,
};
