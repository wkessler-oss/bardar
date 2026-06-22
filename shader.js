// bardar hero — WebGL2 "futuristic" grid (vanilla, self-contained).
// Animated perspective tron-grid tunnel + sweeping scan line + horizon glow,
// recolored to the site palette: green lines on a near-white base, with a
// clear center band so the hero text stays readable and a soft vertical fade
// so it melts into the adjacent white sections.
(() => {
  const wrap = document.querySelector('.hero__shader');
  const canvas = document.getElementById('hero-shader');
  if (!wrap || !canvas) return;

  const gl = canvas.getContext('webgl2', { premultipliedAlpha: false, antialias: true });
  if (!gl) {
    wrap.classList.add('no-webgl');
    canvas.remove();
    return;
  }

  // brand green (#1FCA52) used for the grid lines
  const GRID_COLOR = [0.122, 0.792, 0.322];

  const VERT_SRC = `#version 300 es
precision highp float;
layout(location=0) in vec2 a_pos;
void main(){ gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

  const FRAG_SRC = `#version 300 es
precision highp float;
out vec4 O;
uniform float time;
uniform vec2  resolution;
uniform vec3  u_color;

void main(){
  vec2 R = resolution;
  vec2 p = (2.0 * gl_FragCoord.xy - R) / R.y;   // aspect-correct, ~ -1..1 vertically

  // perspective tron grid, mirrored top + bottom into a tunnel
  float ay    = abs(p.y) + 0.0015;
  float depth = 1.0 / ay;
  vec2  g     = vec2(p.x * depth, depth - time * 1.3);
  vec2  f     = abs(fract(g) - 0.5);
  float l     = min(f.x, f.y);
  float w     = fwidth(l) * 1.5 + 0.003;
  float grid  = smoothstep(w, 0.0, l);

  // clear the center band (keeps text readable) and fade far lines
  grid *= smoothstep(0.02, 0.5, ay);
  grid *= clamp(exp(-depth * 0.05), 0.0, 1.0);

  // sweeping horizontal scan line
  float scanPos = mix(-1.05, 1.05, fract(time * 0.07));
  float scan    = smoothstep(0.07, 0.0, abs(p.y - scanPos));

  // soft glow along the horizon
  float glow = exp(-abs(p.y) * 3.5);

  vec3 page  = vec3(0.972, 0.992, 0.980);
  vec3 green = u_color;

  vec3 col = page;
  col = mix(col, green, grid * 0.85);
  col = mix(col, green, scan * 0.18);
  col = mix(col, mix(green, vec3(1.0), 0.45), glow * 0.20);

  // fade in on load
  col = mix(page, col, min(time * 0.4, 1.0));

  // soft vertical fade so the canvas blends into the white sections
  float y = gl_FragCoord.y / R.y;
  float vfade = smoothstep(0.0, 0.10, y) * smoothstep(1.0, 0.85, y);

  O = vec4(col, vfade);
}
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

  const uResolution = gl.getUniformLocation(prog, 'resolution');
  const uTime = gl.getUniformLocation(prog, 'time');
  const uColor = gl.getUniformLocation(prog, 'u_color');

  gl.useProgram(prog);
  gl.uniform3fv(uColor, GRID_COLOR);
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
    gl.uniform2f(uResolution, canvas.width, canvas.height);
    gl.uniform1f(uTime, timeSeconds);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) {
    requestAnimationFrame(() => { resize(); render(8.0); });
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
