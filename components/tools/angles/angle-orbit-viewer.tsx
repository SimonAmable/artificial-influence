"use client"

import * as React from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { CaretDown, CaretLeft, CaretRight, CaretUp } from "@phosphor-icons/react"
import * as THREE from "three"

import {
  normalizeAngleState,
  sanitizeAngleState,
  zoomToOrbitRadius,
} from "@/lib/angles/camera-math"
import type { AngleState } from "@/lib/angles/types"
import { cn } from "@/lib/utils"

type AngleOrbitViewerProps = {
  imageUrl?: string
  value: AngleState
  onChange: (value: AngleState) => void
  disabled?: boolean
}

const VIEWER_ORBIT_RADIUS = {
  minRadius: 1,
  maxRadius: 1.65,
} as const

const DRAG_ROTATION_SENSITIVITY = 0.55
const DRAG_TILT_SENSITIVITY = 0.38
const WHEEL_ZOOM_SENSITIVITY = 0.02

function OrbitCameraRig({ value }: { value: AngleState }) {
  const rigRef = React.useRef<THREE.Group>(null)
  const globeRef = React.useRef<THREE.Group>(null)
  const cameraGroupRef = React.useRef<THREE.Group>(null)
  const tetherRef = React.useRef<THREE.Mesh>(null)
  const markerRef = React.useRef<THREE.Mesh>(null)

  const target = React.useMemo(() => {
    const sanitized = sanitizeAngleState(value)
    return {
      azimuth: (sanitized.rotation * Math.PI) / 180,
      elevation: (sanitized.tilt * Math.PI) / 180,
      radius: zoomToOrbitRadius(sanitized.zoom, VIEWER_ORBIT_RADIUS),
    }
  }, [value])

  const current = React.useRef({ ...target })

  useFrame((_, delta) => {
    const alpha = 1 - Math.exp(-delta * 16)
    const state = current.current
    state.azimuth = THREE.MathUtils.lerp(state.azimuth, target.azimuth, alpha)
    state.elevation = THREE.MathUtils.lerp(state.elevation, target.elevation, alpha)
    state.radius = THREE.MathUtils.lerp(state.radius, target.radius, alpha)

    const radius = Math.max(state.radius, 0.0001)

    if (rigRef.current) {
      // Matches angleStateToCameraPosition: Yaw then pitch, camera rests on +Z.
      rigRef.current.rotation.order = "YXZ"
      rigRef.current.rotation.y = state.azimuth
      rigRef.current.rotation.x = -state.elevation
      rigRef.current.rotation.z = 0
    }

    if (globeRef.current) {
      globeRef.current.scale.setScalar(radius)
    }

    if (cameraGroupRef.current) {
      cameraGroupRef.current.position.set(0, 0, radius)
      cameraGroupRef.current.lookAt(0, 0, 0)
    }

    if (markerRef.current) {
      markerRef.current.position.set(0, 0, radius)
      markerRef.current.lookAt(0, 0, 0)
    }

    if (tetherRef.current) {
      tetherRef.current.position.set(0, 0, radius * 0.5)
      tetherRef.current.scale.set(1, radius, 1)
    }
  })

  return (
    <>
      <ambientLight intensity={0.85} />

      <group ref={rigRef}>
        <group ref={globeRef}>
          <mesh>
            <sphereGeometry args={[1, 36, 22]} />
            <meshBasicMaterial
              color="#64748b"
              wireframe
              transparent
              opacity={0.22}
              depthWrite={false}
            />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[1.002, 0.007, 8, 96]} />
            <meshBasicMaterial color="#94a3b8" transparent opacity={0.32} />
          </mesh>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <torusGeometry args={[1.002, 0.007, 8, 96]} />
            <meshBasicMaterial color="#94a3b8" transparent opacity={0.24} />
          </mesh>
          <mesh rotation={[0, Math.PI / 2, 0]}>
            <torusGeometry args={[1.002, 0.007, 8, 96]} />
            <meshBasicMaterial color="#94a3b8" transparent opacity={0.24} />
          </mesh>
        </group>

        <mesh ref={tetherRef} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.01, 0.01, 1, 8]} />
          <meshBasicMaterial color="#94a3b8" transparent opacity={0.45} depthWrite={false} />
        </mesh>

        <mesh ref={markerRef}>
          <ringGeometry args={[0.07, 0.105, 28]} />
          <meshBasicMaterial
            color="#cbd5e1"
            transparent
            opacity={0.9}
            side={THREE.DoubleSide}
            depthTest={false}
          />
        </mesh>

        <group ref={cameraGroupRef}>
          <mesh>
            <boxGeometry args={[0.28, 0.2, 0.22]} />
            <meshBasicMaterial color="#94a3b8" transparent opacity={0.95} depthTest={false} />
          </mesh>
          <mesh position={[0, 0.13, -0.02]}>
            <boxGeometry args={[0.13, 0.08, 0.12]} />
            <meshBasicMaterial color="#64748b" transparent opacity={0.92} depthTest={false} />
          </mesh>
          <mesh position={[0, 0, 0.18]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.08, 0.11, 0.16, 12]} />
            <meshBasicMaterial
              color="#e2e8f0"
              wireframe
              transparent
              opacity={0.95}
              depthTest={false}
            />
          </mesh>
        </group>
      </group>
    </>
  )
}

