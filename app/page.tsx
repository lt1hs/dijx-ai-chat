"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

// TypeScript declaration for custom element
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'pixel-canvas': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        'data-gap'?: number;
        'data-speed'?: number;
        'data-colors'?: string;
        'data-variant'?: string;
        'data-no-focus'?: string;
      };
    }
  }
}

// Pixel Canvas Component
class Pixel {
  width: number
  height: number
  ctx: CanvasRenderingContext2D
  x: number
  y: number
  color: string
  speed: number
  size: number
  sizeStep: number
  minSize: number
  maxSizeInteger: number
  maxSize: number
  delay: number
  counter: number
  counterStep: number
  isIdle: boolean
  isReverse: boolean
  isShimmer: boolean

  constructor(
    canvas: HTMLCanvasElement,
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    color: string,
    speed: number,
    delay: number,
  ) {
    this.width = canvas.width
    this.height = canvas.height
    this.ctx = context
    this.x = x
    this.y = y
    this.color = color
    this.speed = this.getRandomValue(0.1, 0.9) * speed
    this.size = 0
    this.sizeStep = Math.random() * 0.4
    this.minSize = 0.5
    this.maxSizeInteger = 2
    this.maxSize = this.getRandomValue(this.minSize, this.maxSizeInteger)
    this.delay = delay
    this.counter = 0
    this.counterStep = Math.random() * 4 + (this.width + this.height) * 0.01
    this.isIdle = false
    this.isReverse = false
    this.isShimmer = false
  }

  getRandomValue(min: number, max: number) {
    return Math.random() * (max - min) + min
  }

  draw() {
    const centerOffset = this.maxSizeInteger * 0.5 - this.size * 0.5
    this.ctx.fillStyle = this.color
    this.ctx.fillRect(
      this.x + centerOffset,
      this.y + centerOffset,
      this.size,
      this.size,
    )
  }

  appear() {
    this.isIdle = false

    if (this.counter <= this.delay) {
      this.counter += this.counterStep
      return
    }

    if (this.size >= this.maxSize) {
      this.isShimmer = true
    }

    if (this.isShimmer) {
      this.shimmer()
    } else {
      this.size += this.sizeStep
    }

    this.draw()
  }

  disappear() {
    this.isShimmer = false
    this.counter = 0

    if (this.size <= 0) {
      this.isIdle = true
      return
    } else {
      this.size -= 0.1
    }

    this.draw()
  }

  shimmer() {
    if (this.size >= this.maxSize) {
      this.isReverse = true
    } else if (this.size <= this.minSize) {
      this.isReverse = false
    }

    if (this.isReverse) {
      this.size -= this.speed
    } else {
      this.size += this.speed
    }
  }
}

// Pixel Canvas Component - Client Side Only
let PixelCanvasElement: any;

