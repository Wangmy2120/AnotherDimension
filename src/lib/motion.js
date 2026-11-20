const callbacks = new Set()
let frame = 0
let previous = 0

function tick(time) {
  const delta = previous ? Math.min(48, time - previous) : 16.67
  previous = time
  callbacks.forEach(callback => callback(time, delta))
  frame = callbacks.size && !document.hidden ? requestAnimationFrame(tick) : 0
}

function start() {
  if (!frame && callbacks.size && !document.hidden) {
    previous = 0
    frame = requestAnimationFrame(tick)
  }
}

function handleVisibility() {
  if (document.hidden) {
    cancelAnimationFrame(frame)
    frame = 0
    previous = 0
  } else {
    start()
  }
}

document.addEventListener('visibilitychange', handleVisibility)

export function subscribeMotion(callback) {
  callbacks.add(callback)
  start()
  return () => {
    callbacks.delete(callback)
    if (!callbacks.size) {
      cancelAnimationFrame(frame)
      frame = 0
      previous = 0
    }
  }
}
