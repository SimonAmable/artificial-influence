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

// Aurora-only path — stripped dead branches for a small button fill.
const FRAGMENT_SHADER_SOURCE = `
precision mediump float;
uniform vec2 u_resolution;
uniform float u_time;
uniform vec2 u_pointer;
uniform vec3 u_colors[8];
uniform float u_intensity, u_zoom, u_warp, u_speed, u_grain, u_drift, u_animate, u_rotate, u_seed, u_smooth_blend;
uniform vec2 u_offset;
uniform float u_cursor_strength, u_cursor_radius;

float auroraHash(vec2 p){p=fract(p*vec2(234.34,435.345));p+=dot(p,p+34.23);return fract(p.x*p.y);}
float auroraNoise(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);return mix(mix(auroraHash(i),auroraHash(i+vec2(1.,0.)),u.x),mix(auroraHash(i+vec2(0.,1.)),auroraHash(i+vec2(1.,1.)),u.x),u.y);}
float auroraFbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*auroraNoise(p);p=p*2.03+vec2(17.,9.2);a*=.5;}return v;}
vec3 gradient(float t){ t=clamp(t,0.,.999); float x=t*7.; int i=int(floor(x)); float f=fract(x); if(u_smooth_blend>.5)f=f*f*(3.-2.*f); if(i==0)return mix(u_colors[0],u_colors[1],f); if(i==1)return mix(u_colors[1],u_colors[2],f); if(i==2)return mix(u_colors[2],u_colors[3],f); if(i==3)return mix(u_colors[3],u_colors[4],f); if(i==4)return mix(u_colors[4],u_colors[5],f); if(i==5)return mix(u_colors[5],u_colors[6],f); return mix(u_colors[6],u_colors[7],f); }

void main(){
  vec2 uv=(gl_FragCoord.xy-.5*u_resolution.xy)/u_resolution.y;
  float auroraTime=u_time*1.41*(u_speed/2.07)*u_animate;
  vec2 a=uv*u_zoom;
  a=mat2(cos(u_rotate),-sin(u_rotate),sin(u_rotate),cos(u_rotate))*a;
  a+=u_offset;
  a+=u_drift*vec2(sin(auroraTime*.31),cos(auroraTime*.23));
  a+=u_warp*(vec2(auroraFbm(a*3.2+u_seed),auroraFbm(a*3.2+vec2(5.2,1.3)+u_seed))-.5);
  float d=length(uv-u_pointer);
  a+=normalize(uv-u_pointer+0.0001)*smoothstep(u_cursor_radius,0.,d)*u_cursor_strength*.65;
  float curtain=auroraFbm(vec2(a.x*2.+auroraTime*.15,a.y*.6-auroraTime*.05)+u_seed);
  float band=auroraFbm(vec2(a.x*3.5-auroraTime*.1,curtain*(2.+u_intensity*3.)));
  float v=smoothstep(.15,.85,band)*(1.-abs(a.y)*.7);
  vec3 auroraColor=gradient(clamp(v,0.,1.));
  auroraColor=(auroraColor-.5)*1.2+.5;
  float vd=length(gl_FragCoord.xy/u_resolution.xy-.5)*1.41421356;
  auroraColor*=1.-.07*smoothstep(.35,1.,vd);
  auroraColor+=(auroraHash(gl_FragCoord.xy+u_seed)-.5)*u_grain;
  gl_FragColor=vec4(clamp(auroraColor,0.,1.),1.);
}
`

