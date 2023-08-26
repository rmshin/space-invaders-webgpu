import {
  getTriangleVertexData,
  getRectVertexData,
  getCircleVertexData,
  getVertexScaleColourData,
  getVertexOffsetData,
  getShooterVertexData,
  getShooterAttributesData,
  getProjectileVertexData,
  getProjectileColourScaleData,
} from './vertex-data.js';

async function getDevice() {
  const adapter = await navigator.gpu?.requestAdapter();
  const device = await adapter?.requestDevice();
  if (!device) {
    fail('need a browser that supports WebGPU');
    return;
  }
  device.lost.then((info) => {
    console.error(`WebGPU device was lost: ${info.message}`);

    // 'reason' will be 'destroyed' if we intentionally destroy the device.
    if (info.reason !== 'destroyed') {
      // try again
      getDevice();
    }
  });
  return device;
}

async function setup() {
  const device = await getDevice();
  const canvas = document.getElementById('canvas');
  const context = canvas.getContext('webgpu');
  const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
  context.configure({
    device,
    format: presentationFormat,
  });

  const module = device.createShaderModule({
    label: 'triangle shaders',
    code: `
        struct Vertex {
          @location(0) position: vec2f,
          @location(1) colour: vec4f,
          @location(2) scale: vec2f,
          @location(3) offset: vec2f,
        };
        struct VsOutput {
          @builtin(position) position: vec4f,
          @location(0) colour: vec4f
        }

        @group(0) @binding(0) var<storage> activeState: array<u32>;
  
        @vertex
        fn vs(
          vert: Vertex,
          @builtin(instance_index) instance: u32
        ) -> VsOutput {
          let state = f32(activeState[instance]);

          var output: VsOutput;
          output.position = vec4f(vert.position * vert.scale * state + vert.offset, 0.0, 1.0);
          output.colour = vert.colour;
          return output;
        }
   
        @fragment
        fn fs(input: VsOutput) -> @location(0) vec4f {
          return input.colour;
        }
      `,
  });

  const pipeline = device.createRenderPipeline({
    label: 'space invaders render pipeline',
    layout: 'auto',
    vertex: {
      module,
      entryPoint: 'vs',
      buffers: [
        {
          arrayStride: 2 * 4, // 2 floats, 4 bytes each
          attributes: [
            { shaderLocation: 0, offset: 0, format: 'float32x2' }, // position
          ],
        },
        {
          arrayStride: 2 * 4 + 4, // 2 4byte floats + 4 bytes
          stepMode: 'instance',
          attributes: [
            { shaderLocation: 1, offset: 0, format: 'unorm8x4' }, // colour
            { shaderLocation: 2, offset: 4, format: 'float32x2' }, // scale
          ],
        },
        {
          arrayStride: 2 * 4, // 2 floats, 4 bytes each
          stepMode: 'instance',
          attributes: [
            { shaderLocation: 3, offset: 0, format: 'float32x2' }, // offset
          ],
        },
      ],
    },
    fragment: {
      module,
      entryPoint: 'fs',
      targets: [{ format: presentationFormat }],
    },
  });

  const renderPassDescriptor = {
    label: 'basic canvas renderPass',
    colorAttachments: [
      {
        // view: <- to be filled out during render
        clearValue: [0, 0, 0, 1],
        loadOp: 'clear',
        storeOp: 'store',
      },
    ],
  };

  return { device, canvas, pipeline, renderPassDescriptor };
}

