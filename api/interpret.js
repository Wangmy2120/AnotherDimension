import { createInterpretHandler } from '../server/ai-interpret.js'

const handleInterpret = createInterpretHandler(process.env)

export default function handler(req, res) {
  return handleInterpret(req, res)
}
