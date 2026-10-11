import { createReadStream } from 'node:fs'

export interface ReadResult {
  /** Bytes consumed through the last *complete* line — a half-written tail is re-read next pass. */
  offset: number
  lines: number
}

export async function readLinesFrom(
  file: string,
  start: number,
  onLine: (line: string) => void
): Promise<ReadResult> {
  let read = 0
  let lines = 0
  let leftover: Buffer<ArrayBufferLike> = Buffer.alloc(0)

  const stream = createReadStream(file, { start })
  try {
    for await (const chunk of stream) {
      read += (chunk as Buffer).length
      let buf: Buffer<ArrayBufferLike> = leftover.length
        ? Buffer.concat([leftover, chunk as Buffer])
        : (chunk as Buffer)
      let from = 0
      let nl: number
      while ((nl = buf.indexOf(0x0a, from)) !== -1) {
        if (nl > from) {
          onLine(buf.subarray(from, nl).toString('utf8'))
          lines++
        }
        from = nl + 1
      }
      leftover = buf.subarray(from)
    }
  } finally {
    stream.destroy()
  }

  return { offset: start + read - leftover.length, lines }
}
