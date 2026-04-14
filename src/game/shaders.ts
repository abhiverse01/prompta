/* ═══════════════════════════════════════════════════════════════════════
   GLSL Shader strings – terrain, water, sky
   ═══════════════════════════════════════════════════════════════════════ */

// ── Terrain ──────────────────────────────────────────────────────────

export const terrainVertexShader = /* glsl */ `
varying float vHeight;
varying vec3  vNormal;
varying vec3  vWorldPos;

void main() {
  vHeight   = position.y;
  vNormal   = normalize(normalMatrix * normal);
  vec4 wp   = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const terrainFragmentShader = /* glsl */ `
precision highp float;

uniform vec3  uSunDir;
uniform float uFogNear;
uniform float uFogFar;
uniform vec3  uFogColor;

varying float vHeight;
varying vec3  vNormal;
varying vec3  vWorldPos;

void main() {
  /* ── Height-based coloring with smooth transitions ─────────── */
  vec3 sand  = vec3(0.76, 0.70, 0.50);
  vec3 grass = vec3(0.30, 0.58, 0.18);
  vec3 dirt  = vec3(0.50, 0.38, 0.22);
  vec3 rock  = vec3(0.45, 0.42, 0.38);
  vec3 snow  = vec3(0.94, 0.94, 0.96);

  float h = vHeight;
  vec3 base;
  if      (h < 4.0)  base = sand;
  else if (h < 9.0)  base = mix(sand,  grass, smoothstep(4.0, 9.0, h));
  else if (h < 32.0) base = mix(grass, dirt,  smoothstep(9.0, 32.0, h));
  else if (h < 55.0) base = mix(dirt,  rock,  smoothstep(32.0, 55.0, h));
  else                base = mix(rock,  snow,  smoothstep(55.0, 75.0, h));

  /* ── Diffuse + ambient lighting ────────────────────────────── */
  float diff   = max(dot(normalize(vNormal), normalize(uSunDir)), 0.0);
  float ambient = 0.30;
  vec3  color  = base * (ambient + diff * 0.70);

  /* ── Distance fog ──────────────────────────────────────────── */
  float dist = length(vWorldPos - cameraPosition);
  float fog  = smoothstep(uFogNear, uFogFar, dist);
  color = mix(color, uFogColor, fog);

  gl_FragColor = vec4(color, 1.0);
}
`;

// ── Water ────────────────────────────────────────────────────────────

export const waterVertexShader = /* glsl */ `
uniform float uTime;
varying vec2  vUv;
varying vec3  vWorldPos;

void main() {
  vUv = uv;
  vec3 pos = position;
  /* gentle sine waves */
  pos.y += sin(pos.x * 0.05 + uTime) * 0.6
         + sin(pos.z * 0.07 + uTime * 1.3) * 0.4;
  vec4 wp = modelMatrix * vec4(pos, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const waterFragmentShader = /* glsl */ `
precision highp float;

uniform float uTime;
uniform vec3  uFogColor;
uniform float uFogNear;
uniform float uFogFar;

varying vec2  vUv;
varying vec3  vWorldPos;

void main() {
  /* base colour with subtle depth variation */
  float depth = sin(vUv.x * 40.0 + uTime * 0.5) * 0.03
              + sin(vUv.y * 30.0 - uTime * 0.3) * 0.02;
  vec3 base = vec3(0.05, 0.25, 0.55) + depth;

  /* simple specular highlight */
  float spec = pow(max(sin(vUv.x * 60.0 + vUv.y * 40.0 + uTime * 2.0), 0.0), 16.0) * 0.15;
  base += vec3(spec);

  /* distance fog */
  float dist = length(vWorldPos - cameraPosition);
  float fog  = smoothstep(uFogNear * 0.8, uFogFar, dist);
  vec3 color = mix(base, uFogColor, fog);

  gl_FragColor = vec4(color, 0.75);
}
`;

// ── Sky / Atmosphere ─────────────────────────────────────────────────

export const skyVertexShader = /* glsl */ `
varying vec3 vDir;

void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const skyFragmentShader = /* glsl */ `
precision highp float;

uniform vec3  uSunDir;
uniform float uDayProgress;   // 0 → midnight, 0.5 → noon, 1 → midnight
varying vec3  vDir;

void main() {
  vec3 dir = normalize(vDir);
  float y  = dir.y * 0.5 + 0.5;                    // 0 horizon → 1 zenith

  /* colour palettes for different times */
  vec3 dayTop    = vec3(0.25, 0.55, 1.00);
  vec3 dayBot    = vec3(0.60, 0.82, 1.00);
  vec3 sunsetTop = vec3(0.10, 0.12, 0.35);
  vec3 sunsetBot = vec3(0.85, 0.40, 0.15);
  vec3 nightTop  = vec3(0.01, 0.01, 0.06);
  vec3 nightBot  = vec3(0.03, 0.03, 0.10);

  /* four-way lerp through the day cycle */
  float t = uDayProgress;
  vec3 top, bot;
  if      (t < 0.25) { float f = t / 0.25;       top = mix(nightTop,  sunsetTop, f); bot = mix(nightBot,  sunsetBot, f); }
  else if (t < 0.50) { float f = (t - 0.25) / 0.25; top = mix(sunsetTop, dayTop, f);    bot = mix(sunsetBot, dayBot, f); }
  else if (t < 0.75) { float f = (t - 0.50) / 0.25; top = mix(dayTop,    sunsetTop, f); bot = mix(dayBot,    sunsetBot, f); }
  else               { float f = (t - 0.75) / 0.25; top = mix(sunsetTop, nightTop, f);  bot = mix(sunsetBot, nightBot, f); }

  vec3 sky = mix(bot, top, y);

  /* sun disc + glow */
  float sunDot = dot(dir, normalize(uSunDir));
  if (sunDot > 0.995) sky += vec3(1.0, 0.95, 0.8) * pow((sunDot - 0.995) / 0.005, 1.5) * 2.0;
  float glow = pow(max(sunDot, 0.0), 64.0);
  sky += vec3(0.4, 0.35, 0.2) * glow * 0.8;

  /* stars at night */
  float nightness = smoothstep(0.30, 0.10, t) + smoothstep(0.70, 0.90, t);
  nightness = clamp(nightness, 0.0, 1.0);
  if (nightness > 0.01 && dir.y > 0.0) {
    float star = fract(sin(dot(floor(dir * 600.0), vec3(12.9898, 78.233, 45.164))) * 43758.5453);
    if (star > 0.997) sky += vec3(1.0) * nightness * (star - 0.997) / 0.003;
  }

  gl_FragColor = vec4(sky, 1.0);
}
`;
