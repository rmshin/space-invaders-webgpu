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

function getRectVertexData() {
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

  addVertex(-0.375, 0.5);
  addVertex(-0.375, 0);
  addVertex(0.375, 0.5);
  addVertex(0.375, 0);

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

function getCircleVertexData({ radius = 0.35, numSubdivisions = 24, innerRadius = 0 } = {}) {
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
      scaleData.set([0.1, 0.1], scaleOffset);
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
      offsetData.set([-0.5 + j * 0.1, 0.5 - i * 0.1], offset);
    }
  }

  return { vOffsetData: offsetData, vOffsetUnitSize: unitSize };
}

export {
  getTriangleVertexData,
  getRectVertexData,
  getCircleVertexData,
  getVertexScaleColourData,
  getVertexOffsetData,
};
