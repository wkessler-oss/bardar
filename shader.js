// bardar hero — WebGL2 smoke shader (vanilla port).
// fbm smoke remapped to the site palette: green wisps on a near-white base,
// with a soft vertical fade so it melts into the adjacent white sections.
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

  // brand green (#1FCA52) used to tint the smoke
  const SMOKE_COLOR = [0.122, 0.792, 0.322];

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

#define FC gl_FragCoord.xy
#define R resolution
#define T (time+660.)

float rnd(vec2 p){p=fract(p*vec2(12.9898,78.233));p+=dot(p,p+34.56);return fract(p.x*p.y);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);return mix(mix(rnd(i),rnd(i+vec2(1,0)),u.x),mix(rnd(i+vec2(0,1)),rnd(i+1.),u.x),u.y);}
float fbm(vec2 p){float t=.0,a=1.;for(int i=0;i<5;i++){t+=a*noise(p);p*=mat2(1,-1.2,.2,1.2)*2.;a*=.5;}return t;}

void main(){
  vec2 uv=(FC-.5*R)/R.y;
  vec3 col=vec3(1);
  uv.x+=.25;
  uv*=vec2(2,1);

  float n=fbm(uv*.28-vec2(T*.01,0));
  n=noise(uv*3.+n*2.);

  col.r-=fbm(uv+vec2(0,T*.015)+n);
  col.g-=fbm(uv*1.003+vec2(0,T*.015)+n+.003);
  col.b-=fbm(uv*1.006+vec2(0,T*.015)+n+.006);

  // smoke density from the grayscale field (0 = clear, 1 = dense)
  float lum = dot(clamp(col,0.0,1.0), vec3(.21,.71,.07));
  float density = clamp(1.0 - lum, 0.0, 1.0);

  // light theme: near-white page tinted toward green where smoke is dense
  vec3 page = vec3(0.972, 0.992, 0.980);
  vec3 outc = mix(page, u_color, density * 0.70);

  // fade in on load
  outc = mix(page, outc, min(time*.25, 1.0));

  // soft vertical fade so the canvas blends into the white sections
  float y = FC.y / R.y;
  float vfade = smoothstep(0.0, 0.10, y) * smoothstep(1.0, 0.85, y);

  O = vec4(outc, vfade);
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
  gl.uniform3fv(uColor, SMOKE_COLOR);
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
