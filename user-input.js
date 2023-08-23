const keyStates = {};
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
    default:
      break;
  }
}

let previousTimeStamp;
const tickPeriod = 35;
function checkKeyStates(time) {
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

  keycheckStop = requestAnimationFrame(checkKeyStates);
}

function setupUserInputHandlers() {
  document.addEventListener('keydown', handleKeydownEvent, false);
  document.addEventListener('keyup', handleKeyupEvent, false);

  requestAnimationFrame(checkKeyStates);
}

function clearUserInputHandlers() {
  document.removeEventListener('keydown', handleKeydownEvent);
  document.removeEventListener('keyup', handleKeyupEvent);
  cancelAnimationFrame(keycheckStop);
  shooterOffsetX = 0;
}

function getShooterOffsetX() {
  return shooterOffsetX;
}

export { setupUserInputHandlers, clearUserInputHandlers, getShooterOffsetX };