function setupVertexBuffers(device) {
  // triangle buffer
  const { numTriangleVertices, triangleVertexData } = getTriangleVertexData();
  const triangleVertexBuffer = device.createBuffer({
    label: `triangle vertex buffer`,
    size: triangleVertexData.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(triangleVertexBuffer, 0, triangleVertexData);

  // rect buffers
  const { numRectVertices, rectVertexData, rectIndexData } = getRectVertexData();
  const rectVertexBuffer = device.createBuffer({
    label: `rect vertex buffer`,
    size: rectVertexData.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(rectVertexBuffer, 0, rectVertexData);
  const rectIndexBuffer = device.createBuffer({
    label: `rect index buffer`,
    size: rectIndexData.byteLength,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(rectIndexBuffer, 0, rectIndexData);

  // circle buffers
  const { numCircleVertices, circleVertexData, circleIndexData } = getCircleVertexData();
  const circleVertexBuffer = device.createBuffer({
    label: `circle vertex buffer`,
    size: circleVertexData.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(circleVertexBuffer, 0, circleVertexData);
  const circleIndexBuffer = device.createBuffer({
    label: `circle index buffer`,
    size: circleIndexData.byteLength,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(circleIndexBuffer, 0, circleIndexData);

  return {
    triangle: {
      numVertices: numTriangleVertices,
      vBuffer: triangleVertexBuffer,
    },
    circle: {
      numVertices: numCircleVertices,
      vBuffer: circleVertexBuffer,
      idxBuffer: circleIndexBuffer,
    },
    rect: {
      numVertices: numRectVertices,
      vBuffer: rectVertexBuffer,
      idxBuffer: rectIndexBuffer,
    },
  };
}

function setupVertexAttributeBuffers(device, numRows, numCols) {
  const { vScaleColourData, vScaleColourUnitSize } = getVertexScaleColourData(numRows, numCols);
  const vScaleColourBuffer = device.createBuffer({
    label: `static vertex colour & scale buffer`,
    size: vScaleColourData.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(vScaleColourBuffer, 0, vScaleColourData);

  const { vOffsetData, vOffsetUnitSize } = getVertexOffsetData(numRows, numCols);
  const vOffsetBuffer = device.createBuffer({
    label: `dynamic vertex offset buffer`,
    size: vOffsetData.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(vOffsetBuffer, 0, vOffsetData);

  return {
    fixed: {
      vScaleColour: {
        buffer: vScaleColourBuffer,
        data: vScaleColourData,
        unitSize: vScaleColourUnitSize,
      },
    },
    dynamic: {
      vOffset: {
        buffer: vOffsetBuffer,
        data: vOffsetData,
        unitSize: vOffsetUnitSize,
      },
    },
  };
}

function setupStateStorageBuffers(device, numTriangles, numRects, numCircles, maxProjectiles) {
  const initialTriangleState = new Uint32Array(new Array(numTriangles).fill(1));
  const tStorageBuffer = device.createBuffer({
    label: `triangle active state storage buffer`,
    size: initialTriangleState.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(tStorageBuffer, 0, initialTriangleState);

  const initialRectState = new Uint32Array(new Array(numRects).fill(1));
  const rStorageBuffer = device.createBuffer({
    label: `rectangle active state storage buffer`,
    size: initialRectState.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(rStorageBuffer, 0, initialRectState);

  const initialCircleState = new Uint32Array(new Array(numCircles).fill(1));
  const cStorageBuffer = device.createBuffer({
    label: `circle active state storage buffer`,
    size: initialCircleState.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(cStorageBuffer, 0, initialCircleState);

  const projectileState = new Uint32Array(new Array(maxProjectiles).fill(1));
  const pStorageBuffer = device.createBuffer({
    label: `always active state storage buffer`,
    size: projectileState.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(pStorageBuffer, 0, projectileState);

  return {
    storage: {
      tStateBuffer: tStorageBuffer,
      tStateData: initialTriangleState,
      rStateBuffer: rStorageBuffer,
      rStateData: initialRectState,
      cStateBuffer: cStorageBuffer,
      cStateData: initialCircleState,
      pStateBuffer: pStorageBuffer,
    },
  };
}

function setupShooterBuffers(device) {
  const { numShooterVertices, shooterVertexData, shooterIndexData } = getShooterVertexData();
  const vertexBuffer = device.createBuffer({
    label: `shooter vertex buffer`,
    size: shooterVertexData.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(vertexBuffer, 0, shooterVertexData);

  const indexBuffer = device.createBuffer({
    label: `shooter index buffer`,
    size: shooterIndexData.byteLength,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(indexBuffer, 0, shooterIndexData);

  const { shooterColourScaleData, shooterOffsetData } = getShooterAttributesData();
  const colourScaleBuffer = device.createBuffer({
    label: `static shooter colour & scale buffer`,
    size: shooterColourScaleData.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(colourScaleBuffer, 0, shooterColourScaleData);

  const offsetBuffer = device.createBuffer({
    label: `dynamic shooter offset buffer`,
    size: shooterOffsetData.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(offsetBuffer, 0, shooterOffsetData);

  return {
    shooter: {
      numVertices: numShooterVertices,
      vBuffer: vertexBuffer,
      idxBuffer: indexBuffer,
      csBuffer: colourScaleBuffer,
      offBuffer: offsetBuffer,
      offsetData: shooterOffsetData,
    },
  };
}

function setupProjectileBuffers(device, maxProjectiles = 5) {
  const { numProjVertices, projVertexData, projIndexData } = getProjectileVertexData();
  const vertexBuffer = device.createBuffer({
    label: `projectile vertex buffer`,
    size: projVertexData.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(vertexBuffer, 0, projVertexData);

  const indexBuffer = device.createBuffer({
    label: `projectile index buffer`,
    size: projIndexData.byteLength,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(indexBuffer, 0, projIndexData);

  const csData = getProjectileColourScaleData();
  const colourScaleBuffer = device.createBuffer({
    label: `static projectile colour & scale buffer`,
    size: csData.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(colourScaleBuffer, 0, csData);

  // offset data unit size * max projectiles
  const offsetData = new Float32Array(2 * maxProjectiles);
  const offsetBuffer = device.createBuffer({
    label: `dynamic projectile offset buffer`,
    size: offsetData.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });

  return {
    projectile: {
      numVertices: numProjVertices,
      vBuffer: vertexBuffer,
      idxBuffer: indexBuffer,
      csBuffer: colourScaleBuffer,
      offBuffer: offsetBuffer,
      offsetData,
    },
  };
}

export {
  setup,
  setupVertexBuffers,
  setupVertexAttributeBuffers,
  setupStateStorageBuffers,
  setupShooterBuffers,
  setupProjectileBuffers,
};
