// Home page background: React Bits "Color Bends" (MIT + Commons Clause; David Haz) ported to plain JS
// shaders and default props are upstream's except mouseInfluence 0 and colors = accent
// source: https://reactbits.dev/backgrounds/color-bends
// Three.js comes from CDN via newtab.html; falls back to plain gradient
(() => {
    const MAX_COLORS = 8;

    const PROPS = {
        rotation: 90,
        speed: 0.2,
        colors: ["#AE72DF"], // default accent; replaced at run time
        transparent: true,
        autoRotate: 0,
        scale: 1,
        frequency: 1,
        warpStrength: 1,
        mouseInfluence: 0, // upstream default is 1
        parallax: 0.5,
        noise: 0.15,
        iterations: 1,
        intensity: 1.5,
        bandWidth: 6
    };

    const canvas = document.getElementById("bg");
    if (!canvas) return;

    function fallback(reason) {
        if (reason) console.warn("[paroxysm] background unavailable:", reason);
        document.body.classList.add("no-webgl");
        canvas.remove();
    }

    if (!window.THREE) return fallback("Three.js did not load");

    // upstream shaders (verbatim)
    const frag = `
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

    const vert = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`;
    // end upstream shaders

    let renderer, material, scene, camera, clock, setColors;
    try {
        scene = new THREE.Scene();
        camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

        const geometry = new THREE.PlaneGeometry(2, 2);
        const uColorsArray = Array.from({ length: MAX_COLORS }, () => new THREE.Vector3(0, 0, 0));
        material = new THREE.ShaderMaterial({
            vertexShader: vert,
            fragmentShader: frag,
            uniforms: {
                uCanvas: { value: new THREE.Vector2(1, 1) },
                uTime: { value: 0 },
                uSpeed: { value: PROPS.speed },
                uRot: { value: new THREE.Vector2(1, 0) },
                uColorCount: { value: 0 },
                uColors: { value: uColorsArray },
                uTransparent: { value: PROPS.transparent ? 1 : 0 },
                uScale: { value: PROPS.scale },
                uFrequency: { value: PROPS.frequency },
                uWarpStrength: { value: PROPS.warpStrength },
                uPointer: { value: new THREE.Vector2(0, 0) },
                uMouseInfluence: { value: PROPS.mouseInfluence },
                uParallax: { value: PROPS.parallax },
                uNoise: { value: PROPS.noise },
                uIterations: { value: PROPS.iterations },
                uIntensity: { value: PROPS.intensity },
                uBandWidth: { value: PROPS.bandWidth }
            },
            premultipliedAlpha: true,
            transparent: true
        });
        scene.add(new THREE.Mesh(geometry, material));

        renderer = new THREE.WebGLRenderer({
            canvas,
            antialias: false,
            powerPreference: "high-performance",
            alpha: true
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setClearColor(0x000000, PROPS.transparent ? 0 : 1);
        clock = new THREE.Clock();

        // colours (hex parsing as upstream)
        const toVec3 = hex => {
            const h = hex.replace("#", "").trim();
            const v = h.length === 3
                ? [parseInt(h[0] + h[0], 16), parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16)]
                : [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
            return new THREE.Vector3(v[0] / 255, v[1] / 255, v[2] / 255);
        };
        setColors = list => {
            const arr = (list || []).filter(Boolean).slice(0, MAX_COLORS).map(toVec3);
            for (let i = 0; i < MAX_COLORS; i++) {
                if (i < arr.length) uColorsArray[i].copy(arr[i]);
                else uColorsArray[i].set(0, 0, 0);
            }
            material.uniforms.uColorCount.value = arr.length;
        };
    } catch (e) {
        return fallback(e.message);
    }

    const accentColors = () => [paroxysmSettings.get().accent || PROPS.colors[0]];
    setColors(accentColors());

    const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const wantsMotion = () => !reduceMotion && paroxysmSettings.get().animatedBackground !== false;

    // pointer smoothed as upstream (only parallax reads it while mouseInfluence is 0)
    const pointerTarget = new THREE.Vector2(0, 0);
    const pointerCurrent = new THREE.Vector2(0, 0);
    const POINTER_SMOOTH = 8;
    document.addEventListener("pointermove", e => {
        pointerTarget.set((e.clientX / (innerWidth || 1)) * 2 - 1, -((e.clientY / (innerHeight || 1)) * 2 - 1));
    });

    function handleResize() {
        const w = canvas.clientWidth || 1;
        const h = canvas.clientHeight || 1;
        renderer.setSize(w, h, false);
        material.uniforms.uCanvas.value.set(w, h);
        renderer.render(scene, camera);
    }
    handleResize();
    if ("ResizeObserver" in window) new ResizeObserver(handleResize).observe(canvas);
    else addEventListener("resize", handleResize);

    let elapsed = 0;
    let raf = null;
    let resumed = false;

    function loop() {
        raf = null;
        if (document.hidden || !wantsMotion()) return;
        const delta = clock.getDelta();
        const dt = resumed ? 0 : delta;
        resumed = false;
        elapsed += dt;
        material.uniforms.uTime.value = elapsed;

        const deg = (PROPS.rotation % 360) + PROPS.autoRotate * elapsed;
        const rad = (deg * Math.PI) / 180;
        material.uniforms.uRot.value.set(Math.cos(rad), Math.sin(rad));

        pointerCurrent.lerp(pointerTarget, Math.min(1, dt * POINTER_SMOOTH));
        material.uniforms.uPointer.value.copy(pointerCurrent);
        renderer.render(scene, camera);
        raf = requestAnimationFrame(loop);
    }

    function start() {
        if (raf !== null || document.hidden || !wantsMotion()) return;
        resumed = true;
        raf = requestAnimationFrame(loop);
    }
    function stop() { if (raf !== null) cancelAnimationFrame(raf); raf = null; }

    document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
    canvas.addEventListener("webglcontextlost", e => { e.preventDefault(); stop(); fallback("WebGL context lost"); });

    // follows Settings > Appearance > Animated background
    paroxysmSettings.onChange(() => {
        setColors(accentColors());
        if (wantsMotion()) start(); else { stop(); renderer.render(scene, camera); }
    });

    // first frame straight away (still frame when motion is off)
    material.uniforms.uTime.value = elapsed;
    material.uniforms.uRot.value.set(Math.cos((PROPS.rotation * Math.PI) / 180), Math.sin((PROPS.rotation * Math.PI) / 180));
    renderer.render(scene, camera);
    canvas.classList.add("ready");
    start();
})();