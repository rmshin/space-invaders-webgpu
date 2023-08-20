const rand = (min, max) => {
  if (min === undefined) {
    min = 0;
    max = 1;
  } else if (max === undefined) {
    max = min;
    min = 0;
  }
  return min + Math.random() * (max - min);
};

function createCircleVertices({
  radius = 1,
  numSubdivisions = 24,
  innerRadius = 0,
  startAngle = 0,
  endAngle = Math.PI * 2,
} = {}) {
  // 2 vertices at each subdivision + 1 to wrap around the circle
  const numVertices = (numSubdivisions + 1) * 2;
  const vertexData = new Float32Array(numVertices * 2);

  let offset = 0;
  const addVertex = (x, y) => {
    vertexData[offset++] = x;
    vertexData[offset++] = y;
  };

  // 2 vertices per subdivision
  //
  // 0  2  4  6  8 ...
  //
  // 1  3  5  7  9 ...
  for (let i = 0; i <= numSubdivisions; ++i) {
    const angle = startAngle + ((i + 0) * (endAngle - startAngle)) / numSubdivisions;

    const c = Math.cos(angle);
    const s = Math.sin(angle);

    addVertex(c * radius, s * radius);
    addVertex(c * innerRadius, s * innerRadius);
  }

  const indexData = new Uint32Array(numSubdivisions * 6);
  let ndx = 0;

  // 0---2---4---...
  // | //| //|
  // |// |// |//
  // 1---3-- 5---...
  for (let i = 0; i < numSubdivisions; ++i) {
    const ndxOffset = i * 2;

    // first triangle
    indexData[ndx++] = ndxOffset;
    indexData[ndx++] = ndxOffset + 1;
    indexData[ndx++] = ndxOffset + 2;

    // second triangle
    indexData[ndx++] = ndxOffset + 2;
    indexData[ndx++] = ndxOffset + 1;
    indexData[ndx++] = ndxOffset + 3;
  }

  return {
    vertexData,
    indexData,
    numVertices: indexData.length,
  };
}

export { rand, createCircleVertices };
