// paroxysm: new tab background.
// An original, dependency-free WebGL fragment shader: slow, domain-warped colour
// bands in a purple palette. No libraries, no build step.
// Cheap by design: renders at reduced resolution, caps the frame rate, pauses when
// the page is hidden, and draws a single still frame for "reduce motion".
(() => {
    const canvas = document.getElementById("bg");
    if (!canvas) return;

    const gl = canvas.getContext("webgl", { antialias: false, alpha: false, powerPreference: "low-power" });
    if (!gl) { document.body.classList.add("no-webgl"); canvas.remove(); return; }

    const VERT = "attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }";

    const FRAG = `
precision mediump float;
uniform vec2 uRes;
uniform float uT;

// dark violet -> violet -> indigo -> a small magenta glint
vec3 ramp(float x) {
    vec3 a = vec3(0.020, 0.010, 0.050);
    vec3 b = vec3(0.360, 0.160, 0.820);
    vec3 c = vec3(0.170, 0.230, 0.880);
    vec3 d = vec3(0.760, 0.230, 0.800);
    vec3 col = mix(a, b, smoothstep(0.00, 0.50, x));
    col = mix(col, c, smoothstep(0.45, 0.80, x));
    col = mix(col, d, smoothstep(0.82, 1.00, x));
    return col;
}

void main() {
    vec2 uv = (gl_FragCoord.xy * 2.0 - uRes) / min(uRes.x, uRes.y);
    float t = uT * 0.12;

    // diagonal flow
    float r = 0.65;
    vec2 p = mat2(cos(r), -sin(r), sin(r), cos(r)) * uv;

    // the "bends": a few rounds of sinusoidal domain warping
    for (int i = 1; i < 5; i++) {
        float fi = float(i);
        p.x += 0.46 / fi * sin(fi * 1.7 * p.y + t * 1.3 + fi * 1.1);
        p.y += 0.46 / fi * cos(fi * 1.9 * p.x - t * 1.1 + fi * 0.7);
    }

    float f = pow(0.5 + 0.5 * sin(p.x * 2.2 + t * 0.8), 1.7);
    float g = 0.5 + 0.5 * sin(p.y * 1.4 - t * 0.5 + p.x * 0.6);
    float v = f * 0.78 + g * 0.22;

    vec3 col = ramp(pow(v, 1.35)) * 0.40;

    // keep the centre calm so the wordmark and search stay readable
    float vig = smoothstep(2.0, 0.15, length(uv * vec2(0.85, 1.0)));
    col *= 0.18 + 0.82 * vig;

    // fine dither against banding
    float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
    col += (n - 0.5) * (2.0 / 255.0);

    gl_FragColor = vec4(col, 1.0);
}`;

    function compile(type, src) {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
        return s;
    }

    let uRes, uT;
    try {
        const prog = gl.createProgram();
        gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
        gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
        gl.useProgram(prog);

        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW); // one big triangle
        const loc = gl.getAttribLocation(prog, "p");
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

        uRes = gl.getUniformLocation(prog, "uRes");
        uT = gl.getUniformLocation(prog, "uT");
    } catch (e) {
        console.warn("[paroxysm] background shader unavailable:", e.message);
        document.body.classList.add("no-webgl");
        canvas.remove();
        return;
    }

    const SCALE = 0.5;          // render at half resolution; the CSS scales it up
    const FRAME_MS = 1000 / 30; // 30 fps is plenty for slow colour drift
    const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let start = performance.now();
    let last = 0;
    let raf = 0;

    function resize() {
        const w = Math.max(2, Math.round(canvas.clientWidth * SCALE));
        const h = Math.max(2, Math.round(canvas.clientHeight * SCALE));
        if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
            gl.viewport(0, 0, w, h);
        }
    }

    function draw(seconds) {
        resize();
        gl.uniform2f(uRes, canvas.width, canvas.height);
        gl.uniform1f(uT, seconds);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    function frame(now) {
        raf = requestAnimationFrame(frame);
        if (now - last < FRAME_MS) return;
        last = now;
        draw((now - start) / 1000 + 20);
    }

    function startLoop() { if (!raf && !reduceMotion) raf = requestAnimationFrame(frame); }
    function stopLoop() { cancelAnimationFrame(raf); raf = 0; }

    document.addEventListener("visibilitychange", () => (document.hidden ? stopLoop() : startLoop()));
    addEventListener("resize", () => draw((performance.now() - start) / 1000 + 20));
    canvas.addEventListener("webglcontextlost", e => { e.preventDefault(); stopLoop(); document.body.classList.add("no-webgl"); canvas.remove(); });

    draw(32);                     // first frame straight away (also the still frame for reduced motion)
    canvas.classList.add("ready");
    startLoop();
})();