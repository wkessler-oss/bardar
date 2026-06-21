// bardar hero — WebGL2 shader bloom (vanilla port).
// Animated petal/radar bloom recolored to the site's green palette on a
// near-white base so it blends into the light theme. Replaces the old radar.
(() => {
  const wrap = document.querySelector('.hero__shader');
  const canvas = document.getElementById('hero-shader');
  if (!wrap || !canvas) return;

  const gl = canvas.getContext('webgl2', { premultipliedAlpha: false, antialias: true });
  if (!gl) {
    // No WebGL2 → fall back to the CSS radial-gradient glow.
    wrap.classList.add('no-webgl');
    canvas.remove();
    return;
  }

  const VERT_SRC = `#version 300 es
precision highp float;
layout(location=0) in vec2 a_pos;
void main(){ gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

  // Recolored fragment shader: scalar intensity from the original loop,
  // mapped to bardar greens with a soft circular alpha vignette.
  const FRAG_SRC = `#version 300 es
precision highp float;
out vec4 fragColor;
uniform vec3  iResolution;
uniform float iTime;

void mainImage(out vec4 fragColor, in vec2 fragCoord){
  vec2  r = iResolution.xy;
  float t = iTime;
  vec2  p = fragCoord - r * 0.5;

  float acc = 0.0;
  for (float i = 0.0, a; i++ < 9.0; ){
    a = (i * i) / 80.0 - length(p) / r.y;
    float denom = max(a, -a * 3.0) + 2.0 / r.y;
    a = cos(i - t);
    float edge0 = a;
    a = atan(p.y, p.x) + a + i * i;
    float sm = smoothstep(edge0, 2.0, cos(a));
    acc += 0.03 / denom * sm * (1.2 + sin(a + i));
  }
  acc = tanh(acc);

  // soft elliptical fade across the full section so it blends into the page
  vec2  q    = p / (r * 0.5);
  float vign = smoothstep(1.3, 0.15, length(q));

  // bardar palette
  vec3 base = vec3(0.949, 0.984, 0.961); // #F2FBF5
  vec3 mid  = vec3(0.122, 0.792, 0.322); // #1FCA52
  vec3 hi   = vec3(0.424, 0.922, 0.533); // #6CEB88

  vec3 col = base;
  col = mix(col, mid, smoothstep(0.05, 0.55, acc));
  col = mix(col, hi,  smoothstep(0.45, 0.98, acc));

  float alpha = vign * (0.20 + 0.80 * smoothstep(0.03, 0.5, acc));
  fragColor = vec4(col, alpha);
}
void main(){ mainImage(fragColor, gl_FragCoord.xy); }
`;

  function compile(type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.error('shader compile error:', gl.getShaderInfoLog(sh));
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }

  const vs = compile(gl.VERTEX_SHADER, VERT_SRC);
  const fs = compile(gl.FRAGMENT_SHADER, FRAG_SRC);
  if (!vs || !fs) { wrap.classList.add('no-webgl'); canvas.remove(); return; }

  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error('program link error:', gl.getProgramInfoLog(prog));
    wrap.classList.add('no-webgl');
    canvas.remove();
    return;
  }

  // Fullscreen triangle
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const uResolution = gl.getUniformLocation(prog, 'iResolution');
  const uTime = gl.getUniformLocation(prog, 'iTime');

  gl.useProgram(prog);
  gl.clearColor(0, 0, 0, 0);

  const dpr = () => Math.max(1, Math.min(2, window.devicePixelRatio || 1));

  function resize() {
    const w = Math.max(1, Math.floor(canvas.clientWidth * dpr()));
    const h = Math.max(1, Math.floor(canvas.clientHeight * dpr()));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  function render(timeSeconds) {
    gl.uniform3f(uResolution, canvas.width, canvas.height, dpr());
    gl.uniform1f(uTime, timeSeconds);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) {
    // Render a single static frame.
    requestAnimationFrame(() => { resize(); render(3.0); });
    return;
  }

  const start = performance.now();
  let raf = 0;
  function tick(now) {
    if (gl.isContextLost()) { raf = requestAnimationFrame(tick); return; }
    render((now - start) / 1000);
    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);

  // Pause when the hero scrolls out of view to save GPU/battery.
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting && !raf) {
        raf = requestAnimationFrame(tick);
      } else if (!e.isIntersecting && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    }
  }, { threshold: 0 });
  io.observe(wrap);
})();
