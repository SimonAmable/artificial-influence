"use client"

import * as React from "react"
import {
  AURORA_SHADER_UNIFORMS,
  getAuroraShaderColorUniforms,
} from "@/lib/constants/aurora-shader"
import { cn } from "@/lib/utils"

const MAX_RENDER_WIDTH = 128
const MAX_RENDER_HEIGHT = 56

const VERTEX_SHADER_SOURCE = `
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`

const FRAGMENT_SHADER_SOURCE = `
precision highp float;
uniform vec2 u_resolution;
uniform float u_time;
uniform vec2 u_pointer;
uniform vec2 u_velocity;
uniform vec3 u_colors[8];
uniform float u_style, u_intensity, u_zoom, u_warp, u_contrast, u_speed, u_grain, u_drift, u_animate, u_reverse, u_rotate, u_seed, u_smooth_blend;
uniform vec2 u_offset;
uniform float u_cursor_on, u_cursor_effect, u_cursor_strength, u_cursor_radius;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453123); }
float noise(vec2 p) { vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y); }
float fbm(vec2 p) { float v=0., a=.55; for(int i=0;i<5;i++){v+=a*noise(p);p=p*2.03+4.1;a*=.5;}return v; }
float auroraHash(vec2 p){p=fract(p*vec2(234.34,435.345));p+=dot(p,p+34.23);return fract(p.x*p.y);}
float auroraNoise(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);return mix(mix(auroraHash(i),auroraHash(i+vec2(1.,0.)),u.x),mix(auroraHash(i+vec2(0.,1.)),auroraHash(i+vec2(1.,1.)),u.x),u.y);}
float auroraFbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*auroraNoise(p);p=p*2.03+vec2(17.,9.2);a*=.5;}return v;}
vec3 gradient(float t){ t=clamp(t,0.,.999); float x=t*7.; int i=int(floor(x)); float f=fract(x); if(u_smooth_blend>.5)f=f*f*(3.-2.*f); if(i==0)return mix(u_colors[0],u_colors[1],f); if(i==1)return mix(u_colors[1],u_colors[2],f); if(i==2)return mix(u_colors[2],u_colors[3],f); if(i==3)return mix(u_colors[3],u_colors[4],f); if(i==4)return mix(u_colors[4],u_colors[5],f); if(i==5)return mix(u_colors[5],u_colors[6],f); return mix(u_colors[6],u_colors[7],f); }
void main(){
  vec2 uv=(gl_FragCoord.xy-.5*u_resolution.xy)/u_resolution.y;
  vec2 p=uv*u_zoom + u_offset;
  float time=u_time*u_speed*.16*u_animate*(u_reverse>.5?-1.:1.);
  p += vec2(sin(time*.7),cos(time*.53))*u_drift*.55 + u_seed*.001;
  p = mat2(cos(u_rotate),-sin(u_rotate),sin(u_rotate),cos(u_rotate))*p;
  p += vec2(sin(p.y*3.+time),cos(p.x*3.-time))*u_warp*.16;
  float d=length(uv-u_pointer);
  vec2 pBeforeCursor=p;
  if(u_cursor_on>.5){
    float influence=smoothstep(u_cursor_radius,0.,d)*u_cursor_strength;
    vec2 dir=normalize(uv-u_pointer+0.0001);
    if(u_cursor_effect<.5) p += u_velocity*influence*1.8;
    else if(u_cursor_effect<1.5) p += dir*influence*.65;
    else if(u_cursor_effect<2.5){ float a=influence*4.; p=mat2(cos(a),-sin(a),sin(a),cos(a))*p; }
    else if(u_cursor_effect<3.5) p += dir*sin(d*32.-time*8.)*influence*.14;
  }
  float v;
  if(u_style<.5){
    vec2 s=p*2.4; s.y+=fbm(s*.8+vec2(time*.16,0.))*2.1; s.x+=sin(s.y*1.8)*.45;
    v=.5+.5*sin(s.y*2.5+fbm(s*1.7)*5.);
  }
  else if(u_style<1.5){
    float a=fbm(p*1.45+vec2(time*.11,-time*.06)); float b=fbm(p*3.1-vec2(time*.07,time*.12));
    v=smoothstep(.22,.83,a*.72+b*.42);
  }
  else if(u_style<2.5){
    vec2 w=p*2.0; w.y+=fbm(w*1.4+time*.08)*.85; v=.5+.5*sin(w.y*4.2+sin(w.x*1.5+time)*.75);
    v=mix(v,fbm(w*2.+time*.1),.18);
  }
  else if(u_style<3.5){
    vec2 f=p*2.; f+=vec2(fbm(f+time*.09),fbm(f.yx-time*.08))*1.25; v=fbm(f*2.25);
  }
  else if(u_style<4.5){
    float auroraTime=u_time*1.41*(u_speed/2.07)*u_animate*(u_reverse>.5?-1.:1.);
    vec2 a=uv*u_zoom;
    a=mat2(cos(u_rotate),-sin(u_rotate),sin(u_rotate),cos(u_rotate))*a;
    a+=u_offset;
    a+=u_drift*vec2(sin(auroraTime*.31),cos(auroraTime*.23));
    a+=u_warp*(vec2(auroraFbm(a*3.2+u_seed),auroraFbm(a*3.2+vec2(5.2,1.3)+u_seed))-.5);
    a+=p-pBeforeCursor;
    float curtain=auroraFbm(vec2(a.x*2.+auroraTime*.15,a.y*.6-auroraTime*.05)+u_seed);
    float band=auroraFbm(vec2(a.x*3.5-auroraTime*.1,curtain*(2.+u_intensity*3.)));
    v=smoothstep(.15,.85,band)*(1.-abs(a.y)*.7);
  }
  else if(u_style<5.5){
    vec2 o=p-vec2(sin(time*.7)*.12,cos(time*.6)*.08); float r=length(o);
    v=1.-smoothstep(.08,.47,r); v+=.16*exp(-r*5.)*sin(r*28.-time*2.);
  }
  else if(u_style<6.5){
    vec2 c=p*5.; c+=vec2(sin(c.y+time*.55),sin(c.x-time*.42))*.42;
    v=pow(abs(sin(c.x+sin(c.y))*sin(c.y+sin(c.x))),.28);
  }
  else if(u_style<7.5){
    vec2 m=p*1.25+vec2(time*.06,-time*.04); v=smoothstep(.22,.78,fbm(m*.85)); v=mix(v,fbm(m*2.),.24);
  }
  else if(u_style<8.5){
    vec2 b=p*1.35; float d1=length(b-vec2(sin(time)*.28,cos(time*.7)*.2));
    float d2=length(b-vec2(-.3+cos(time*.6)*.16,.19)); float d3=length(b-vec2(.18,sin(time*.8)*.3));
    v=smoothstep(.34,.62,1./(1.5+d1*5.)+1./(1.5+d2*5.)+1./(1.5+d3*5.));
  }
  else if(u_style<9.5){
    v=.5+.25*sin(p.x*4.+time)+.25*sin(p.y*5.-time*.7)+.2*sin((p.x+p.y)*4.+time*.4);
  }
  else if(u_style<10.5){
    vec2 z=p*3.; z.x+=sin(z.y*1.65+time*.35)*1.2+fbm(z*.8)*.75; v=.5+.5*sin(z.x*5.8);
  }
  else if(u_style<11.5){
    float r=length(p+vec2(sin(time*.2)*.03,cos(time*.2)*.03)); v=.5+.5*sin(r*20.+fbm(p*4.)*1.4-time*.8);
  }
  else if(u_style<12.5){
    vec2 h=p*9.; vec2 cell=fract(h)-.5; float tone=.28+.58*fbm(floor(h)*.35); v=1.-step(tone*.42,length(cell));
  }
  else if(u_style<13.5){
    vec2 a=p; a.x+=fbm(vec2(a.y*1.4,time*.09))*1.1; float curtain=sin(a.x*5.+fbm(a*2.+time*.12)*4.);
    v=smoothstep(-.3,.85,curtain)*(.56+.44*fbm(a*3.-time*.08));
  }
  else if(u_style<14.5){
    vec2 m=p*1.4; float a=fbm(m+vec2(time*.10,-time*.06)); float b=fbm(m*1.8+vec2(-time*.05,time*.09)); v=mix(a,b,.42);
  }
  else if(u_style<15.5){
    vec2 m=p*1.35; v=fbm(m*.9+u_seed*.01)*.62+fbm(m*2.1+vec2(7.3,1.8))* .38;
  }
  else if(u_style<16.5){
    vec2 r=p+vec2(sin(u_seed)*.08,cos(u_seed)*.08); v=.5+.34*cos(length(r-vec2(.22,-.16))*5.)+.18*cos(length(r+vec2(.28,.22))*7.);
  }
  else if(u_style<17.5){
    vec2 q=floor((p+1.)*18.); float tone=fbm(q*.16+u_seed); float threshold=fract(dot(mod(q,4.),vec2(.25,.125))); v=step(threshold, tone);
  }
  else if(u_style<18.5){
    v=.5+.32*sin(p.x*2.2+p.y*.8+time*.15)+.18*fbm(p*2.3+time*.03);
  }
  else if(u_style<19.5){
    vec2 o=p*3.; float a=atan(o.y,o.x)+time*.6; float ring=abs(length(o)-1.25-.12*sin(a*5.)); float dots=step(.78,.5+.5*sin(a*9.-time*2.)); v=(1.-smoothstep(.015,.09,ring))*dots;
  }
  else if(u_style<20.5){
    vec2 g=fract(p*9.)-.5; float shade=.34+.55*fbm(floor(p*9.)*.22+u_seed); v=1.-smoothstep(shade*.08,shade*.16,length(g));
  }
  else if(u_style<21.5){
    vec2 w=p*3.; w+=vec2(fbm(w.yx+time*.12),fbm(w+time*.08))*1.25; v=.5+.5*sin(w.x*4.7+w.y*1.8);
  }
  else if(u_style<22.5){
    float a=atan(p.y,p.x); float r=length(p); v=.5+.5*sin(a*6.-r*16.-time*.7);
  }
  else if(u_style<23.5){
    float r=length(p); float a=atan(p.y,p.x)+1.8/(r+.18)+time*.25; v=.5+.5*sin(a*4.+r*13.);
  }
  else if(u_style<24.5){
    vec2 w=p*2.7; w.y+=sin(w.x*1.7+time)*.45+fbm(w+time*.05)*.55; v=.5+.5*sin(w.y*4.8-time);
  }
  else if(u_style<25.5){
    vec2 n=p*4.; float a=fbm(n+time*.06); float b=fbm(n.yx*1.7-time*.04); v=pow(abs(sin((a-b)*15.)),.6);
  }
  else if(u_style<26.5){
    v=fbm(p*3.+vec2(time*.08,-time*.04));
  }
  else if(u_style<27.5){
    vec2 n=p*3.; n=mat2(.866,-.5,.5,.866)*n; v=fbm(n+vec2(time*.07,time*.03));
  }
  else if(u_style<28.5){
    vec2 c=p*6.; vec2 cell=floor(c), f=fract(c); float dist=2.; for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 g=vec2(float(x),float(y));vec2 h=vec2(hash(cell+g),hash(cell+g+4.2));dist=min(dist,length(g+h-f));} v=1.-smoothstep(.08,.72,dist);
  }
  else if(u_style<29.5){
    float edge=min(.5-abs(uv.x),.5-abs(uv.y)); float pulse=.55+.45*sin(time*3.+u_seed); v=smoothstep(.015,.09,edge)*.18+(1.-smoothstep(.012,.04,edge))*pulse;
  }
  else if(u_style<30.5){
    vec2 b=p*1.7; float m=0.; for(int i=0;i<4;i++){float fi=float(i); vec2 c=vec2(sin(time*.6+fi*1.7),cos(time*.8+fi*2.1))*.38; m+=.18/(length(b-c)+.08);} v=smoothstep(.38,.78,m);
  }
  else if(u_style<31.5){
    vec2 c=p*2.5; float a=smoothstep(-.45,.45,sin(c.x+time*.18)); float b=smoothstep(-.35,.35,sin(c.y*1.5-time*.13)); float d=smoothstep(-.3,.3,sin((c.x+c.y)*.8)); v=(a+b+d)/3.;
  }
  else if(u_style<32.5){
    float r=length(p); float a=atan(p.y,p.x); float ring=abs(r-.38-.11*fbm(vec2(a*2.,time*.09)+u_seed)); v=1.-smoothstep(.015,.13,ring);
  }
  else {
    vec2 g=p-vec2(-.12,-.38); float a=atan(g.y,g.x); float rays=pow(.5+.5*sin(a*13.+fbm(g*5.)*4.+time*.25),3.); v=rays*(1.-smoothstep(.08,1.2,length(g)))+.18*exp(-length(g)*7.);
  }
  if(u_style>3.5 && u_style<4.5){
    vec3 auroraColor=gradient(clamp(v,0.,1.));
    auroraColor=(auroraColor-.5)*1.2+.5;
    float vd=length(gl_FragCoord.xy/u_resolution.xy-.5)*1.41421356;
    auroraColor*=1.-.07*smoothstep(.35,1.,vd);
    auroraColor+=(hash(gl_FragCoord.xy+u_seed)-.5)*u_grain;
    gl_FragColor=vec4(clamp(auroraColor,0.,1.),1.);
    return;
  }
  if(u_cursor_on>.5 && u_cursor_effect>3.5) v+=smoothstep(u_cursor_radius,0.,d)*u_cursor_strength*.75;
  v=mix(.5,v,u_intensity); v=pow(max(v,0.001), 1.3-u_contrast*.65);
  vec3 color=gradient(v);
  color += (hash(gl_FragCoord.xy)-.5)*u_grain;
  gl_FragColor=vec4(color,1.);
}
`

