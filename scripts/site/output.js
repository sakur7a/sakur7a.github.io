import path from 'node:path';

export const outputDirectory = path.resolve(import.meta.dirname, '../../dist');

export function outputFile(pathname) {
  const name = decodeURIComponent(pathname).replace(/^\//, '');
  const file = path.resolve(outputDirectory, name);
  const relative = path.relative(outputDirectory, file);
  if (path.isAbsolute(relative) || relative === '..' || relative.startsWith('..' + path.sep)) {
    throw new Error(`Path is outside the site output: ${pathname}`);
  }
  return file;
}