if (typeof window !== 'undefined') {
  class PixelCanvasElementImpl extends HTMLElement {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D | null
  private pixels: Pixel[] = []
  private animation: number | null = null
  private timeInterval: number = 1000 / 60
  private timePrevious: number = performance.now()
  private reducedMotion: boolean
  private _initialized: boolean = false
  private _resizeObserver: ResizeObserver | null = null
  private _parent: Element | null = null

  constructor() {
    super()
    this.canvas = document.createElement("canvas")
    this.ctx = this.canvas.getContext("2d")
    this.reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches

    const shadow = this.attachShadow({ mode: "open" })
    const style = document.createElement("style")
    style.textContent = `
      :host {
        display: grid;
        inline-size: 100%;
        block-size: 100%;
        overflow: hidden;
      }
    `
    shadow.appendChild(style)
    shadow.appendChild(this.canvas)
  }

  get colors() {
    return this.dataset.colors?.split(",") || ["#f8fafc", "#f1f5f9", "#cbd5e1"]
  }

  get gap() {
    const value = Number(this.dataset.gap) || 5
    return Math.max(4, Math.min(50, value))
  }

  get speed() {
    const value = Number(this.dataset.speed) || 35
    return this.reducedMotion ? 0 : Math.max(0, Math.min(100, value)) * 0.001
  }

  get noFocus() {
    return this.hasAttribute("data-no-focus")
  }

  get variant() {
    return this.dataset.variant || "default"
  }

  connectedCallback() {
    if (this._initialized) return
    this._initialized = true
    this._parent = this.parentElement

    requestAnimationFrame(() => {
      this.handleResize()

      const ro = new ResizeObserver((entries) => {
        if (!entries.length) return
        requestAnimationFrame(() => this.handleResize())
      })
      ro.observe(this)
      this._resizeObserver = ro
    })

    this._parent?.addEventListener("mouseenter", () =>
      this.handleAnimation("appear"),
    )
    this._parent?.addEventListener("mouseleave", () =>
      this.handleAnimation("disappear"),
    )

    if (!this.noFocus) {
      this._parent?.addEventListener(
        "focus",
        () => this.handleAnimation("appear"),
        { capture: true },
      )
      this._parent?.addEventListener(
        "blur",
        () => this.handleAnimation("disappear"),
        { capture: true },
      )
    }
  }

  disconnectedCallback() {
    this._initialized = false
    this._resizeObserver?.disconnect()

    this._parent?.removeEventListener("mouseenter", () =>
      this.handleAnimation("appear"),
    )
    this._parent?.removeEventListener("mouseleave", () =>
      this.handleAnimation("disappear"),
    )

    if (!this.noFocus) {
      this._parent?.removeEventListener("focus", () =>
        this.handleAnimation("appear"),
      )
      this._parent?.removeEventListener("blur", () =>
        this.handleAnimation("disappear"),
      )
    }

    if (this.animation) {
      cancelAnimationFrame(this.animation)
      this.animation = null
    }

    this._parent = null
  }

  handleResize() {
    if (!this.ctx || !this._initialized) return

    const rect = this.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return

    const width = Math.floor(rect.width)
    const height = Math.floor(rect.height)

    const dpr = window.devicePixelRatio || 1
    this.canvas.width = width * dpr
    this.canvas.height = height * dpr
    this.canvas.style.width = `${width}px`
    this.canvas.style.height = `${height}px`

    this.ctx.setTransform(1, 0, 0, 1, 0, 0)
    this.ctx.scale(dpr, dpr)

    this.createPixels()
  }

  getDistanceToCenter(x: number, y: number) {
    const dx = x - this.canvas.width / 2
    const dy = y - this.canvas.height / 2
    return Math.sqrt(dx * dx + dy * dy)
  }

  getDistanceToBottomLeft(x: number, y: number) {
    const dx = x
    const dy = this.canvas.height - y
    return Math.sqrt(dx * dx + dy * dy)
  }

  createPixels() {
    if (!this.ctx) return
    this.pixels = []

    for (let x = 0; x < this.canvas.width; x += this.gap) {
      for (let y = 0; y < this.canvas.height; y += this.gap) {
        const color =
          this.colors[Math.floor(Math.random() * this.colors.length)]
        let delay = 0

        if (this.variant === "icon") {
          delay = this.reducedMotion ? 0 : this.getDistanceToCenter(x, y)
        } else {
          delay = this.reducedMotion ? 0 : this.getDistanceToBottomLeft(x, y)
        }

        this.pixels.push(
          new Pixel(this.canvas, this.ctx, x, y, color, this.speed, delay),
        )
      }
    }
  }

  handleAnimation(name: "appear" | "disappear") {
    if (this.animation) {
      cancelAnimationFrame(this.animation)
    }

    const animate = () => {
      this.animation = requestAnimationFrame(animate)

      const timeNow = performance.now()
      const timePassed = timeNow - this.timePrevious

      if (timePassed < this.timeInterval) return

      this.timePrevious = timeNow - (timePassed % this.timeInterval)

      if (!this.ctx) return
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)

      let allIdle = true
      for (const pixel of this.pixels) {
        pixel[name]()
        if (!pixel.isIdle) allIdle = false
      }

      if (allIdle) {
        cancelAnimationFrame(this.animation)
        this.animation = null
      }
    }

    animate()
  }
}

  PixelCanvasElement = PixelCanvasElementImpl;
}

const PixelCanvas = React.forwardRef<HTMLDivElement, any>(
  ({ gap, speed, colors, variant, noFocus, style, ...props }, ref) => {
    const [isClient, setIsClient] = React.useState(false);

    React.useEffect(() => {
      setIsClient(true);
      if (PixelCanvasElement && !customElements.get("pixel-canvas")) {
        customElements.define("pixel-canvas", PixelCanvasElement);
      }
    }, []);

    if (!isClient) {
      return <div style={{ width: '100%', height: '100%', ...style }} />;
    }

    return (
      <pixel-canvas
        ref={ref}
        data-gap={gap}
        data-speed={speed}
        data-colors={colors?.join(",")}
        data-variant={variant}
        {...(noFocus && { "data-no-focus": "" })}
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          width: '100%',
          height: '100%',
          ...style
        }}
        {...props}
      />
    )
  }
)
PixelCanvas.displayName = "PixelCanvas"

