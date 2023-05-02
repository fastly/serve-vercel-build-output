export type TransformContext = {
  transformName: string,             // package name of the transform
  transformScript: string,           // script name within package
  functionPath: string,              // relative function path (relative to vercel output dir)
  functionFilesSourcePath: string,   // full local path to original copy of function files
  functionFilesTargetPath: string,   // full local path to default target copy of function files
  nextProjectPath: string,           // full local path to project files
  buildOutputPath: string,           // full local path to build output path
};

export type VcFrameworkDef = {
  slug: string,
  version: string,
};

export type VcConfigEdge = {
  runtime: 'edge',
  deploymentTarget: 'v8-worker',
  name: string,
  entrypoint: string,
  envVarsInUse?: string[],
  assets?: string[],
  framework?: VcFrameworkDef,
};
