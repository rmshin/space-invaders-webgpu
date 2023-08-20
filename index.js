import { rand, createCircleVertices } from './utils.js';

// https://webgpufundamentals.org/webgpu/lessons/webgpu-fundamentals.html

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

async function main() {
  const device = await getDevice();
  const canvas = document.getElementById('canvas');
  const context = canvas.getContext('webgpu');
  const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
  context.configure({
    device,
    format: presentationFormat,
  });

  const module = device.createShaderModule({
    label: 'our hardcoded red triangle shaders',
    code: `
      struct Vertex {
        @location(0) position: vec2f,
        @location(1) colour: vec4f,
        @location(2) offset: vec2f,
        @location(3) scale: vec2f,
      };
      struct VsOutput {
        @builtin(position) position: vec4f,
        @location(0) colour: vec4f
      }

      @vertex fn vs(vert: Vertex) -> VsOutput {
        var output: VsOutput;
        output.position = vec4f(vert.position * vert.scale + vert.offset, 0.0, 1.0);
        output.colour = vert.colour;
        return output;
      }
 
      @fragment fn fs(input: VsOutput) -> @location(0) vec4f {
        return input.colour;
      }
    `,
  });

  const pipeline = device.createRenderPipeline({
    label: 'our hardcoded red triangle pipeline',
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
            { shaderLocation: 2, offset: 4, format: 'float32x2' }, // offset
          ],
        },
        {
          arrayStride: 2 * 4, // 2 floats, 4 bytes each
          stepMode: 'instance',
          attributes: [
            { shaderLocation: 3, offset: 0, format: 'float32x2' }, // scale
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
    label: 'our basic canvas renderPass',
    colorAttachments: [
      {
        // view: <- to be filled out when we render
        clearValue: [0.3, 0.3, 0.3, 1],
        loadOp: 'clear',
        storeOp: 'store',
      },
    ],
  };

  // create vertices storage
  const { vertexData, indexData, numVertices } = createCircleVertices({
    radius: 0.5,
    innerRadius: 0,
  });
  const vertexBuffer = device.createBuffer({
    label: `vertex buffer`,
    size: vertexData.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(vertexBuffer, 0, vertexData);
  const indexBuffer = device.createBuffer({
    label: 'index buffer',
    size: indexData.byteLength,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(indexBuffer, 0, indexData);

  // create resources
  const kNumObjects = 100;
  const objectInfos = [];

  const staticUnitSize =
    4 + // colour is 4 8bit normalised floats
    2 * 4; // offset is 2 32bit floats (4bytes each)

  const staticBufferSize = staticUnitSize * kNumObjects;

  const kColorOffset = 0;
  const kOffsetOffset = 1;

  const staticStorageBuffer = device.createBuffer({
    label: `static vertex colour & offsets buffer`,
    size: staticBufferSize,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  {
    const staticVertexValuesU8 = new Uint8Array(staticBufferSize);
    const staticVertexValuesF32 = new Float32Array(staticVertexValuesU8.buffer);
    for (let i = 0; i < kNumObjects; ++i) {
      const staticOffsetU8 = staticUnitSize * i;
      const staticOffsetF32 = staticOffsetU8 / 4;
      staticVertexValuesU8.set(
        [rand() * 255, rand() * 255, rand() * 255, 255],
        staticOffsetU8 + kColorOffset
      ); // set the colour
      staticVertexValuesF32.set(
        [rand(-0.9, 0.9), rand(-0.9, 0.9)],
        staticOffsetF32 + kOffsetOffset
      ); // set the offset

      objectInfos.push({
        scale: rand(0.2, 0.5),
      });
    }
    device.queue.writeBuffer(staticStorageBuffer, 0, staticVertexValuesF32);
  }

  const dynamicUnitSize = 2 * 4; // scale is 2 32bit floats (4bytes each)
  const dynamicBufferSize = dynamicUnitSize * kNumObjects;

  const kScaleOffset = 0;

  const storageBuffer = device.createBuffer({
    label: `dynamic vertex scale buffer`,
    size: dynamicBufferSize,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  const storageValues = new Float32Array(dynamicBufferSize / 4);

  function render() {
    const aspect = canvas.width / canvas.height;
    for (const [idx, { scale }] of objectInfos.entries()) {
      const offset = (idx * dynamicUnitSize) / 4;
      storageValues.set([scale / aspect, scale], offset + kScaleOffset); // set the scale
    }
    device.queue.writeBuffer(storageBuffer, 0, storageValues);

    // Get the current texture from the canvas context and
    // set it as the texture to render to.
    renderPassDescriptor.colorAttachments[0].view = context.getCurrentTexture().createView();

    // make a command encoder to start encoding commands
    const encoder = device.createCommandEncoder({ label: 'our encoder' });

    // make a render pass encoder to encode render specific commands
    const pass = encoder.beginRenderPass(renderPassDescriptor);
    pass.setPipeline(pipeline);
    pass.setVertexBuffer(0, vertexBuffer);
    pass.setVertexBuffer(1, staticStorageBuffer);
    pass.setVertexBuffer(2, storageBuffer);
    pass.setIndexBuffer(indexBuffer, 'uint32');
    pass.drawIndexed(numVertices, kNumObjects);
    pass.end();

    const commandBuffer = encoder.finish();
    device.queue.submit([commandBuffer]);
  }

  // https://www.w3.org/TR/webgpu/#example-1b33fca8
  function resizeCanvas(entries) {
    for (const entry of entries) {
      if (entry.target != canvas) {
        continue;
      }
      const width = entry.contentBoxSize[0].inlineSize;
      const height = entry.contentBoxSize[0].blockSize;
      // clamp canvas sizes to ensure WebGPU doesn't throw GPUValidationErrors
      entry.target.width = Math.max(1, Math.min(width, device.limits.maxTextureDimension2D));
      entry.target.height = Math.max(1, Math.min(height, device.limits.maxTextureDimension2D));
      render();
    }
  }

  const resizeObserver = new ResizeObserver(resizeCanvas);
  resizeObserver.observe(canvas);
}

main();
