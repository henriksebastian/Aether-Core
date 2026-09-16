// WGSL Compute Shader: Volumetric Order-Book Depth Kernel Density Estimation (KDE)
struct Level {
  price: f32,
  quantity: f32,
  side: f32, // 0 = bid, 1 = ask
  padding: f32,
};

struct Uniforms {
  minPrice: f32,
  maxPrice: f32,
  timeSlots: u32,
  priceBins: u32,
  bandwidth: f32,
  numLevels: u32,
  currentTime: f32,
  padding: f32,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> levels: array<Level>;
@group(0) @binding(2) var<storage, read_write> heatmapOutput: array<f32>;

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let timeIdx = global_id.x;
  let priceIdx = global_id.y;

  if (timeIdx >= uniforms.timeSlots || priceIdx >= uniforms.priceBins) {
    return;
  }

  let priceNorm = f32(priceIdx) / f32(uniforms.priceBins);
  let evalPrice = uniforms.minPrice + priceNorm * (uniforms.maxPrice - uniforms.minPrice);
  let h = max(uniforms.bandwidth, 0.5);

  var density: f32 = 0.0;
  for (var i: u32 = 0u; i < uniforms.numLevels; i = i + 1u) {
    let lvl = levels[i];
    let diff = (evalPrice - lvl.price) / h;
    // Gaussian kernel
    let kernel = exp(-0.5 * diff * diff) / (h * 2.506628);
    density = density + lvl.quantity * kernel;
  }

  let outIdx = timeIdx * uniforms.priceBins + priceIdx;
  heatmapOutput[outIdx] = density;
}
