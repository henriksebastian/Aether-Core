/// <reference types="vite/client" />

declare module '*.wgsl?raw' {
  const content: string;
  export default content;
}

declare module '*.wgsl' {
  const content: string;
  export default content;
}

type GPUDevice = any;
type GPUAdapter = any;
type GPUBuffer = any;
type GPUComputePipeline = any;
type GPUBindGroup = any;