type AuroraShaderBackgroundProps = {
  className?: string
  targetRef?: React.RefObject<HTMLElement | null>
  /** Run the continuous animation loop (e.g. while an image is ready). */
  animate?: boolean
  /** Use the fast generating playback speed. */
  fast?: boolean
}

function compileShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)
  if (!shader) return null

  gl.shaderSource(shader, source)
  gl.compileShader(shader)

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader))
    gl.deleteShader(shader)
    return null
  }

  return shader
}

function createProgram(gl: WebGLRenderingContext) {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE)
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE)
  if (!vertexShader || !fragmentShader) return null

  const program = gl.createProgram()
  if (!program) return null

  gl.attachShader(program, vertexShader)
  gl.attachShader(program, fragmentShader)
  gl.linkProgram(program)

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program))
    gl.deleteProgram(program)
    return null
  }

  gl.deleteShader(vertexShader)
  gl.deleteShader(fragmentShader)

  return program
}

function pointerToUv(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  resolution: [number, number],
): [number, number] {
  const pixelRatio = resolution[0] / Math.max(rect.width, 1)
  const x = (clientX - rect.left) * pixelRatio
  const y = (rect.height - (clientY - rect.top)) * pixelRatio
  const uvX = (x - 0.5 * resolution[0]) / resolution[1]
  const uvY = (y - 0.5 * resolution[1]) / resolution[1]
  return [uvX, uvY]
}