// Star Background Component
function StarBackground({ color }: { color?: string }) {
  return (
    <svg
      width="100%"
      height="100%"
      preserveAspectRatio="none"
      viewBox="0 0 100 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g clipPath="url(#clip0_408_119)">
        <path
          d="M32.34 26.68C32.34 26.3152 32.0445 26.02 31.68 26.02C31.3155 26.02 31.02 26.3152 31.02 26.68C31.02 27.0448 31.3155 27.34 31.68 27.34C32.0445 27.34 32.34 27.0448 32.34 26.68Z"
          fill="black"
        />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M56.1 3.96C56.4645 3.96 56.76 4.25519 56.76 4.62C56.76 4.98481 56.4645 5.28 56.1 5.28C55.9131 5.28 55.7443 5.20201 55.624 5.07762C55.5632 5.01446 55.5147 4.93904 55.4829 4.8559C55.4552 4.78243 55.44 4.70315 55.44 4.62C55.44 4.5549 55.4494 4.49174 55.4668 4.43244C55.4906 4.35188 55.5292 4.27775 55.5795 4.21329C55.7004 4.05926 55.8885 3.96 56.1 3.96ZM40.26 17.16C40.6245 17.16 40.92 17.4552 40.92 17.82C40.92 18.1848 40.6245 18.48 40.26 18.48C39.8955 18.48 39.6 18.1848 39.6 17.82C39.6 17.4552 39.8955 17.16 40.26 17.16ZM74.58 5.28C74.7701 5.28 74.9413 5.36057 75.0618 5.48882C75.073 5.50043 75.0837 5.51268 75.094 5.52557C75.1088 5.54426 75.1231 5.56359 75.1359 5.58357L75.1479 5.60291L75.1595 5.62353C75.1711 5.64481 75.1814 5.66672 75.1906 5.68928C75.2226 5.76662 75.24 5.85106 75.24 5.94C75.24 6.1585 75.1336 6.3525 74.9699 6.47238C74.9158 6.51234 74.8555 6.54393 74.7908 6.56584C74.7247 6.58775 74.6538 6.6 74.58 6.6C74.2156 6.6 73.92 6.30481 73.92 5.94C73.92 5.87684 73.929 5.8156 73.9455 5.7576C73.9596 5.70862 73.979 5.66221 74.0032 5.61903C74.0657 5.50688 74.1595 5.41471 74.2728 5.35541C74.3647 5.30707 74.4691 5.28 74.58 5.28ZM21.66 33.52C22.0245 33.52 22.32 33.8152 22.32 34.18C22.32 34.5448 22.0245 34.84 21.66 34.84C21.2955 34.84 21 34.5448 21 34.18C21 33.8152 21.2955 33.52 21.66 33.52ZM8.16 32.86C8.16 32.4952 7.8645 32.2 7.5 32.2C7.1355 32.2 6.84 32.4952 6.84 32.86C6.84 33.2248 7.1355 33.52 7.5 33.52C7.8645 33.52 8.16 33.2248 8.16 32.86ZM7.5 23.68C7.8645 23.68 8.16 23.9752 8.16 24.34C8.16 24.7048 7.8645 25 7.5 25C7.1355 25 6.84 24.7048 6.84 24.34C6.84 23.9752 7.1355 23.68 7.5 23.68ZM19.32 18.48C19.32 18.1152 19.0245 17.82 18.66 17.82C18.2955 17.82 18 18.1152 18 18.48C18 18.8448 18.2955 19.14 18.66 19.14C19.0245 19.14 19.32 18.8448 19.32 18.48ZM5.66 11.84C6.0245 11.84 6.32001 12.1352 6.32001 12.5C6.32001 12.8648 6.0245 13.16 5.66 13.16C5.2955 13.16 5 12.8648 5 12.5C5 12.1352 5.2955 11.84 5.66 11.84ZM35.16 35.5C35.16 35.1352 34.8645 34.84 34.5 34.84C34.1355 34.84 33.84 35.1352 33.84 35.5C33.84 35.8648 34.1355 36.16 34.5 36.16C34.8645 36.16 35.16 35.8648 35.16 35.5ZM53.5 36.18C53.8645 36.18 54.16 36.4752 54.16 36.84C54.16 37.2048 53.8645 37.5 53.5 37.5C53.1355 37.5 52.84 37.2048 52.84 36.84C52.84 36.4752 53.1355 36.18 53.5 36.18ZM48.5 28.66C48.5 28.2952 48.2045 28 47.84 28C47.4755 28 47.18 28.2952 47.18 28.66C47.18 29.0248 47.4755 29.32 47.84 29.32C48.2045 29.32 48.5 29.0248 48.5 28.66ZM60.34 27.34C60.7045 27.34 61 27.6352 61 28C61 28.3648 60.7045 28.66 60.34 28.66C59.9755 28.66 59.68 28.3648 59.68 28C59.68 27.6352 59.9755 27.34 60.34 27.34ZM56.284 16.5C56.284 16.1352 55.9885 15.84 55.624 15.84C55.2595 15.84 54.964 16.1352 54.964 16.5C54.964 16.8648 55.2595 17.16 55.624 17.16C55.9885 17.16 56.284 16.8648 56.284 16.5ZM46.2 7.26C46.2 6.89519 45.9045 6.6 45.54 6.6C45.5174 6.6 45.4953 6.60129 45.4733 6.60387L45.453 6.60579L45.4124 6.61225L45.3857 6.61804L45.3845 6.61836C45.3675 6.62277 45.3504 6.62721 45.3341 6.63287C45.2522 6.65929 45.1774 6.70184 45.1134 6.75597C45.0627 6.79916 45.0186 6.84943 44.9828 6.90551C44.9178 7.00799 44.88 7.12981 44.88 7.26C44.88 7.62481 45.1755 7.92 45.54 7.92C45.7372 7.92 45.9141 7.83363 46.0353 7.69635C46.0808 7.64478 46.1182 7.58613 46.1459 7.52232C46.1807 7.4424 46.2 7.35346 46.2 7.26ZM33 9.34C33 8.9752 32.7045 8.68 32.34 8.68C31.9755 8.68 31.68 8.9752 31.68 9.34C31.68 9.7048 31.9755 10 32.34 10C32.7045 10 33 9.7048 33 9.34ZM16 4.8559C16.3645 4.8559 16.66 5.1511 16.66 5.5159C16.66 5.8807 16.3645 6.1759 16 6.1759C15.6355 6.1759 15.34 5.8807 15.34 5.5159C15.34 5.1511 15.6355 4.8559 16 4.8559ZM69.66 21.16C69.66 20.7952 69.3645 20.5 69 20.5C68.6355 20.5 68.34 20.7952 68.34 21.16C68.34 21.5248 68.6355 21.82 69 21.82C69.3645 21.82 69.66 21.5248 69.66 21.16ZM80.52 15.18C80.52 14.8152 80.2245 14.52 79.86 14.52C79.4956 14.52 79.2 14.8152 79.2 15.18C79.2 15.5448 79.4956 15.84 79.86 15.84C80.2245 15.84 80.52 15.5448 80.52 15.18ZM78.16 34.84C78.16 34.4752 77.5 34.18 77.5 34.18C77.5 34.18 76.84 34.4752 76.84 34.84C76.84 35.2048 77.1355 35.5 77.5 35.5C77.8645 35.5 78.16 35.2048 78.16 34.84ZM85.66 24.34C86.0245 24.34 86.32 24.6352 86.32 25C86.32 25.3648 86.0245 25.66 85.66 25.66C85.2955 25.66 85 25.3648 85 25C85 24.6352 85.2955 24.34 85.66 24.34ZM91.32 10C91.32 9.6352 91.0245 9.34 90.66 9.34C90.2955 9.34 90 9.6352 90 10C90 10.3648 90.2955 10.66 90.66 10.66C91.0245 10.66 91.32 10.3648 91.32 10ZM138.6 0H0V46.2H138.6V0ZM92.64 34.84C92.64 34.4752 91.98 34.18 91.98 34.18C91.98 34.18 91.32 34.4752 91.32 34.84C91.32 35.2048 91.6155 35.5 91.98 35.5C92.3445 35.5 92.64 35.2048 92.64 34.84Z"
          fill={color || "#4169e1"}
        />
      </g>
      <defs>
        <clipPath id="clip0_408_119">
          <rect width="100" height="40" fill="white" />
        </clipPath>
      </defs>
    </svg>
  );
}

type Uniforms = {
  [key: string]: {
    value: number[] | number[][] | number;
    type: string;
  };
};

interface ShaderProps {
  source: string;
  uniforms: Uniforms;
  maxFps?: number;
}

interface SignInPageProps {
  className?: string;
}

const Shader: React.FC<ShaderProps> = ({ source, uniforms, maxFps = 60 }) => {
  return (
    <Canvas className="absolute inset-0 h-full w-full">
      <ShaderMaterial source={source} uniforms={uniforms} maxFps={maxFps} />
    </Canvas>
  );
};

const ShaderMaterial = ({ source, uniforms, maxFps = 60 }: { source: string; uniforms: Uniforms; maxFps?: number }) => {
  const { size } = useThree();
  const ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const material: any = ref.current.material;
    material.uniforms.u_time.value = clock.getElapsedTime();
  });

  const material = useMemo(() => {
    const preparedUniforms: any = {};
    
    for (const uniformName in uniforms) {
      const uniform = uniforms[uniformName];
      switch (uniform.type) {
        case "uniform1f":
          preparedUniforms[uniformName] = { value: uniform.value };
          break;
        case "uniform1i":
          preparedUniforms[uniformName] = { value: uniform.value };
          break;
        case "uniform1fv":
          preparedUniforms[uniformName] = { value: uniform.value };
          break;
        case "uniform3fv":
          preparedUniforms[uniformName] = {
            value: (uniform.value as number[][]).map((v: number[]) => new THREE.Vector3().fromArray(v))
          };
          break;
      }
    }

    preparedUniforms["u_time"] = { value: 0 };
    preparedUniforms["u_resolution"] = { value: new THREE.Vector2(size.width * 2, size.height * 2) };

    return new THREE.ShaderMaterial({
      vertexShader: `
        precision mediump float;
        uniform vec2 u_resolution;
        out vec2 fragCoord;
        void main(){
          gl_Position = vec4(position.xy, 0.0, 1.0);
          fragCoord = (position.xy + vec2(1.0)) * 0.5 * u_resolution;
          fragCoord.y = u_resolution.y - fragCoord.y;
        }
      `,
      fragmentShader: source,
      uniforms: preparedUniforms,
      glslVersion: THREE.GLSL3,
      blending: THREE.CustomBlending,
      blendSrc: THREE.SrcAlphaFactor,
      blendDst: THREE.OneFactor,
    });
  }, [size.width, size.height, source, uniforms]);

  return (
    <mesh ref={ref}>
      <planeGeometry args={[2, 2]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
};

const DotMatrix = ({ colors = [[0, 0, 0]], opacities = [0.04, 0.04, 0.04, 0.04, 0.04, 0.08, 0.08, 0.08, 0.08, 0.14], totalSize = 20, dotSize = 2, shader = "", center = ["x", "y"] }: { colors?: number[][]; opacities?: number[]; totalSize?: number; dotSize?: number; shader?: string; center?: ("x" | "y")[]; }) => {
  const uniforms = useMemo(() => {
    let colorsArray = [colors[0], colors[0], colors[0], colors[0], colors[0], colors[0]];
    if (colors.length === 2) {
      colorsArray = [colors[0], colors[0], colors[0], colors[1], colors[1], colors[1]];
    } else if (colors.length === 3) {
      colorsArray = [colors[0], colors[0], colors[1], colors[1], colors[2], colors[2]];
    }
    
    return {
      u_colors: { value: colorsArray.map((color) => [color[0] / 255, color[1] / 255, color[2] / 255]), type: "uniform3fv" },
      u_opacities: { value: opacities, type: "uniform1fv" },
      u_total_size: { value: totalSize, type: "uniform1f" },
      u_dot_size: { value: dotSize, type: "uniform1f" },
      u_reverse: { value: shader.includes("u_reverse_active") ? 1 : 0, type: "uniform1i" },
    };
  }, [colors, opacities, totalSize, dotSize, shader]);

  return (
    <Shader
      source={`
        precision mediump float;
        in vec2 fragCoord;
        uniform float u_time;
        uniform float u_opacities[10];
        uniform vec3 u_colors[6];
        uniform float u_total_size;
        uniform float u_dot_size;
        uniform vec2 u_resolution;
        uniform int u_reverse;
        out vec4 fragColor;

        float PHI = 1.61803398874989484820459;
        float random(vec2 xy) {
            return fract(tan(distance(xy * PHI, xy) * 0.5) * xy.x);
        }

        void main() {
            vec2 st = fragCoord.xy;
            ${center.includes("x") ? "st.x -= abs(floor((mod(u_resolution.x, u_total_size) - u_dot_size) * 0.5));" : ""}
            ${center.includes("y") ? "st.y -= abs(floor((mod(u_resolution.y, u_total_size) - u_dot_size) * 0.5));" : ""}

            float opacity = step(0.0, st.x) * step(0.0, st.y);
            vec2 st2 = vec2(int(st.x / u_total_size), int(st.y / u_total_size));

            float frequency = 5.0;
            float show_offset = random(st2);
            float rand = random(st2 * floor((u_time / frequency) + show_offset + frequency));
            opacity *= u_opacities[int(rand * 10.0)];
            opacity *= 1.0 - step(u_dot_size / u_total_size, fract(st.x / u_total_size));
            opacity *= 1.0 - step(u_dot_size / u_total_size, fract(st.y / u_total_size));

            vec3 color = u_colors[int(show_offset * 6.0)];

            float animation_speed_factor = 0.5;
            vec2 center_grid = u_resolution / 2.0 / u_total_size;
            float dist_from_center = distance(center_grid, st2);

            float timing_offset_intro = dist_from_center * 0.01 + (random(st2) * 0.15);
            float max_grid_dist = distance(center_grid, vec2(0.0, 0.0));
            float timing_offset_outro = (max_grid_dist - dist_from_center) * 0.02 + (random(st2 + 42.0) * 0.2);

            float current_timing_offset;
            if (u_reverse == 1) {
                current_timing_offset = timing_offset_outro;
                opacity *= 1.0 - step(current_timing_offset, u_time * animation_speed_factor);
                opacity *= clamp((step(current_timing_offset + 0.1, u_time * animation_speed_factor)) * 1.25, 1.0, 1.25);
            } else {
                current_timing_offset = timing_offset_intro;
                opacity *= step(current_timing_offset, u_time * animation_speed_factor);
                opacity *= clamp((1.0 - step(current_timing_offset + 0.1, u_time * animation_speed_factor)) * 1.25, 1.0, 1.25);
            }

            fragColor = vec4(color, opacity);
            fragColor.rgb *= fragColor.a;
        }`}
      uniforms={uniforms}
      maxFps={60}
    />
  );
};

export const CanvasRevealEffect = ({ animationSpeed = 10, opacities = [0.3, 0.3, 0.3, 0.5, 0.5, 0.5, 0.8, 0.8, 0.8, 1], colors = [[0, 255, 255]], containerClassName, dotSize, showGradient = true, reverse = false }: { animationSpeed?: number; opacities?: number[]; colors?: number[][]; containerClassName?: string; dotSize?: number; showGradient?: boolean; reverse?: boolean; }) => {
  return (
    <div className={cn("h-full relative w-full", containerClassName)}>
      <div className="h-full w-full">
        <DotMatrix
          colors={colors ?? [[0, 255, 255]]}
          dotSize={dotSize ?? 3}
          opacities={opacities ?? [0.3, 0.3, 0.3, 0.5, 0.5, 0.5, 0.8, 0.8, 0.8, 1]}
          shader={`${reverse ? 'u_reverse_active' : 'false'}_;animation_speed_factor_${animationSpeed.toFixed(1)}_;`}
          center={["x", "y"]}
        />
      </div>
      {showGradient && <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent" />}
    </div>
  );
};

const AnimatedNavLink = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a href={href} className="group relative inline-block overflow-hidden h-5 flex items-center text-sm">
    <div className="flex flex-col transition-transform duration-400 ease-out transform group-hover:-translate-y-1/2">
      <span className="text-gray-300">{children}</span>
      <span className="text-white">{children}</span>
    </div>
  </a>
);

function MiniNavbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [headerShapeClass, setHeaderShapeClass] = useState('rounded-full');
  const shapeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (shapeTimeoutRef.current) clearTimeout(shapeTimeoutRef.current);
    if (isOpen) {
      setHeaderShapeClass('rounded-xl');
    } else {
      shapeTimeoutRef.current = setTimeout(() => setHeaderShapeClass('rounded-full'), 300);
    }
    return () => { if (shapeTimeoutRef.current) clearTimeout(shapeTimeoutRef.current); };
  }, [isOpen]);

  const logoElement = (
    <div className="relative w-5 h-5 flex items-center justify-center">
      <span className="absolute w-1.5 h-1.5 rounded-full bg-gray-200 top-0 left-1/2 transform -translate-x-1/2 opacity-80"></span>
      <span className="absolute w-1.5 h-1.5 rounded-full bg-gray-200 left-0 top-1/2 transform -translate-y-1/2 opacity-80"></span>
      <span className="absolute w-1.5 h-1.5 rounded-full bg-gray-200 right-0 top-1/2 transform -translate-y-1/2 opacity-80"></span>
      <span className="absolute w-1.5 h-1.5 rounded-full bg-gray-200 bottom-0 left-1/2 transform -translate-x-1/2 opacity-80"></span>
    </div>
  );

  const navLinksData = [
    { label: 'البيان', href: '#1' },
    { label: 'الوظائف', href: '#2' },
    { label: 'اكتشف', href: '#3' },
  ];

  return (
    <header className={`fixed top-6 right-1/2 transform translate-x-1/2 z-20 flex flex-col items-center pl-6 pr-6 py-3 backdrop-blur-sm ${headerShapeClass} border border-[#333] bg-[#1f1f1f57] w-[calc(100%-2rem)] sm:w-auto transition-[border-radius] duration-0 ease-in-out`}>
      <div className="flex items-center justify-between w-full gap-x-6 sm:gap-x-8">
        <div className="flex items-center">{logoElement}</div>
        <nav className="hidden sm:flex items-center space-x-4 sm:space-x-6 text-sm">
          {navLinksData.map((link) => (
            <AnimatedNavLink key={link.href} href={link.href}>{link.label}</AnimatedNavLink>
          ))}
        </nav>
        <div className="hidden sm:flex items-center gap-2 sm:gap-3">
          <button className="px-4 py-2 sm:px-3 text-xs sm:text-sm border border-[#333] bg-[rgba(31,31,31,0.62)] text-gray-300 rounded-full hover:border-white/50 hover:text-white transition-colors duration-200 w-full sm:w-auto">تسجيل الدخول</button>
          <div className="relative group w-full sm:w-auto">
            <div className="absolute inset-0 -m-2 rounded-full hidden sm:block bg-gray-100 opacity-40 filter blur-lg pointer-events-none transition-all duration-300 ease-out group-hover:opacity-60 group-hover:blur-xl group-hover:-m-3"></div>
            <button className="relative z-10 px-4 py-2 sm:px-3 text-xs sm:text-sm font-semibold text-black bg-gradient-to-br from-gray-100 to-gray-300 rounded-full hover:from-gray-200 hover:to-gray-400 transition-all duration-200 w-full sm:w-auto">إنشاء حساب</button>
          </div>
        </div>
        <button className="sm:hidden flex items-center justify-center w-8 h-8 text-gray-300 focus:outline-none" onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
          )}
        </button>
      </div>
      <div className={`sm:hidden flex flex-col items-center w-full transition-all ease-in-out duration-300 overflow-hidden ${isOpen ? 'max-h-[1000px] opacity-100 pt-4' : 'max-h-0 opacity-0 pt-0 pointer-events-none'}`}>
        <nav className="flex flex-col items-center space-y-4 text-base w-full">
          {navLinksData.map((link) => (
            <a key={link.href} href={link.href} className="text-gray-300 hover:text-white transition-colors w-full text-center">{link.label}</a>
          ))}
        </nav>
      </div>
    </header>
  );
}

