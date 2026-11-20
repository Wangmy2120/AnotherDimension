function makeRandom(seed) {
  let state = seed % 2147483647
  if (state <= 0) state += 2147483646
  return () => {
    state = state * 16807 % 2147483647
    return (state - 1) / 2147483646
  }
}

function drawBloom(context, random, size, elongated = false) {
  const lobes = elongated ? 3 : 4
  for (let index = 0; index < lobes; index += 1) {
    const radius = size * (0.15 + random() * 0.2)
    const x = size * (0.28 + random() * 0.44)
    const y = size * (0.3 + random() * 0.4)
    const stretchX = elongated ? 1.55 + random() * 0.8 : 0.78 + random() * 0.5
    const stretchY = elongated ? 0.38 + random() * 0.2 : 0.7 + random() * 0.55
    const rotation = elongated ? -0.55 + random() * 0.28 : random() * Math.PI
    const gradient = context.createRadialGradient(0, 0, 0, 0, 0, radius)
    const strength = 0.12 + random() * 0.11
    gradient.addColorStop(0, `rgba(247,248,246,${strength})`)
    gradient.addColorStop(0.3, `rgba(237,239,237,${strength * 0.72})`)
    gradient.addColorStop(0.68, `rgba(232,234,232,${strength * 0.24})`)
    gradient.addColorStop(1, 'rgba(228,230,228,0)')
    context.save()
    context.translate(x, y)
    context.rotate(rotation)
    context.scale(stretchX, stretchY)
    context.fillStyle = gradient
    context.beginPath()
    context.arc(0, 0, radius, 0, Math.PI * 2)
    context.fill()
    context.restore()
  }
}

function drawDryStroke(context, random, size) {
  context.save()
  context.lineCap = 'round'
  for (let index = 0; index < 4; index += 1) {
    const startY = size * (0.2 + random() * 0.55)
    const length = size * (0.25 + random() * 0.4)
    context.beginPath()
    context.moveTo(size * (0.08 + random() * 0.12), startY)
    context.quadraticCurveTo(size * 0.5, startY + (random() - 0.5) * 22, size * (0.08 + random() * 0.12) + length, startY + (random() - 0.5) * 16)
    context.strokeStyle = `rgba(242,244,242,${0.035 + random() * 0.05})`
    context.lineWidth = 0.8 + random() * 2.2
    context.stroke()
  }
  context.globalCompositeOperation = 'destination-out'
  for (let index = 0; index < 26; index += 1) {
    context.fillStyle = `rgba(0,0,0,${0.18 + random() * 0.45})`
    context.beginPath()
    context.ellipse(size * random(), size * random(), 0.8 + random() * 3.8, 0.3 + random() * 1.1, random() * Math.PI, 0, Math.PI * 2)
    context.fill()
  }
  context.restore()
}

function drawFlecks(context, random, size) {
  for (let index = 0; index < 34; index += 1) {
    const radius = 0.35 + random() * 1.45
    const alpha = 0.12 + random() * 0.26
    context.fillStyle = `rgba(244,246,244,${alpha})`
    context.beginPath()
    context.arc(size * (0.12 + random() * 0.76), size * (0.12 + random() * 0.76), radius, 0, Math.PI * 2)
    context.fill()
  }
}

export function createInkBrushSprites(count = 6, size = 128) {
  return Array.from({ length: count }, (_, index) => {
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const context = canvas.getContext('2d')
    const random = makeRandom(5107 + index * 7919)
    if (index === 0 || index === 3) drawBloom(context, random, size, false)
    if (index === 1) drawBloom(context, random, size, true)
    if (index === 2) {
      drawBloom(context, random, size, true)
      drawDryStroke(context, random, size)
    }
    if (index === 4) {
      drawBloom(context, random, size, false)
      drawFlecks(context, random, size)
    }
    if (index === 5) {
      drawBloom(context, random, size, false)
      drawDryStroke(context, random, size)
      drawFlecks(context, random, size)
    }
    return canvas
  })
}