function AuroraShaderBackgroundComponent({
  className,
  targetRef,
  animate = false,
  fast = false,
}: AuroraShaderBackgroundProps) {
  const rootRef = React.useRef<HTMLDivElement>(null)
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const pointerRef = React.useRef({ x: 0, y: 0 })
  const velocityRef = React.useRef({ x: 0, y: 0 })
  const isVisibleRef = React.useRef(true)
  const isHoveredRef = React.useRef(false)
  const animateRef = React.useRef(animate)
  const fastRef = React.useRef(fast)
  const targetRefRef = React.useRef(targetRef)
  const syncAnimationRef = React.useRef<(() => void) | null>(null)
  targetRefRef.current = targetRef
  animateRef.current = animate
  fastRef.current = fast

  React.useEffect(() => {
    const root = rootRef.current
    const canvas = canvasRef.current
    if (!root || !canvas) return

    const eventTarget = () => targetRefRef.current?.current ?? root

    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      powerPreference: "low-power",
    })

    if (!gl) return

    const program = createProgram(gl)
    if (!program) return

    const positionLocation = gl.getAttribLocation(program, "a_position")
    const resolutionLocation = gl.getUniformLocation(program, "u_resolution")
    const timeLocation = gl.getUniformLocation(program, "u_time")
    const pointerLocation = gl.getUniformLocation(program, "u_pointer")
    const velocityLocation = gl.getUniformLocation(program, "u_velocity")
    const styleLocation = gl.getUniformLocation(program, "u_style")
    const intensityLocation = gl.getUniformLocation(program, "u_intensity")
    const zoomLocation = gl.getUniformLocation(program, "u_zoom")
    const warpLocation = gl.getUniformLocation(program, "u_warp")
    const contrastLocation = gl.getUniformLocation(program, "u_contrast")
    const speedLocation = gl.getUniformLocation(program, "u_speed")
    const grainLocation = gl.getUniformLocation(program, "u_grain")
    const driftLocation = gl.getUniformLocation(program, "u_drift")
    const animateLocation = gl.getUniformLocation(program, "u_animate")
    const reverseLocation = gl.getUniformLocation(program, "u_reverse")
    const rotateLocation = gl.getUniformLocation(program, "u_rotate")
    const seedLocation = gl.getUniformLocation(program, "u_seed")
    const smoothBlendLocation = gl.getUniformLocation(program, "u_smooth_blend")
    const offsetLocation = gl.getUniformLocation(program, "u_offset")
    const cursorOnLocation = gl.getUniformLocation(program, "u_cursor_on")
    const cursorEffectLocation = gl.getUniformLocation(program, "u_cursor_effect")
    const cursorStrengthLocation = gl.getUniformLocation(program, "u_cursor_strength")
    const cursorRadiusLocation = gl.getUniformLocation(program, "u_cursor_radius")
    const colorLocations = Array.from({ length: 8 }, (_, index) =>
      gl.getUniformLocation(program, `u_colors[${index}]`),
    )

    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    )

    const colors = getAuroraShaderColorUniforms()
    let animationFrame = 0
    let startTime = performance.now()
    let frozenTime = 0
    let resolution: [number, number] = [1, 1]
    let pointerRaf = 0
    let lastPointer = { x: 0, y: 0 }

    gl.useProgram(program)
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.enableVertexAttribArray(positionLocation)
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0)

    gl.uniform1f(styleLocation, AURORA_SHADER_UNIFORMS.style)
    gl.uniform1f(intensityLocation, AURORA_SHADER_UNIFORMS.intensity)
    gl.uniform1f(zoomLocation, AURORA_SHADER_UNIFORMS.zoom)
    gl.uniform1f(warpLocation, AURORA_SHADER_UNIFORMS.warp)
    gl.uniform1f(contrastLocation, AURORA_SHADER_UNIFORMS.contrast)
    gl.uniform1f(speedLocation, AURORA_SHADER_UNIFORMS.speed)
    gl.uniform1f(grainLocation, AURORA_SHADER_UNIFORMS.grain)
    gl.uniform1f(driftLocation, AURORA_SHADER_UNIFORMS.drift)
    gl.uniform1f(animateLocation, AURORA_SHADER_UNIFORMS.animate)
    gl.uniform1f(reverseLocation, AURORA_SHADER_UNIFORMS.reverse)
    gl.uniform1f(rotateLocation, AURORA_SHADER_UNIFORMS.rotate)
    gl.uniform1f(seedLocation, AURORA_SHADER_UNIFORMS.seed)
    gl.uniform1f(smoothBlendLocation, AURORA_SHADER_UNIFORMS.smoothBlend)
    gl.uniform2f(offsetLocation, AURORA_SHADER_UNIFORMS.offsetX, AURORA_SHADER_UNIFORMS.offsetY)
    gl.uniform1f(cursorOnLocation, AURORA_SHADER_UNIFORMS.cursorOn)
    gl.uniform1f(cursorEffectLocation, AURORA_SHADER_UNIFORMS.cursorEffect)
    gl.uniform1f(cursorStrengthLocation, AURORA_SHADER_UNIFORMS.cursorStrength)
    gl.uniform1f(cursorRadiusLocation, AURORA_SHADER_UNIFORMS.cursorRadius)
    colors.forEach((color, index) => {
      const location = colorLocations[index]
      if (location) {
        gl.uniform3f(location, color[0], color[1], color[2])
      }
    })

    const resize = () => {
      const rect = eventTarget().getBoundingClientRect()
      const width = Math.max(1, Math.floor(rect.width))
      const height = Math.max(1, Math.floor(rect.height))
      const scale = Math.min(1, MAX_RENDER_WIDTH / width, MAX_RENDER_HEIGHT / height)
      const renderWidth = Math.max(1, Math.floor(width * scale))
      const renderHeight = Math.max(1, Math.floor(height * scale))

      canvas.width = renderWidth
      canvas.height = renderHeight
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      resolution = [renderWidth, renderHeight]
      gl.viewport(0, 0, renderWidth, renderHeight)
    }

    // Time advances whenever `animate` is on (ready). Hover only updates swirl.
    const shouldAnimate = () => isVisibleRef.current && animateRef.current

    const applySpeed = () => {
      gl.uniform1f(
        speedLocation,
        fastRef.current
          ? AURORA_SHADER_UNIFORMS.generatingSpeed
          : AURORA_SHADER_UNIFORMS.speed,
      )
    }

    const drawFrame = (now: number) => {
      const time = shouldAnimate() ? (now - startTime) / 1000 : frozenTime
      if (shouldAnimate()) {
        frozenTime = time
      }

      gl.uniform2f(resolutionLocation, resolution[0], resolution[1])
      gl.uniform1f(timeLocation, time)
      gl.uniform2f(pointerLocation, pointerRef.current.x, pointerRef.current.y)
      gl.uniform2f(velocityLocation, velocityRef.current.x, velocityRef.current.y)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }

    const render = (now: number) => {
      animationFrame = 0
      if (!isVisibleRef.current) return

      drawFrame(now)

      if (shouldAnimate()) {
        animationFrame = window.requestAnimationFrame(render)
      }
    }

    const startLoop = () => {
      if (animationFrame === 0 && isVisibleRef.current) {
        startTime = performance.now() - frozenTime * 1000
        animationFrame = window.requestAnimationFrame(render)
      }
    }

    const stopLoop = () => {
      if (animationFrame !== 0) {
        window.cancelAnimationFrame(animationFrame)
        animationFrame = 0
      }
      drawFrame(performance.now())
    }

    const syncAnimation = () => {
      applySpeed()
      if (shouldAnimate()) {
        startLoop()
      } else {
        stopLoop()
      }
    }
    syncAnimationRef.current = syncAnimation

    const handlePointerMove = (event: PointerEvent) => {
      if (pointerRaf !== 0) return
      pointerRaf = window.requestAnimationFrame(() => {
        pointerRaf = 0
        const rect = eventTarget().getBoundingClientRect()
        const [uvX, uvY] = pointerToUv(event.clientX, event.clientY, rect, resolution)
        velocityRef.current = {
          x: (uvX - lastPointer.x) * 12,
          y: (uvY - lastPointer.y) * 12,
        }
        lastPointer = { x: uvX, y: uvY }
        pointerRef.current = { x: uvX, y: uvY }
        // Single redraw so swirl reacts on hover without advancing time.
        drawFrame(performance.now())
      })
    }

    const handlePointerEnter = () => {
      isHoveredRef.current = true
    }

    const handlePointerLeave = () => {
      isHoveredRef.current = false
      pointerRef.current = { x: 0, y: 0 }
      velocityRef.current = { x: 0, y: 0 }
      lastPointer = { x: 0, y: 0 }
      drawFrame(performance.now())
    }

    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        isVisibleRef.current = entries.some((entry) => entry.isIntersecting)
        syncAnimation()
      },
      { threshold: 0 },
    )

    const resizeObserver =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null

    const targetElement = eventTarget()

    resize()
    drawFrame(performance.now())
    syncAnimation()
    intersectionObserver.observe(root)
    resizeObserver?.observe(targetElement)
    targetElement.addEventListener("pointerenter", handlePointerEnter)
    targetElement.addEventListener("pointerleave", handlePointerLeave)
    targetElement.addEventListener("pointermove", handlePointerMove, { passive: true })

    return () => {
      syncAnimationRef.current = null
      intersectionObserver.disconnect()
      resizeObserver?.disconnect()
      targetElement.removeEventListener("pointerenter", handlePointerEnter)
      targetElement.removeEventListener("pointerleave", handlePointerLeave)
      targetElement.removeEventListener("pointermove", handlePointerMove)
      if (animationFrame !== 0) {
        window.cancelAnimationFrame(animationFrame)
      }
      if (pointerRaf !== 0) {
        window.cancelAnimationFrame(pointerRaf)
      }
      gl.deleteBuffer(buffer)
      gl.deleteProgram(program)
    }
  }, [])

  React.useEffect(() => {
    syncAnimationRef.current?.()
  }, [animate, fast])

  return (
    <div ref={rootRef} aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" />
    </div>
  )
}

export const AuroraShaderBackground = React.memo(AuroraShaderBackgroundComponent)
