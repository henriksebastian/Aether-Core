// WGSL Compute Shader: 10,000-Path Monte Carlo Price Cone with Jump Diffusion
struct MCParams {
  spotPrice: f32,
  drift: f32,
  volatility: f32,
  timeHorizonSec: f32,
  timeSteps: u32,
  totalPaths: u32,
  jumpIntensity: f32,
  jumpMean: f32,
};

@group(0) @binding(0) var<uniform> params: MCParams;
@group(0) @binding(1) var<storage, read_write> pathOutputs: array<f32>; // [totalPaths * timeSteps]

// High-performance hash PRNG
fn hash(s: u32) -> u32 {
  var x = s;
  x = x ^ (x >> 16u);
  x = x * 0x7feb352du;
  x = x ^ (x >> 15u);
  x = x * 0x846ca68bu;
  x = x ^ (x >> 16u);
  return x;
}

// Box-Muller normal distribution sample
fn sampleGaussian(seed1: u32, seed2: u32) -> vec2<f32> {
  let u1 = max(f32(hash(seed1)) / 4294967295.0, 1e-7);
  let u2 = f32(hash(seed2)) / 4294967295.0;
  let r = sqrt(-2.0 * log(u1));
  let theta = 6.2831853 * u2;
  return vec2<f32>(r * cos(theta), r * sin(theta));
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let pathIdx = global_id.x;
  if (pathIdx >= params.totalPaths) {
    return;
  }

  let dt = params.timeHorizonSec / f32(params.timeSteps);
  let sqrtDt = sqrt(dt);
  let driftTerm = (params.drift - 0.5 * params.volatility * params.volatility) * dt;

  var currentPrice = params.spotPrice;
  var seed = pathIdx * 1973u + 9277u;

  for (var t: u32 = 0u; t < params.timeSteps; t = t + 1u) {
    seed = seed + t * 31u + 7u;
    let normalPair = sampleGaussian(seed, seed ^ 0x5bf03635u);
    let z = normalPair.x;

    // Optional Jump-diffusion component
    var jump: f32 = 0.0;
    let jumpRand = f32(hash(seed * 17u)) / 4294967295.0;
    if (jumpRand < params.jumpIntensity * dt) {
      jump = params.jumpMean + normalPair.y * 0.02;
    }

    currentPrice = currentPrice * exp(driftTerm + params.volatility * sqrtDt * z + jump);
    let outIdx = pathIdx * params.timeSteps + t;
    pathOutputs[outIdx] = currentPrice;
  }
}