type AuroraShaderBackgroundProps = {
  className?: string
  targetRef?: React.RefObject<HTMLElement | null>
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

function AuroraShaderBackgroundComponent({ className, targetRef }: AuroraShaderBackgroundProps) {
  const rootRef = React.useRef<HTMLDivElement>(null)
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const pointerRef = React.useRef({ x: 0, y: 0 })
  const isVisibleRef = React.useRef(true)
  const isHoveredRef = React.useRef(false)
  const targetRefRef = React.useRef(targetRef)
  targetRefRef.current = targetRef

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
    const intensityLocation = gl.getUniformLocation(program, "u_intensity")
    const zoomLocation = gl.getUniformLocation(program, "u_zoom")
    const warpLocation = gl.getUniformLocation(program, "u_warp")
    const speedLocation = gl.getUniformLocation(program, "u_speed")
    const grainLocation = gl.getUniformLocation(program, "u_grain")
    const driftLocation = gl.getUniformLocation(program, "u_drift")
    const animateLocation = gl.getUniformLocation(program, "u_animate")
    const rotateLocation = gl.getUniformLocation(program, "u_rotate")
    const seedLocation = gl.getUniformLocation(program, "u_seed")
    const smoothBlendLocation = gl.getUniformLocation(program, "u_smooth_blend")
    const offsetLocation = gl.getUniformLocation(program, "u_offset")
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

    gl.useProgram(program)
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.enableVertexAttribArray(positionLocation)
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0)

    gl.uniform1f(intensityLocation, AURORA_SHADER_UNIFORMS.intensity)
    gl.uniform1f(zoomLocation, AURORA_SHADER_UNIFORMS.zoom)
    gl.uniform1f(warpLocation, AURORA_SHADER_UNIFORMS.warp)
    gl.uniform1f(speedLocation, AURORA_SHADER_UNIFORMS.speed)
    gl.uniform1f(grainLocation, AURORA_SHADER_UNIFORMS.grain)
    gl.uniform1f(driftLocation, AURORA_SHADER_UNIFORMS.drift)
    gl.uniform1f(animateLocation, AURORA_SHADER_UNIFORMS.animate)
    gl.uniform1f(rotateLocation, AURORA_SHADER_UNIFORMS.rotate)
    gl.uniform1f(seedLocation, AURORA_SHADER_UNIFORMS.seed)
    gl.uniform1f(smoothBlendLocation, AURORA_SHADER_UNIFORMS.smoothBlend)
    gl.uniform2f(offsetLocation, AURORA_SHADER_UNIFORMS.offsetX, AURORA_SHADER_UNIFORMS.offsetY)
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

    const shouldAnimate = () => isVisibleRef.current && isHoveredRef.current

    const drawFrame = (now: number) => {
      const time = shouldAnimate() ? (now - startTime) / 1000 : frozenTime
      if (shouldAnimate()) {
        frozenTime = time
      }

      gl.uniform2f(resolutionLocation, resolution[0], resolution[1])
      gl.uniform1f(timeLocation, time)
      gl.uniform2f(pointerLocation, pointerRef.current.x, pointerRef.current.y)
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

    const handlePointerMove = (event: PointerEvent) => {
      if (pointerRaf !== 0) return
      pointerRaf = window.requestAnimationFrame(() => {
        pointerRaf = 0
        const rect = eventTarget().getBoundingClientRect()
        const [uvX, uvY] = pointerToUv(event.clientX, event.clientY, rect, resolution)
        pointerRef.current = { x: uvX, y: uvY }
        if (shouldAnimate()) {
          drawFrame(performance.now())
        }
      })
    }

    const handlePointerEnter = () => {
      isHoveredRef.current = true
      startLoop()
    }

    const handlePointerLeave = () => {
      isHoveredRef.current = false
      pointerRef.current = { x: 0, y: 0 }
      stopLoop()
    }

    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        isVisibleRef.current = entries.some((entry) => entry.isIntersecting)
        if (isVisibleRef.current && shouldAnimate()) {
          startLoop()
        } else {
          stopLoop()
        }
      },
      { threshold: 0 },
    )

    const resizeObserver =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null

    const targetElement = eventTarget()

    resize()
    drawFrame(performance.now())
    intersectionObserver.observe(root)
    resizeObserver?.observe(targetElement)
    targetElement.addEventListener("pointerenter", handlePointerEnter)
    targetElement.addEventListener("pointerleave", handlePointerLeave)
    targetElement.addEventListener("pointermove", handlePointerMove, { passive: true })

    return () => {
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

  return (
    <div ref={rootRef} aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" />
    </div>
  )
}

export const AuroraShaderBackground = React.memo(AuroraShaderBackgroundComponent)