export const SignInPage = ({ className }: SignInPageProps) => {
  const [showAnimation, setShowAnimation] = useState(false);
  const [animationKey, setAnimationKey] = useState(0);
  const [messages, setMessages] = useState<{id: number, text: string, isUser: boolean}[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isChatMode, setIsChatMode] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;
    
    // Enable chat mode on first message
    if (!isChatMode) {
      setIsChatMode(true);
    }
    
    setShowAnimation(true);
    setAnimationKey(prev => prev + 1);
    setTimeout(() => setShowAnimation(false), 3000);
    
    // Add user message
    const userMessage = { id: Date.now(), text: inputValue, isUser: true };
    setMessages(prev => [...prev, userMessage]);
    const currentInput = inputValue;
    setInputValue("");
    setIsLoading(true);
    
    // Add AI response after delay
    setTimeout(async () => {
      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: [{ role: 'user', content: currentInput }]
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to get response');
        }

        const text = await response.text();
        console.log('Raw response:', text);
        
        // Parse the streaming response
        let aiText = '';
        const lines = text.split('\n');
        for (const line of lines) {
          if (line.startsWith('0:"') && line.endsWith('"')) {
            aiText = line.slice(3, -1);
            break;
          }
        }

        setIsLoading(false);
        const aiMessage = { 
          id: Date.now() + 1, 
          text: aiText || "مرحباً! أنا DIJ-X-V1، مساعدك الذكي من شركة دجلة للتكنولوجيا. كيف يمكنني مساعدتك اليوم؟", 
          isUser: false 
        };
        setMessages(prev => [...prev, aiMessage]);
      } catch (error) {
        console.error('Error:', error);
        setIsLoading(false);
        const errorMessage = { 
          id: Date.now() + 1, 
          text: "عذراً، حدث خطأ في النظام. يرجى المحاولة مرة أخرى.", 
          isUser: false 
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    }, 1000);
  };

  return (
    <div className={cn("flex w-[100%] flex-col min-h-screen bg-black relative", className)}>
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0">
          <CanvasRevealEffect animationSpeed={3} containerClassName="bg-black" colors={[[255, 255, 255], [255, 255, 255]]} dotSize={6} reverse={false} />
        </div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(0,0,0,1)_0%,_transparent_100%)]" />
        <div className="absolute top-0 left-0 right-0 h-1/3 bg-gradient-to-b from-black to-transparent" />
      </div>
      
      <div className="relative z-10 flex flex-col flex-1">
        <MiniNavbar />
        <div className="flex flex-1 flex-col lg:flex-row">
          <div className="flex-1 flex flex-col justify-center items-center">
            <div className="w-full mt-[150px] max-w-2xl">
              <motion.div 
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, ease: "easeOut", delay: 0.3 }}
                className="space-y-6 text-center"
              >
                <motion.div 
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.5 }}
                  className="space-y-1"
                >
                  <motion.h1 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.7, delay: 0.7 }}
                    className="text-[2.5rem] font-bold leading-[1.1] tracking-tight text-white"
                  >
                    المساعد الذكي
                  </motion.h1>
                  <motion.p 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.6, delay: 0.9 }}
                    className="text-[1.8rem] text-white/70 font-light"
                  >
                    كيف يمكنني مساعدتك اليوم؟
                  </motion.p>
                </motion.div>
                
                {/* Chat Messages */}
                <div className={`w-full max-w-2xl mt-6 space-y-4 ${isChatMode ? 'min-h-[400px] max-h-[60vh] overflow-y-auto pb-32 scrollbar-hide' : 'min-h-[200px]'} transition-all duration-500`}>
                  <AnimatePresence>
                    {messages.map((message) => (
                      <motion.div
                        key={message.id}
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ duration: 0.4, ease: "easeOut" }}
                        className={`flex ${message.isUser ? 'justify-start' : 'justify-end'}`}
                      >
                        <div className={`max-w-[80%] ${message.isUser ? 'order-1' : 'order-2'}`}>
                          {message.isUser ? (
                            <div className="relative p-4 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 text-white mr-4 shadow-lg">
                              <div className="relative z-10">
                                {message.text}
                              </div>
                            </div>
                          ) : (
                            <div className="relative">
                              <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500/20 via-blue-400/30 to-gold-500/20 rounded-2xl blur-sm animate-pulse"></div>
                              <div className="relative p-4 rounded-2xl bg-gradient-to-br from-gray-900/95 to-black/95 backdrop-blur-sm border border-blue-400/20 text-white  shadow-xl">
                                <div className="relative z-10">
                                  {message.text.split('').map((char, index) => (
                                    <motion.span
                                      key={index}
                                      initial={{ opacity: 0 }}
                                      animate={{ opacity: 1 }}
                                      transition={{ duration: 0.03, delay: index * 0.02 }}
                                    >
                                      {char}
                                    </motion.span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}
                    
                    {/* Loading Animation */}
                    {isLoading && (
                      <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ duration: 0.4, ease: "easeOut" }}
                        className="flex justify-end"
                      >
                        <div className="max-w-[80%] order-2">
                          <div className="relative">
                            <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500/20 via-blue-400/30 to-gold-500/20 rounded-2xl blur-sm animate-pulse"></div>
                            <div className="relative p-4 rounded-2xl bg-gradient-to-br from-gray-900/95 to-black/95 backdrop-blur-sm border border-blue-400/20 text-white ml-4 shadow-xl">
                              <div className="flex items-center space-x-2 rtl:space-x-reverse">
                                <div className="flex space-x-1 rtl:space-x-reverse">
                                  <motion.div
                                    className="w-2 h-2 bg-blue-400 rounded-full"
                                    animate={{ scale: [1, 1.2, 1] }}
                                    transition={{ duration: 1, repeat: Infinity, delay: 0 }}
                                  />
                                  <motion.div
                                    className="w-2 h-2 bg-blue-400 rounded-full"
                                    animate={{ scale: [1, 1.2, 1] }}
                                    transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
                                  />
                                  <motion.div
                                    className="w-2 h-2 bg-blue-400 rounded-full"
                                    animate={{ scale: [1, 1.2, 1] }}
                                    transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
                                  />
                                </div>
                                <span className="text-sm text-white/60">جاري الكتابة...</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <div ref={messagesEndRef} />
                </div>
                
                {!isChatMode && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: -20 }}
                    transition={{ duration: 0.8, delay: 1.1, ease: "easeOut" }}
                    className="relative group"
                  >
                    {showAnimation && (
                      <div key={animationKey} className="absolute inset-0 rounded-2xl overflow-hidden z-20 pointer-events-none">
                        <div style={{ animation: 'fadeOut 3s ease-in-out forwards' }}>
                          <CanvasRevealEffect
                            animationSpeed={0.6}
                            containerClassName="bg-transparent"
                            colors={[[30, 144, 255], [255, 215, 0], [135, 206, 250]]}
                            dotSize={3}
                            opacities={[0.1, 0.1, 0.1, 0.2, 0.2, 0.2, 0.3, 0.3, 0.3, 0.4]}
                            showGradient={false}
                          />
                        </div>
                        <style jsx>{`
                          @keyframes fadeOut {
                            0% { opacity: 0; }
                            20% { opacity: 1; }
                            80% { opacity: 1; }
                            100% { opacity: 0; }
                          }
                        `}</style>
                      </div>
                    )}
                    
                    <div className="absolute -inset-1 overflow-hidden rounded-2xl blur-[3px] 
                                    before:absolute before:content-[''] before:z-[-2] before:w-[999px] before:h-[999px] before:bg-no-repeat before:top-1/2 before:left-1/2 before:-translate-x-1/2 before:-translate-y-1/2 before:rotate-60
                                    before:bg-[conic-gradient(#000,#1e90ff_5%,#000_38%,#000_50%,#ffd700_60%,#000_87%)] before:transition-all before:duration-2000
                                    group-hover:before:rotate-[-120deg] group-focus-within:before:rotate-[420deg] group-focus-within:before:duration-[4000ms]
                                    after:absolute after:content-[''] after:inset-1 after:bg-black after:rounded-2xl after:z-[-1]">
                    </div>
                    <div className="absolute -inset-0.5 overflow-hidden rounded-2xl blur-[2px] 
                                    before:absolute before:content-[''] before:z-[-2] before:w-[600px] before:h-[600px] before:bg-no-repeat before:top-1/2 before:left-1/2 before:-translate-x-1/2 before:-translate-y-1/2 before:rotate-[82deg]
                                    before:bg-[conic-gradient(rgba(0,0,0,0),#4169e1,rgba(0,0,0,0)_10%,rgba(0,0,0,0)_50%,#daa520,rgba(0,0,0,0)_60%)] before:transition-all before:duration-2000
                                    group-hover:before:rotate-[-98deg] group-focus-within:before:rotate-[442deg] group-focus-within:before:duration-[4000ms]
                                    after:absolute after:content-[''] after:inset-0.5 after:bg-black after:rounded-2xl after:z-[-1]">
                    </div>
                    <div className="absolute -inset-px overflow-hidden rounded-2xl blur-[1px] 
                                    before:absolute before:content-[''] before:z-[-2] before:w-[600px] before:h-[600px] before:bg-no-repeat before:top-1/2 before:left-1/2 before:-translate-x-1/2 before:-translate-y-1/2 before:rotate-[83deg]
                                    before:bg-[conic-gradient(rgba(0,0,0,0)_0%,#87ceeb,rgba(0,0,0,0)_8%,rgba(0,0,0,0)_50%,#f0e68c,rgba(0,0,0,0)_58%)] before:brightness-140
                                    before:transition-all before:duration-2000 group-hover:before:rotate-[-97deg] group-focus-within:before:rotate-[443deg] group-focus-within:before:duration-[4000ms]
                                    after:absolute after:content-[''] after:inset-px after:bg-black after:rounded-2xl after:z-[-1]">
                    </div>
                    
                    <textarea 
                      placeholder="اسألني أي شيء..."
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())}
                      className="relative w-full backdrop-blur-[1px] text-white bg-black/80 border border-white/10 rounded-2xl py-4 px-6 pl-16 focus:outline-none focus:border-white/30 resize-none min-h-[120px] text-right z-10"
                      rows={4}
                    />
                    <button 
                      onClick={handleSendMessage}
                      className="absolute left-4 bottom-4 w-12 h-12 flex items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 shadow-lg hover:shadow-xl transition-all duration-300 z-10 overflow-hidden border border-blue-400/30"
                    >
                      <PixelCanvas
                        gap={2}
                        speed={60}
                        colors={["#ffffff", "#ffd700", "#87ceeb"]}
                        variant="icon"
                      />
                      <svg className="w-5 h-5 text-white relative z-10 transform hover:scale-110 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
                      </svg>
                    </button>
                  </motion.div>
                )}
                
                {/* Sticky Bottom Input Bar */}
                <AnimatePresence>
                  {isChatMode && (
                    <motion.div
                      initial={{ y: 100, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: 100, opacity: 0 }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                      className="fixed bottom-0 left-0 right-0 z-50"
                    >
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/95 to-transparent backdrop-blur-xl"></div>
                      <div className="relative p-6">
                        <div className="max-w-4xl mx-auto">
                          <div className="relative group">
                            <div className="absolute -inset-1 rounded-full">
                              <div 
                                className="absolute inset-0 rounded-full blur-md opacity-75"
                                style={{
                                  background: 'conic-gradient(from 0deg, rgba(65, 105, 225, 0.6), rgba(218, 165, 32, 0.8), rgba(65, 105, 225, 0.6))',
                                  animation: 'spin 4s linear infinite'
                                }}
                              ></div>
                            </div>
                            <div className="relative flex items-center bg-gradient-to-r from-gray-900/95 via-black/95 to-gray-900/95 backdrop-blur-sm border border-white/10 rounded-full p-3 shadow-2xl">
                              <input
                                type="text"
                                placeholder="اسألني أي شيء..."
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())}
                                className="flex-1 bg-transparent text-white placeholder-white/50 px-6 py-3 focus:outline-none text-right text-lg"
                              />
                              <button
                                onClick={handleSendMessage}
                                disabled={isLoading}
                                className="relative w-12 h-12 flex items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden border border-blue-400/30 disabled:opacity-50 group/btn"
                              >
                                <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-blue-600/20 rounded-full opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300"></div>
                                <PixelCanvas
                                  gap={2}
                                  speed={60}
                                  colors={["#ffffff", "#ffd700", "#87ceeb"]}
                                  variant="icon"
                                />
                                <svg className="w-5 h-5 text-white relative z-10 transform group-hover/btn:scale-110 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
                                </svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                
                <motion.div 
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, delay: 1.3 }}
                  className="flex flex-wrap gap-2 justify-center"
                >
                  {["اشرح الحوسبة الكمية", "اكتب قصيدة", "تصحيح الكود", "خطط لرحلة"].map((suggestion, index) => (
                    <motion.button 
                      key={suggestion}
                      initial={{ opacity: 0, scale: 0.8, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ 
                        duration: 0.5, 
                        delay: 1.5 + index * 0.1,
                        ease: "easeOut"
                      }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="px-4 py-2 text-sm bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 rounded-full transition-colors"
                    >
                      {suggestion}
                    </motion.button>
                  ))}
                </motion.div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function Home() {
  return <SignInPage />;
}
