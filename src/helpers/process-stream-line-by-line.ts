import { Readable } from 'stream';

export function processStreamByLine(stream: Readable, onLine: (line: string) => void): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let leftover: string = '';
    stream.on('data', (chunk: Buffer) => {
      stream.pause();
      const data = leftover + chunk.toString();
      const lines = data.split('\n');
      leftover = lines.pop() ?? '';
      for (const line of lines) {
        onLine(line);
      }
      stream.resume();
    });
    stream.on('end', async () => {
      if (leftover) {
        await onLine(leftover);
      }
      resolve();
    });
    stream.on('error', (error: Error) => reject(error));
  });
}
