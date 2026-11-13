// paroxysm: new tab background (Three.js).
//
// Everything you are likely to want to change is in CONFIG below.
// Three.js is loaded from a CDN by newtab.html; if it can't be loaded (offline, blocked)
// the page falls back to a plain gradient and nothing else is affected.
(() => {
    const CONFIG = {
        // Colour stops from dark to light, spread evenly across the bands. 2 to 6 colours.
        colors: ["#a855f7"],

        speed: 0.12,        // how fast the bands drift (0 = still)
        warp: 1,         // how strongly the bands bend
        bands: 6,         // how many bands fit across the screen
        sharpness: 1.7,     // higher = thinner, more contrasty bands
        angle: 0.65,        // direction of the flow, in radians
        brightness: 0.40,   // overall brightness (keep it low so text stays readable)
        vignette: 0.82,     // how much the edges darken (0 = none, 1 = strong)
        grain: 2.0,         // fine dither against banding, in 1/255 steps (0 = off)

        resolution: 0.5,    // render scale: 1 = full, 0.5 = half (cheaper, still smooth)
        fps: 30             // frame-rate cap
    };

    const canvas = document.getElementById("bg");
    if (!canvas) return;

    function fallback(reason) {
        if (reason) console.warn("[paroxysm] background unavailable:", reason);
        document.body.classList.add("no-webgl");
        canvas.remove();
    }

    if (!window.THREE) return fallback("Three.js did not load");

    const MAX_COLORS = 6;

    const VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
    `;

    const FRAG = `
#define MAX_COLORS ${MAX_COLORS}
uniform vec2 uCanvas;
uniform float uTime;
uniform float uSpeed;
uniform vec2 uRot;
uniform int uColorCount;
uniform vec3 uColors[MAX_COLORS];
uniform int uTransparent;
uniform float uScale;
uniform float uFrequency;
uniform float uWarpStrength;
uniform vec2 uPointer; // in NDC [-1,1]
uniform float uMouseInfluence;
uniform float uParallax;
uniform float uNoise;
uniform int uIterations;
uniform float uIntensity;
uniform float uBandWidth;
varying vec2 vUv;

void main() {
  float t = uTime * uSpeed;
  vec2 p = vUv * 2.0 - 1.0;
  p += uPointer * uParallax * 0.1;
  vec2 rp = vec2(p.x * uRot.x - p.y * uRot.y, p.x * uRot.y + p.y * uRot.x);
  vec2 q = vec2(rp.x * (uCanvas.x / uCanvas.y), rp.y);
  q /= max(uScale, 0.0001);
  q /= 0.5 + 0.2 * dot(q, q);
  q += 0.2 * cos(t) - 7.56;
  vec2 shift = vec2(0.2 * cos(t) - 7.56);
  vec2 toward = (uPointer - rp);
  q += toward * uMouseInfluence * 0.2;

    for (int j = 0; j < 5; j++) {
      if (j >= uIterations - 1) break;
      vec2 rr = sin(1.5 * (q.yx * uFrequency) + 2.0 * cos(q * uFrequency));
      q += (rr - q) * 0.15;
      shift *= 0.85;
    }

    vec3 col = vec3(0.0);
    float a = 1.0;

    if (uColorCount > 0) {
      vec2 s = q;
      vec3 sumCol = vec3(0.0);
      float cover = 0.0;
      for (int i = 0; i < MAX_COLORS; ++i) {
            if (i >= uColorCount) break;
            s -= 0.01;
            vec2 r = sin(1.5 * (s.yx * uFrequency) + 2.0 * cos(s * uFrequency));
            float m0 = length(r + sin(5.0 * r.y * uFrequency - 3.0 * t + float(i)) / 4.0);
            float kBelow = clamp(uWarpStrength, 0.0, 1.0);
            float kMix = pow(kBelow, 0.3); // strong response across 0..1
            float gain = 1.0 + max(uWarpStrength - 1.0, 0.0); // allow >1 to amplify displacement
            vec2 disp = (r - s) * kBelow;
            vec2 warped = s + disp * gain;
            float spare = 1.0 - kBelow * gain;
            if (spare != 0.0) warped -= shift * spare;
            float m1 = length(warped + sin(5.0 * warped.y * uFrequency - 3.0 * t + float(i)) / 4.0);
            float m = mix(m0, m1, kMix);
            float w = 1.0 - exp(-uBandWidth / exp(uBandWidth * m));
            sumCol += uColors[i] * w;
            cover = max(cover, w);
      }
      col = clamp(sumCol, 0.0, 1.0);
      a = uTransparent > 0 ? cover : 1.0;
    } else {
        vec2 s = q;
        for (int k = 0; k < 3; ++k) {
            s -= 0.01;
            vec2 r = sin(1.5 * (s.yx * uFrequency) + 2.0 * cos(s * uFrequency));
            float m0 = length(r + sin(5.0 * r.y * uFrequency - 3.0 * t + float(k)) / 4.0);
            float kBelow = clamp(uWarpStrength, 0.0, 1.0);
            float kMix = pow(kBelow, 0.3);
            float gain = 1.0 + max(uWarpStrength - 1.0, 0.0);
            vec2 disp = (r - s) * kBelow;
            vec2 warped = s + disp * gain;
            float spare = 1.0 - kBelow * gain;
            if (spare != 0.0) warped -= shift * spare;
            float m1 = length(warped + sin(5.0 * warped.y * uFrequency - 3.0 * t + float(k)) / 4.0);
            float m = mix(m0, m1, kMix);
            col[k] = 1.0 - exp(-uBandWidth / exp(uBandWidth * m));
        }
        a = uTransparent > 0 ? max(max(col.r, col.g), col.b) : 1.0;
    }

    col *= uIntensity;

    if (uNoise > 0.0001) {
      float n = fract(sin(dot(gl_FragCoord.xy + vec2(uTime), vec2(12.9898, 78.233))) * 43758.5453123);
      col += (n - 0.5) * uNoise;
      col = clamp(col, 0.0, 1.0);
    }

    vec3 rgb = (uTransparent > 0) ? col * a : col;
    gl_FragColor = vec4(rgb, a);
}
    `;

    let renderer, material, scene, camera;
    try {
        renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: "low-power" });
        renderer.setPixelRatio(CONFIG.resolution);

        const colors = CONFIG.colors.slice(0, MAX_COLORS).map(c => new THREE.Color(c));
        while (colors.length < 2) colors.push(colors[0] ?? new THREE.Color("#000000"));
        const count = colors.length;
        while (colors.length < MAX_COLORS) colors.push(colors[count - 1]);

        material = new THREE.ShaderMaterial({
            vertexShader: VERT,
            fragmentShader: FRAG,
            depthTest: false,
            depthWrite: false,
            uniforms: {
                uRes:      { value: new THREE.Vector2(1, 1) },
                uTime:     { value: 0 },
                uColors:   { value: colors },
                uCount:    { value: count },
                uWarp:     { value: CONFIG.warp },
                uBands:    { value: CONFIG.bands },
                uSharp:    { value: CONFIG.sharpness },
                uAngle:    { value: CONFIG.angle },
                uBright:   { value: CONFIG.brightness },
                uVignette: { value: CONFIG.vignette },
                uGrain:    { value: CONFIG.grain }
            }
        });

        scene = new THREE.Scene();
        camera = new THREE.Camera();
        scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));
    } catch (e) {
        return fallback(e.message);
    }

    const size = new THREE.Vector2();
    const FRAME_MS = 1000 / CONFIG.fps;
    const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const wantsMotion = () => CONFIG.speed > 0 && !reduceMotion && paroxysmSettings.get().animatedBackground !== false;
    const start = performance.now();
    let last = 0;
    let raf = 0;

    function draw(seconds) {
        const w = Math.max(2, canvas.clientWidth);
        const h = Math.max(2, canvas.clientHeight);
        renderer.setSize(w, h, false);
        renderer.getDrawingBufferSize(size);
        material.uniforms.uRes.value.copy(size);
        material.uniforms.uTime.value = (seconds + 20) * CONFIG.speed;
        renderer.render(scene, camera);
    }

    function frame(now) {
        raf = requestAnimationFrame(frame);
        if (now - last < FRAME_MS) return;
        last = now;
        draw((now - start) / 1000);
    }

    const startLoop = () => { if (!raf && wantsMotion()) raf = requestAnimationFrame(frame); };
    const stopLoop = () => { cancelAnimationFrame(raf); raf = 0; };

    document.addEventListener("visibilitychange", () => (document.hidden ? stopLoop() : startLoop()));
    addEventListener("resize", () => draw((performance.now() - start) / 1000));
    canvas.addEventListener("webglcontextlost", e => { e.preventDefault(); stopLoop(); fallback("WebGL context lost"); });

    // Settings > Appearance > Animated background
    paroxysmSettings.onChange(() => { if (wantsMotion()) startLoop(); else stopLoop(); });

    draw(12);                    // first frame straight away (also the still frame when motion is off)
    canvas.classList.add("ready");
    startLoop();
})();