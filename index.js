import {
  setup,
  setupVertexBuffers,
  setupVertexAttributeBuffers,
  setupShooterBuffers,
  setupProjectileBuffers,
} from './webgpu.js';
import { setupUserInputHandlers, clearUserInputHandlers, getShooterOffsetX } from './user-input.js';
import { getVertexOffsetData } from './vertex-data.js';

const MAX_PROJECTILES = 20;

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
  const { projectile } = setupProjectileBuffers(device);

  // game state
  let startGame = false;
  let gameOver = false;

  // update
  let currDir = 'right';
  let previousTimeStamp;
  let horizontalShiftFactor = 0.03;
  let downwardShift = 0.05;
  let tickPeriod = 650;

  // TODO: update these values based off user keyboard input
  const projectiles = [{ x: 0, y: -0.9, velocity: 0.01 }];

  function resetGameState() {
    // reset game flags
    startGame = false;
    gameOver = false;
    // reset update vars
    currDir = 'right';
    previousTimeStamp = undefined;
    horizontalShiftFactor = 0.03;
    tickPeriod = 650;
    // reset invader positions
    const initial = getVertexOffsetData(numRows, numCols).vOffsetData;
    dynamic.vOffset.data = initial;
    device.queue.writeBuffer(dynamic.vOffset.buffer, 0, dynamic.vOffset.data);
  }

  function update(time) {
    // TEMP: hard-coded game over condition
    if (dynamic.vOffset.data[dynamic.vOffset.data.length - 1] <= -0.87) {
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

    // TODO: check if projectile collides with invader or goes off screen
    // TODO: projectile animation

    // invader animation
    const elapsed = time - previousTimeStamp;
    if (elapsed >= tickPeriod) {
      const delta_time = elapsed * 0.001;
      previousTimeStamp = time;

      if (currDir == 'right' && dynamic.vOffset.data[dynamic.vOffset.data.length - 2] >= 0.92) {
        currDir = 'left';
        tickPeriod = Math.max(300, tickPeriod - 75);
        horizontalShiftFactor = Math.min(0.15, horizontalShiftFactor + 0.03);
        for (let i = 0; i < numRows * numCols; i++) {
          const offset = (i * dynamic.vOffset.unitSize) / 4 + 1;
          dynamic.vOffset.data[offset] -= downwardShift;
        }
      } else if (currDir == 'left' && dynamic.vOffset.data[0] <= -0.92) {
        currDir = 'right';
        tickPeriod = Math.min(300, tickPeriod - 75);
        horizontalShiftFactor = Math.min(0.15, horizontalShiftFactor + 0.03);
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
    pass.setVertexBuffer(0, triangle.vBuffer);
    pass.setVertexBuffer(1, fixed.vScaleColour.buffer);
    pass.setVertexBuffer(2, dynamic.vOffset.buffer);
    pass.draw(triangle.numVertices, numRowsTri * numCols);
    // draw circles
    pass.setVertexBuffer(0, circle.vBuffer);
    pass.setVertexBuffer(
      2,
      dynamic.vOffset.buffer,
      numRowsTri * numCols * dynamic.vOffset.unitSize
    );
    pass.setIndexBuffer(circle.idxBuffer, 'uint32');
    pass.drawIndexed(circle.numVertices, numRowsCirc * numCols);
    // draw rects
    pass.setVertexBuffer(0, rect.vBuffer);
    pass.setVertexBuffer(
      2,
      dynamic.vOffset.buffer,
      (numRowsTri + numRowsCirc) * numCols * dynamic.vOffset.unitSize
    );
    pass.setIndexBuffer(rect.idxBuffer, 'uint32');
    pass.drawIndexed(rect.numVertices, numRowsRect * numCols);
    // draw shooter
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
        setupUserInputHandlers();
        requestAnimationFrame(mainLoop);
        e.target.blur();
      }
    },
    false
  );
}

main();