export function AngleOrbitViewer({
  imageUrl,
  value,
  onChange,
  disabled = false,
}: AngleOrbitViewerProps) {
  const dragStartRef = React.useRef<{
    pointerId: number
    x: number
    y: number
    value: AngleState
  } | null>(null)

  const updateValue = React.useCallback(
    (patch: Partial<AngleState>) => {
      if (disabled) return
      onChange(normalizeAngleState({ ...value, ...patch }))
    },
    [disabled, onChange, value],
  )

  const handlePointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (disabled) return
      event.currentTarget.setPointerCapture(event.pointerId)
      dragStartRef.current = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        value,
      }
    },
    [disabled, value],
  )

  const handlePointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const start = dragStartRef.current
      if (!start || start.pointerId !== event.pointerId) return

      // Globe-grab: finger spins the sphere; camera stays locked to the surface.
      const deltaX = event.clientX - start.x
      const deltaY = event.clientY - start.y
      onChange(
        sanitizeAngleState({
          ...start.value,
          rotation: start.value.rotation - deltaX * DRAG_ROTATION_SENSITIVITY,
          tilt: start.value.tilt + deltaY * DRAG_TILT_SENSITIVITY,
        }),
      )
    },
    [onChange],
  )

  const stopDragging = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (dragStartRef.current?.pointerId !== event.pointerId) return
      dragStartRef.current = null
      onChange(normalizeAngleState(value))
    },
    [onChange, value],
  )

  const handleWheel = React.useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      if (disabled) return
      event.preventDefault()
      onChange(
        normalizeAngleState({
          ...value,
          zoom: value.zoom - event.deltaY * WHEEL_ZOOM_SENSITIVITY,
        }),
      )
    },
    [disabled, onChange, value],
  )

  return (
    <div
      role="application"
      aria-label="Camera angle controller"
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      className={cn(
        "relative isolate h-[286px] touch-none select-none overflow-hidden rounded-3xl border border-border/50 bg-muted/35 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-grab active:cursor-grabbing",
      )}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={stopDragging}
      onPointerCancel={stopDragging}
      onWheel={handleWheel}
      onKeyDown={(event) => {
        if (disabled) return
        if (event.key === "ArrowLeft") updateValue({ rotation: value.rotation - 5 })
        else if (event.key === "ArrowRight") updateValue({ rotation: value.rotation + 5 })
        else if (event.key === "ArrowUp") updateValue({ tilt: value.tilt + 2 })
        else if (event.key === "ArrowDown") updateValue({ tilt: value.tilt - 2 })
        else if (event.key === "+" || event.key === "=") updateValue({ zoom: value.zoom + 1 })
        else if (event.key === "-" || event.key === "_") updateValue({ zoom: value.zoom - 1 })
        else return
        event.preventDefault()
      }}
    >
      <div className="pointer-events-none absolute inset-x-6 top-4 z-20 text-center text-xs leading-5 text-muted-foreground">
        Drag the globe to aim
        <br />
        Scroll to zoom
      </div>

      <Canvas
        orthographic
        camera={{ position: [0, 0, 6], zoom: 76, near: 0.1, far: 100 }}
        dpr={[1, 1.5]}
        gl={{ alpha: true, antialias: true }}
        className="!absolute !inset-0 !z-0"
        fallback={
          <div className="flex h-full items-center justify-center px-8 text-center text-sm text-muted-foreground">
            Use the sliders below to set your angle.
          </div>
        }
      >
        <OrbitCameraRig value={value} />
      </Canvas>

      <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 size-[66px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-border/70 bg-background shadow-lg">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="" className="size-full object-cover" draggable={false} />
        ) : (
          <div className="flex size-full items-center justify-center bg-muted text-[10px] text-muted-foreground">
            Add image
          </div>
        )}
      </div>

      <OrbitStepButton
        label="Tilt camera up"
        className="left-1/2 top-[55px] -translate-x-1/2"
        onClick={() => updateValue({ tilt: value.tilt + 5 })}
        disabled={disabled}
      >
        <CaretUp />
      </OrbitStepButton>
      <OrbitStepButton
        label="Rotate camera left"
        className="left-5 top-1/2 -translate-y-1/2"
        onClick={() => updateValue({ rotation: value.rotation - 45 })}
        disabled={disabled}
      >
        <CaretLeft />
      </OrbitStepButton>
      <OrbitStepButton
        label="Rotate camera right"
        className="right-5 top-1/2 -translate-y-1/2"
        onClick={() => updateValue({ rotation: value.rotation + 45 })}
        disabled={disabled}
      >
        <CaretRight />
      </OrbitStepButton>
      <OrbitStepButton
        label="Tilt camera down"
        className="bottom-4 left-1/2 -translate-x-1/2"
        onClick={() => updateValue({ tilt: value.tilt - 5 })}
        disabled={disabled}
      >
        <CaretDown />
      </OrbitStepButton>
    </div>
  )
}

function OrbitStepButton({
  label,
  className,
  onClick,
  disabled,
  children,
}: {
  label: string
  className: string
  onClick: () => void
  disabled: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      className={cn(
        "absolute z-30 flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background/80 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none",
        className,
      )}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
