import * as fs from 'fs';
import * as path from 'path';
import { createRequire } from 'node:module';

export type PackageJson = {
  name: string,
  dependencies?: Record<string, string>,
  devDependencies?: Record<string, string>,
};

const require = createRequire(import.meta.url);

export function getDependencies(): string[] {

  // Note: this resolve() is relative to CWD, not this source file.
  const packageJsonFilePath = path.resolve('./package.json');
  const packageJsonFileContents = fs.readFileSync(packageJsonFilePath, 'utf-8');
  const packageJson = JSON.parse(packageJsonFileContents) as PackageJson;

  return [
    ...Object.keys(packageJson.dependencies ?? {}),
    ...Object.keys(packageJson.devDependencies ?? {}),
  ];

}

export function applyToPackages<TPackageJson extends PackageJson>(
  packageNames: string[],
  action: (packageJson: TPackageJson, ctx: { packageName: string, packagePath: string }) => void,
) {

  for (const packageName of packageNames) {

    let packageJsonFilePath: string;
    try {
      packageJsonFilePath = require.resolve(packageName + '/package.json');
    } catch {
      console.warn(`Unable to resolve package.json for package '${packageName}'.`);
      continue;
    }

    let packageJson: TPackageJson;
    try {
      const packageJsonFileContents = fs.readFileSync(packageJsonFilePath, 'utf-8');
      packageJson = JSON.parse(packageJsonFileContents) as TPackageJson;
    } catch(ex) {
      console.warn(new Error(`Unable to read or parse '${packageJsonFilePath}'`, { cause: ex }));
      continue;
    }

    const packagePath = path.dirname(packageJsonFilePath);

    action(packageJson, { packageName, packagePath });

  }

}
