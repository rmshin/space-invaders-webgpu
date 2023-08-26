let keyStates = {};
let shooterOffsetX = 0;
let keycheckStop;

function handleKeydownEvent(e) {
  const keyName = e.key;
  switch (keyName) {
    case 'ArrowLeft':
      keyStates[keyName] = true;
      keyStates['ArrowRight'] = false;
      break;
    case 'ArrowRight':
      keyStates[keyName] = true;
      keyStates['ArrowLeft'] = false;
      break;
    // TODO: handle shoot projectile
    case ' ':
      keyStates['Space'] = true;
      break;
    default:
      break;
  }
}

function handleKeyupEvent(e) {
  const keyName = e.key;
  switch (keyName) {
    case 'ArrowLeft':
      keyStates[keyName] = false;
      break;
    case 'ArrowRight':
      keyStates[keyName] = false;
      break;
    case ' ':
      keyStates['Space'] = false;
      break;
    default:
      break;
  }
}

let previousTimeStamp;
const tickPeriod = 35;
let nextProjectileTimeStamp = performance.now();
const projectileDebounce = 200;
const shooterOffsetY = -0.2 * 0.12 - 0.85; // hardcoded values from vertex-data.js
function checkKeyStates(projectilesArr) {
  return function (time) {
    if (previousTimeStamp === undefined) {
      previousTimeStamp = time;
    }

    const elapsed = time - previousTimeStamp;
    if (elapsed >= tickPeriod) {
      const delta_time = elapsed * 0.01;
      previousTimeStamp = time;

      if (keyStates['ArrowLeft'] && shooterOffsetX > -0.9) {
        shooterOffsetX -= 0.05 * delta_time;
      } else if (keyStates['ArrowRight'] && shooterOffsetX < 0.9) {
        shooterOffsetX += 0.05 * delta_time;
      }
    }
    // projectile updates
    if (keyStates['Space'] && time >= nextProjectileTimeStamp && projectilesArr.length < 1) {
      nextProjectileTimeStamp = time + projectileDebounce;
      projectilesArr.push({ x: shooterOffsetX, y: shooterOffsetY, velocity: 0.01 });
    }

    keycheckStop = requestAnimationFrame(checkKeyStates(projectilesArr));
  };
}

function setupUserInputHandlers(projectilesArr) {
  document.addEventListener('keydown', handleKeydownEvent, false);
  document.addEventListener('keyup', handleKeyupEvent, false);

  requestAnimationFrame(checkKeyStates(projectilesArr));
}

function clearUserInputHandlers() {
  document.removeEventListener('keydown', handleKeydownEvent);
  document.removeEventListener('keyup', handleKeyupEvent);
  cancelAnimationFrame(keycheckStop);
  shooterOffsetX = 0;
  keyStates = {};
}

function getShooterOffsetX() {
  return shooterOffsetX;
}

export { setupUserInputHandlers, clearUserInputHandlers, getShooterOffsetX };
