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
      struct OurStruct {
        colour: vec4f,
        offset: vec2f,
      };
      struct OtherStruct {
        scale: vec2f,
      };
      struct Vertex {
        position: vec2f,
      };
      struct VsOutput {
        @builtin(position) position: vec4f,
        @location(0) colour: vec4f
      }
 
      @group(0) @binding(0) var<storage> ourStructs: array<OurStruct>;
      @group(0) @binding(1) var<storage> otherStructs: array<OtherStruct>;
      @group(0) @binding(2) var<storage> vertices: array<Vertex>;

      @vertex fn vs(
        @builtin(vertex_index) vertexIndex: u32,
        @builtin(instance_index) instanceIndex: u32
      ) -> VsOutput {
        let ourStruct = ourStructs[instanceIndex];
        let otherStruct = otherStructs[instanceIndex];

        var output: VsOutput;
        output.position = vec4f(vertices[vertexIndex].position * otherStruct.scale + ourStruct.offset, 0.0, 1.0);
        output.colour = ourStruct.colour;
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
  const { vertexData, numVertices } = createCircleVertices({
    radius: 0.5,
    innerRadius: 0,
  });
  const vertexBuffer = device.createBuffer({
    label: `vertex storage buffer`,
    size: vertexData.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(vertexBuffer, 0, vertexData);

  // create resources
  const kNumObjects = 100;
  const objectInfos = [];

  const staticUnitSize =
    4 * 4 + // colour is 4 32bit floats (4bytes each)
    2 * 4 + // offset is 2 32bit floats (4bytes each)
    2 * 4; // padding to align with multiple of 16-byte colour
  const staticBufferSize = staticUnitSize * kNumObjects;

  const dynamicUnitSize = 2 * 4; // scale is 2 32bit floats (4bytes each)
  const dynamicBufferSize = dynamicUnitSize * 100;

  const kColorOffset = 0;
  const kOffsetOffset = 4;
  const kScaleOffset = 0;

  const staticStorageBuffer = device.createBuffer({
    label: `static storage buffer`,
    size: staticBufferSize,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  {
    const staticStorageValues = new Float32Array(staticBufferSize / 4);
    for (let i = 0; i < kNumObjects; ++i) {
      const staticOffset = (staticUnitSize * i) / 4;
      staticStorageValues.set([rand(), rand(), rand(), 1], staticOffset + kColorOffset); // set the color
      staticStorageValues.set([rand(-0.9, 0.9), rand(-0.9, 0.9)], staticOffset + kOffsetOffset); // set the offset

      objectInfos.push({
        scale: rand(0.2, 0.5),
      });
    }
    device.queue.writeBuffer(staticStorageBuffer, 0, staticStorageValues);
  }

  const storageBuffer = device.createBuffer({
    label: `dynamic storage buffer`,
    size: dynamicBufferSize,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  const storageValues = new Float32Array(dynamicBufferSize / 4);

  const bindGroup = device.createBindGroup({
    label: `bind group`,
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: staticStorageBuffer } },
      { binding: 1, resource: { buffer: storageBuffer } },
      { binding: 2, resource: { buffer: vertexBuffer } },
    ],
  });

  function render() {
    // Get the current texture from the canvas context and
    // set it as the texture to render to.
    renderPassDescriptor.colorAttachments[0].view = context.getCurrentTexture().createView();

    // make a command encoder to start encoding commands
    const encoder = device.createCommandEncoder({ label: 'our encoder' });

    // make a render pass encoder to encode render specific commands
    const pass = encoder.beginRenderPass(renderPassDescriptor);
    pass.setPipeline(pipeline);

    const aspect = canvas.width / canvas.height;
    for (const [idx, { scale }] of objectInfos.entries()) {
      const offset = (idx * dynamicUnitSize) / 4;
      storageValues.set([scale / aspect, scale], offset + kScaleOffset); // set the scale
    }
    device.queue.writeBuffer(storageBuffer, 0, storageValues);
    pass.setBindGroup(0, bindGroup);
    pass.draw(numVertices, kNumObjects); // call our vertex shader 3 times
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
