import {
  setup,
  setupVertexBuffers,
  setupVertexAttributeBuffers,
  setupStateStorageBuffers,
  setupShooterBuffers,
  setupProjectileBuffers,
} from './webgpu.js';
import { setupUserInputHandlers, clearUserInputHandlers, getShooterOffsetX } from './user-input.js';
import { getVertexOffsetData } from './vertex-data.js';

const MAX_PROJECTILES = 5;

async function main() {
  const { device, canvas, pipeline, renderPassDescriptor } = await setup();
  const { triangle, circle, rect } = setupVertexBuffers(device);

  // grid count of invaders
  const numRowsTri = 1, // shooters
    numRowsCirc = 2, // middle invaders
    numRowsRect = 2; // front invaders
  const numRows = numRowsTri + numRowsCirc + numRowsRect;
  const numCols = 11;

  const { fixed, dynamic } = setupVertexAttributeBuffers(device, numRows, numCols);
  const { shooter } = setupShooterBuffers(device);
  const { projectile } = setupProjectileBuffers(device, MAX_PROJECTILES);
  const { storage } = setupStateStorageBuffers(
    device,
    numRowsTri * numCols, // total num shooters
    numRowsCirc * numCols, // total num mid invaders
    numRowsRect * numCols, // total num front invaders
    MAX_PROJECTILES
  );

  // bind groups
  const [tBindGroup, rBindGroup, cBindGroup, pBindGroup] = [
    device.createBindGroup({
      label: `bind group for triangle state`,
      layout: pipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: storage.tStateBuffer } }],
    }),
    device.createBindGroup({
      label: `bind group for rectangle state`,
      layout: pipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: storage.rStateBuffer } }],
    }),
    device.createBindGroup({
      label: `bind group for circle state`,
      layout: pipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: storage.cStateBuffer } }],
    }),
    device.createBindGroup({
      label: `bind group for projectile state`,
      layout: pipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: storage.pStateBuffer } }],
    }),
  ];

  // game state
  let startGame = false;
  let gameOver = false;
  let score = 0;

  // update
  let currDir = 'right';
  let previousTimeStamp;
  let horizontalShiftFactor = 0.03;
  let downwardShift = 0.05;
  let tickPeriod = 650;

  // in-memory store of active projectiles
  // updated when user presses 'Space' key
  const projectiles = [];

  function resetGameState() {
    // reset game flags
    startGame = false;
    gameOver = false;
    score = 0;
    // reset update vars
    currDir = 'right';
    previousTimeStamp = undefined;
    horizontalShiftFactor = 0.03;
    tickPeriod = 650;
    // reset invader positions
    const initial = getVertexOffsetData(numRows, numCols).vOffsetData;
    dynamic.vOffset.data = initial;
    device.queue.writeBuffer(dynamic.vOffset.buffer, 0, dynamic.vOffset.data);
    // reset invader states
    for (let i = 0; i < numRowsTri * numCols; i++) {
      storage.tStateData[i] = 1;
    }
    device.queue.writeBuffer(storage.tStateBuffer, 0, storage.tStateData);
    for (let i = 0; i < numRowsCirc * numCols; i++) {
      storage.cStateData[i] = 1;
    }
    device.queue.writeBuffer(storage.cStateBuffer, 0, storage.cStateData);
    for (let i = 0; i < numRowsRect * numCols; i++) {
      storage.rStateData[i] = 1;
    }
    device.queue.writeBuffer(storage.rStateBuffer, 0, storage.rStateData);
    // clear projectiles
    projectiles.splice(0);
  }

  function isCollision(p) {
    const projectileWidth = 0.04 * 0.1; //hardcoded value in vertex-data.js
    const projectileHeight = 0.3 * 0.1; //hardcoded value in vertex-data.js

    // need to add/subtract width / 2 as projectile begins centered at x=0
    const pLeft = p.x - projectileWidth / 2; // left-most x-coord
    const pRight = p.x + projectileWidth / 2; // right-most x-coord
    // projectile begins with base at y=0
    const pTop = p.y + projectileHeight;
    const pBottom = p.y;

    let isCollision = false;
    let tLeft, tRight, tTop, tBottom;
    // check collisions with rectangles
    for (let i = 0; i < storage.rStateData.length; i++) {
      const state = storage.rStateData[i];
      if (state == 1) {
        // get rectangles offset within vertex offset data
        const offset = ((numRowsTri + numRowsCirc) * numCols * dynamic.vOffset.unitSize) / 4;
        // get x,y offsets for current rectangle
        const rectOffsetX = dynamic.vOffset.data[offset + i * 2];
        const rectOffsetY = dynamic.vOffset.data[offset + i * 2 + 1];
        const rectWidth = 0.75 * 0.15;
        const rectHeight = 0.5 * 0.15;

        tLeft = rectOffsetX - rectWidth / 2;
        tRight = rectOffsetX + rectWidth / 2;
        tTop = rectOffsetY + rectHeight;
        tBottom = rectOffsetY;

        if (pLeft > tRight || pRight < tLeft || pTop < tBottom || pBottom > tTop) {
        } else {
          // make collided rect inactive
          storage.rStateData[i] = 0;
          device.queue.writeBuffer(storage.rStateBuffer, 0, storage.rStateData);
          // update score
          score += 10;
          isCollision = true;
          break;
        }
      }
    }
    if (!isCollision) {
      // check collisions with circles
      for (let i = 0; i < storage.cStateData.length; i++) {
        const state = storage.cStateData[i];
        if (state == 1) {
          // get circles offset within vertex offset data
          const offset = (numRowsTri * numCols * dynamic.vOffset.unitSize) / 4;
          // get x,y offsets for current circle
          const circleOffsetX = dynamic.vOffset.data[offset + i * 2];
          const circleOffsetY = dynamic.vOffset.data[offset + i * 2 + 1];
          const circleRadius = 0.35 * 0.15;
          const circleOriginY = 0.25 * 0.15;

          tLeft = circleOffsetX - circleRadius;
          tRight = circleOffsetX + circleRadius;
          tTop = circleOffsetY + (circleOriginY + circleRadius);
          tBottom = circleOffsetY + (circleOriginY - circleRadius);

          if (pLeft > tRight || pRight < tLeft || pTop < tBottom || pBottom > tTop) {
          } else {
            // make collided circle inactive
            storage.cStateData[i] = 0;
            device.queue.writeBuffer(storage.cStateBuffer, 0, storage.cStateData);
            // update score
            score += 20;
            isCollision = true;
            break;
          }
        }
      }
    }

    if (!isCollision) {
      // check collisions with triangles
      for (let i = 0; i < storage.tStateData.length; i++) {
        const state = storage.tStateData[i];
        if (state == 1) {
          // get x,y offsets for current circle
          const triOffsetX = dynamic.vOffset.data[i * 2];
          const triOffsetY = dynamic.vOffset.data[i * 2 + 1];
          const triangleWidth = 0.5 * 0.15;
          const triangleHeight = 0.5 * 0.15;

          tLeft = triOffsetX - triangleWidth / 2;
          tRight = triOffsetX + triangleWidth / 2;
          tTop = triOffsetY + triangleHeight;
          tBottom = triOffsetY;

          if (pLeft > tRight || pRight < tLeft || pTop < tBottom || pBottom > tTop) {
          } else {
            // make collided triangle inactive
            storage.tStateData[i] = 0;
            device.queue.writeBuffer(storage.tStateBuffer, 0, storage.tStateData);
            // update score
            score += 40;
            isCollision = true;
            break;
          }
        }
      }
    }

    return isCollision;
  }

  function getBottomMostOffsetIdx() {
    // first check for active rects
    let activeIdx = storage.rStateData.lastIndexOf(1);
    if (activeIdx > -1) {
      const rowNum = numRowsTri + numRowsCirc + Math.ceil(activeIdx / numCols);
      const offsetIdx = numCols * rowNum * 2 - 1;
      return offsetIdx;
    }
    // then check for active circles
    activeIdx = storage.cStateData.lastIndexOf(1);
    if (activeIdx > -1) {
      const rowNum = numRowsTri + Math.ceil(activeIdx / numCols);
      const offsetIdx = numCols * rowNum * 2 - 1;
      return offsetIdx;
    }
    // otherwise check for active triangles
    activeIdx = storage.tStateData.lastIndexOf(1);
    if (activeIdx > -1) {
      return activeIdx * 2 + 1;
    }
    return -1;
  }
  function getLeftMostOffset() {
    // get left-most active triangle
    let idx = storage.tStateData.indexOf(1);
    for (let i = 0; i < numCols; i++) {
      // get left-most active circle in first row
      const active1 = storage.tStateData[i];
      if (active1 == 1 && i < idx % numCols) {
        idx = numRowsTri * numCols + i;
      }
      // get left-most active circle in second row
      const active2 = storage.tStateData[i + numCols];
      if (active2 == 1 && i < idx % numCols) {
        idx = (numRowsTri + 1) * numCols + i;
      }
    }

    for (let i = 0; i < numCols; i++) {
      // get left-most active rect in first row
      const active1 = storage.rStateData[i];
      if (active1 == 1 && i < idx % numCols) {
        idx = (numRowsTri + numRowsCirc) * numCols + i;
      }
      // get left-most active rect in second row
      const active2 = storage.rStateData[i + numCols];
      if (active2 == 1 && i < idx % numCols) {
        idx = (numRowsTri + numRowsCirc + 1) * numCols + i;
      }
    }

    return idx > -1 ? idx * 2 : idx;
  }
  function getRightMostOffset() {
    // get right-most active triangle
    let idx = storage.tStateData.lastIndexOf(1);
    for (let i = numCols - 1; i >= 0; i--) {
      // get right-most active circle in first row
      const active1 = storage.tStateData[i];
      if (active1 == 1 && i > idx % numCols) {
        idx = numRowsTri * numCols + i;
      }
      // get right-most active circle in second row
      const active2 = storage.tStateData[i + numCols];
      if (active2 == 1 && i > idx % numCols) {
        idx = (numRowsTri + 1) * numCols + i;
      }
    }

    for (let i = numCols - 1; i >= 0; i--) {
      // get right-most active rect in first row
      const active1 = storage.rStateData[i];
      if (active1 == 1 && i > idx % numCols) {
        idx = (numRowsTri + numRowsCirc) * numCols + i;
      }
      // get right-most active rect in second row
      const active2 = storage.rStateData[i + numCols];
      if (active2 == 1 && i > idx % numCols) {
        idx = (numRowsTri + numRowsCirc + 1) * numCols + i;
      }
    }

    return idx > -1 ? idx * 2 : idx;
  }

  function update(time) {
    const bottomIdx = getBottomMostOffsetIdx();
    if (bottomIdx < 0 || dynamic.vOffset.data[bottomIdx] <= -0.86) {
      gameOver = true;
    }
    if (previousTimeStamp === undefined) {
      previousTimeStamp = time;
    }
    // shooter movement
    const shooterOffsetX = getShooterOffsetX();
    for (let i = 0; i < shooter.offsetData.length; i += 2) {
      shooter.offsetData[i] = shooterOffsetX;
    }
    device.queue.writeBuffer(shooter.offBuffer, 0, shooter.offsetData);

    // projectile animation
    for (let i = 0; i < projectiles.length; i++) {
      const p = projectiles[i];
      // remove if projectile hits target or goes off screen
      if (isCollision(p) || p.y >= 0.7) {
        projectiles.splice(i, 1);
        i--;
      } else {
        // update offset data with projectile x,y coords
        p.y += p.velocity;
        const xOffset = i * 2;
        const yOffset = xOffset + 1;
        projectile.offsetData[xOffset] = p.x;
        projectile.offsetData[yOffset] = p.y;
      }
    }
    device.queue.writeBuffer(projectile.offBuffer, 0, projectile.offsetData);

    const elapsed = time - previousTimeStamp;
    // invader animation
    if (elapsed >= tickPeriod) {
      const delta_time = elapsed * 0.001;
      previousTimeStamp = time;

      const leftIdx = getLeftMostOffset();
      const rightIdx = getRightMostOffset();
      if (currDir == 'right' && dynamic.vOffset.data[rightIdx] >= 0.92) {
        currDir = 'left';
        tickPeriod = Math.max(200, tickPeriod - 75);
        horizontalShiftFactor = Math.min(0.18, horizontalShiftFactor + 0.03);
        for (let i = 0; i < numRows * numCols; i++) {
          const offset = (i * dynamic.vOffset.unitSize) / 4 + 1;
          dynamic.vOffset.data[offset] -= downwardShift;
        }
      } else if (currDir == 'left' && dynamic.vOffset.data[leftIdx] <= -0.92) {
        currDir = 'right';
        tickPeriod = Math.max(200, tickPeriod - 75);
        horizontalShiftFactor = Math.min(0.18, horizontalShiftFactor + 0.03);
        for (let i = 0; i < numRows * numCols; i++) {
          const offset = (i * dynamic.vOffset.unitSize) / 4 + 1;
          dynamic.vOffset.data[offset] -= downwardShift;
        }
      } else {
        for (let i = 0; i < numRows * numCols; i++) {
          const offset = (i * dynamic.vOffset.unitSize) / 4;
          if (currDir == 'left') {
            dynamic.vOffset.data[offset] -= horizontalShiftFactor * delta_time;
          } else {
            dynamic.vOffset.data[offset] += horizontalShiftFactor * delta_time;
          }
        }
      }
      device.queue.writeBuffer(dynamic.vOffset.buffer, 0, dynamic.vOffset.data);
    }
  }

  function render() {
    // Get the current texture from the canvas context and
    // set it as the texture to render to.
    renderPassDescriptor.colorAttachments[0].view = canvas
      .getContext('webgpu')
      .getCurrentTexture()
      .createView();

    // make a command encoder to start encoding commands
    const encoder = device.createCommandEncoder({ label: 'encoder' });

    // make a render pass encoder to encode render specific commands
    const pass = encoder.beginRenderPass(renderPassDescriptor);
    pass.setPipeline(pipeline);
    // draw triangles
    pass.setBindGroup(0, tBindGroup);
    pass.setVertexBuffer(0, triangle.vBuffer);
    pass.setVertexBuffer(1, fixed.vScaleColour.buffer);
    pass.setVertexBuffer(2, dynamic.vOffset.buffer);
    pass.draw(triangle.numVertices, numRowsTri * numCols);
    // draw circles
    pass.setBindGroup(0, cBindGroup);
    pass.setVertexBuffer(0, circle.vBuffer);
    pass.setVertexBuffer(
      2,
      dynamic.vOffset.buffer,
      numRowsTri * numCols * dynamic.vOffset.unitSize
    );
    pass.setIndexBuffer(circle.idxBuffer, 'uint32');
    pass.drawIndexed(circle.numVertices, numRowsCirc * numCols);
    // draw rects
    pass.setBindGroup(0, rBindGroup);
    pass.setVertexBuffer(0, rect.vBuffer);
    pass.setVertexBuffer(
      2,
      dynamic.vOffset.buffer,
      (numRowsTri + numRowsCirc) * numCols * dynamic.vOffset.unitSize
    );
    pass.setIndexBuffer(rect.idxBuffer, 'uint32');
    pass.drawIndexed(rect.numVertices, numRowsRect * numCols);
    // draw shooter
    pass.setBindGroup(0, pBindGroup); // re-use projectile bg for shooter
    pass.setVertexBuffer(0, shooter.vBuffer);
    pass.setVertexBuffer(1, shooter.csBuffer);
    pass.setVertexBuffer(2, shooter.offBuffer);
    pass.setIndexBuffer(shooter.idxBuffer, 'uint32');
    pass.drawIndexed(shooter.numVertices);
    // draw projectiles
    pass.setVertexBuffer(0, projectile.vBuffer);
    pass.setVertexBuffer(1, projectile.csBuffer);
    pass.setVertexBuffer(2, projectile.offBuffer);
    pass.setIndexBuffer(projectile.idxBuffer, 'uint32');
    pass.drawIndexed(projectile.numVertices, Math.min(projectiles.length, MAX_PROJECTILES));
    pass.end();

    const commandBuffer = encoder.finish();
    device.queue.submit([commandBuffer]);
  }

  function mainLoop(time) {
    const stop = requestAnimationFrame(mainLoop);

    update(time);
    render();

    if (gameOver) {
      cancelAnimationFrame(stop);
      clearUserInputHandlers();
      resetGameState();
    }
  }

  function resizeCanvas(_) {
    const smaller = Math.min(window.innerWidth, window.innerHeight);
    const width = smaller;
    const height = smaller;
    // clamp canvas sizes to ensure WebGPU doesn't throw GPUValidationErrors
    const renderWidth = Math.max(1, Math.min(width, device.limits.maxTextureDimension2D));
    const renderHeight = Math.max(1, Math.min(height, device.limits.maxTextureDimension2D));
    canvas.width = renderWidth;
    canvas.height = renderHeight;
    canvas.style.width = `${renderWidth}px`;
    canvas.style.height = `${renderHeight}px`;
    render();
  }
  addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // start game button
  const button = document.getElementById('start-game');
  button.addEventListener(
    'click',
    (e) => {
      if (!startGame) {
        startGame = true;
        setupUserInputHandlers(projectiles);
        requestAnimationFrame(mainLoop);
        e.target.blur();
      }
    },
    false
  );
}

main();
