// WGSL Compute Shader: Hawkes Cascade Intensity Point Process
struct HawkesEvent {
  timestampSec: f32,
  magnitude: f32,
  side: f32, // 0 = buy, 1 = sell
  padding: f32,
};

struct HawkesParams {
  baseIntensity: f32,
  alphaExcitation: f32,
  betaDecay: f32,
  numEvents: u32,
  evalTimeSec: f32,
  evalSteps: u32,
};

@group(0) @binding(0) var<uniform> params: HawkesParams;
@group(0) @binding(1) var<storage, read> events: array<HawkesEvent>;
@group(0) @binding(2) var<storage, read_write> intensityOutput: array<f32>; // [evalSteps]

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let stepIdx = global_id.x;
  if (stepIdx >= params.evalSteps) {
    return;
  }

  let t = params.evalTimeSec - f32(params.evalSteps - 1u - stepIdx) * 0.1;
  var intensity = params.baseIntensity;

  for (var i: u32 = 0u; i < params.numEvents; i = i + 1u) {
    let evt = events[i];
    if (evt.timestampSec <= t) {
      let deltaT = t - evt.timestampSec;
      if (deltaT < 10.0) { // cut off decay tail for performance
        let kernel = params.alphaExcitation * exp(-params.betaDecay * deltaT);
        intensity = intensity + evt.magnitude * kernel;
      }
    }
  }

  intensityOutput[stepIdx] = intensity;
}
