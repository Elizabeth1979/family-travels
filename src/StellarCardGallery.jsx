"use client"

import React, { Suspense, useEffect, useMemo, useRef, useState, createContext, useContext } from "react"
import * as THREE from "three"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import {
    OrbitControls,
    Environment,
    Html,
    Plane,
    Sphere,
} from "@react-three/drei"
import { Download, Heart, X, MapPin } from "lucide-react"

/* =========================
   Card Context (inlined)
   ========================= */

const CardContext = createContext(undefined)

function useCard() {
    const ctx = useContext(CardContext)
    if (!ctx) throw new Error("useCard must be used within CardProvider")
    return ctx
}

/* =========================
   Camera Context for focus navigation
   ========================= */

const CameraContext = createContext(undefined)

function useCamera() {
    return useContext(CameraContext)
}

function CardProvider({ children, initialCards }) {
    const [selectedCard, setSelectedCard] = useState(null)
    const [cards, setCards] = useState(initialCards || [])

    // Update cards if prop changes
    useEffect(() => {
        if (initialCards) {
            setCards(initialCards)
        }
    }, [initialCards])

    return (
        <CardContext.Provider value={{ selectedCard, setSelectedCard, cards }}>
            {children}
        </CardContext.Provider>
    )
}

/* =========================
   Starfield Background (inlined)
   ========================= */

/* =========================
   Starfield (R3F version)
   ========================= */

function Starfield() {
    const ref = useRef()

    // Generate stars once
    const [positions] = useState(() => {
        const starsCount = 10000
        const pos = new Float32Array(starsCount * 3)
        for (let i = 0; i < starsCount; i++) {
            pos[i * 3] = (Math.random() - 0.5) * 2000
            pos[i * 3 + 1] = (Math.random() - 0.5) * 2000
            pos[i * 3 + 2] = (Math.random() - 0.5) * 2000
        }
        return pos
    })

    useFrame((state, delta) => {
        if (ref.current) {
            ref.current.rotation.y += 0.0001
            ref.current.rotation.x += 0.00005
        }
    })

    return (
        <points ref={ref}>
            <bufferGeometry>
                <bufferAttribute
                    attach="attributes-position"
                    count={positions.length / 3}
                    array={positions}
                    itemSize={3}
                />
            </bufferGeometry>
            <pointsMaterial
                color={0xffffff}
                size={0.7}
                sizeAttenuation={true}
                transparent={true}
                depthWrite={false}
            />
        </points>
    )
}

/* =========================
   Camera Controller (provides camera focus)
   ========================= */

function CameraController({ children }) {
    const controlsRef = useRef(null)
    const { camera } = useThree()
    const targetPosition = useRef(null)
    const isAnimating = useRef(false)

    // Animate camera to target position
    useFrame(() => {
        if (targetPosition.current && isAnimating.current && controlsRef.current) {
            const target = targetPosition.current
            const controls = controlsRef.current

            // Smoothly interpolate the controls target
            controls.target.lerp(target, 0.05)

            // Calculate ideal camera position (offset from target)
            const direction = new THREE.Vector3()
            direction.subVectors(camera.position, controls.target).normalize()
            const idealDistance = 20
            const idealPosition = new THREE.Vector3()
            idealPosition.copy(target).addScaledVector(direction, idealDistance)

            // Smoothly move camera
            camera.position.lerp(idealPosition, 0.05)

            // Check if we're close enough to stop animating
            if (controls.target.distanceTo(target) < 0.1) {
                isAnimating.current = false
                targetPosition.current = null
            }

            controls.update()
        }
    })

    const focusOnPosition = (pos) => {
        targetPosition.current = new THREE.Vector3(pos.x, pos.y, pos.z)
        isAnimating.current = true
    }

    return (
        <CameraContext.Provider value={{ focusOnPosition }}>
            <OrbitControls
                ref={controlsRef}
                enablePan
                enableZoom
                enableRotate
                minDistance={5}
                maxDistance={60}
                autoRotate={false}
                autoRotateSpeed={0.5}
                rotateSpeed={0.5}
                zoomSpeed={1.2}
                panSpeed={0.8}
            />
            {children}
        </CameraContext.Provider>
    )
}

/* =========================
   Floating Card (inlined)
   ========================= */

function FloatingCard({
    card,
    position,
}) {
    const meshRef = useRef(null)
    const groupRef = useRef(null)
    const [hovered, setHovered] = useState(false)
    const hoverTimeoutRef = useRef(null)
    const { setSelectedCard } = useCard()
    const cameraContext = useCamera()

    useFrame(({ camera }) => {
        if (groupRef.current) {
            groupRef.current.lookAt(camera.position)
        }
    })

    const handleClick = (e) => {
        e.stopPropagation()
        // Navigate directly to album page
        if (card.id) {
            window.location.href = `album.html?id=${card.id}`
        }
    }

    // Debounced hover handlers to make hover more persistent
    const handleMouseEnter = () => {
        // Clear any pending leave timeout
        if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current)
            hoverTimeoutRef.current = null
        }
        setHovered(true)
        document.body.style.cursor = "pointer"
    }

    const handleMouseLeave = () => {
        // Delay the hover removal to give user time to reach interactive elements
        hoverTimeoutRef.current = setTimeout(() => {
            setHovered(false)
            document.body.style.cursor = "auto"
        }, 150)
    }

    const handlePointerOver = (e) => {
        e.stopPropagation()
        handleMouseEnter()
    }
    const handlePointerOut = (e) => {
        e.stopPropagation()
        handleMouseLeave()
    }

    return (
        <group ref={groupRef} position={[position.x, position.y, position.z]}>
            <Html
                transform
                distanceFactor={10}
                position={[0, 0, 0.01]}
            >
                {/* Outer wrapper for stable hover detection - no transform here */}
                <div
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                    style={{
                        padding: '20px', // Buffer zone for easier hover
                        margin: '-20px', // Offset the padding
                        cursor: 'pointer',
                    }}
                >
                    {/* Visual card - wrapped in anchor for keyboard accessibility */}
                    <a
                        href={card.id ? `album.html?id=${card.id}` : '#'}
                        className="rounded-lg overflow-hidden shadow-lg bg-[#1F2121] p-1 select-none cursor-pointer block"
                        onFocus={() => {
                            // Animate camera to bring this card into view when focused via keyboard
                            if (cameraContext?.focusOnPosition) {
                                cameraContext.focusOnPosition(position)
                            }
                            setHovered(true)
                        }}
                        onBlur={() => setHovered(false)}
                        style={{
                            width: '320px',
                            height: '400px',
                            transition: 'box-shadow 0.3s ease, border 0.3s ease',
                            boxShadow: hovered
                                ? "0 12px 24px rgba(49, 184, 198, 0.5), 0 0 30px rgba(49, 184, 198, 0.3)"
                                : "0 6px 12px rgba(0, 0, 0, 0.6)",
                            border: hovered ? "2px solid rgba(49, 184, 198, 0.8)" : "1px solid rgba(255, 255, 255, 0.1)",
                            position: 'relative',
                            textDecoration: 'none',
                        }}
                    >
                        <img
                            src={card.cover || "/placeholder.svg"}
                            alt={card.alt}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '6px' }}
                            loading="lazy"
                            draggable={false}
                        />
                        {/* Title overlay - visible on hover */}
                        <div
                            style={{
                                position: 'absolute',
                                bottom: 0,
                                left: 0,
                                right: 0,
                                padding: '20px 12px',
                                background: 'linear-gradient(to top, rgba(0, 0, 0, 0.95), rgba(0, 0, 0, 0.7) 60%, transparent)',
                                borderRadius: '0 0 6px 6px',
                                opacity: hovered ? 1 : 0,
                                transition: 'opacity 0.3s ease',
                                pointerEvents: 'none',
                            }}
                        >
                            <p style={{
                                color: '#fff',
                                fontSize: '24px',
                                fontWeight: '700',
                                textAlign: 'center',
                                margin: 0,
                                textShadow: '0 2px 6px rgba(0, 0, 0, 0.9)',
                            }}>
                                {card.title}
                            </p>
                        </div>
                    </a>
                </div>
            </Html>
        </group>
    )
}

/* =========================
   Card Modal (inlined)
   ========================= */

function CardModal() {
    const { selectedCard, setSelectedCard } = useCard()
    const [isFavorited, setIsFavorited] = useState(false)
    const cardRef = useRef(null)

    if (!selectedCard) return null

    const handleMouseMove = (e) => {
        if (!cardRef.current) return
        const rect = cardRef.current.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top
        const centerX = rect.width / 2
        const centerY = rect.height / 2
        const rotateX = (y - centerY) / 25 // Reduced sensitivity
        const rotateY = (centerX - x) / 25
        cardRef.current.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`
    }

    const handleMouseEnter = () => { }
    const handleMouseLeave = () => {
        if (cardRef.current) {
            cardRef.current.style.transition = "transform 0.5s ease-out"
            cardRef.current.style.transform = "perspective(1000px) rotateX(0deg) rotateY(0deg)"
        }
    }

    const toggleFavorite = () => setIsFavorited((v) => !v)
    const handleClose = () => setSelectedCard(null)
    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) handleClose()
    }

    const openAlbum = () => {
        if (selectedCard.id) {
            window.location.href = `album.html?id=${selectedCard.id}`
        } else if (selectedCard.url) {
            window.location.href = selectedCard.url
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={handleBackdropClick}>
            <div className="relative max-w-md w-full mx-4">
                <button onClick={handleClose} className="absolute -top-12 right-0 text-white hover:text-gray-300 transition-colors z-10">
                    <X className="w-8 h-8" />
                </button>

                <div style={{ perspective: "1000px" }} className="w-full">
                    <div
                        ref={cardRef}
                        className="relative cursor-pointer rounded-[16px] bg-[#1F2121] p-4 transition-all duration-500 ease-out w-full"
                        style={{
                            transformStyle: "preserve-3d",
                            boxShadow:
                                "rgba(0, 0, 0, 0.01) 0px 520px 146px 0px, rgba(0, 0, 0, 0.04) 0px 333px 133px 0px, rgba(0, 0, 0, 0.26) 0px 83px 83px 0px, rgba(0, 0, 0, 0.29) 0px 21px 46px 0px",
                        }}
                        onMouseMove={handleMouseMove}
                        onMouseEnter={handleMouseEnter}
                        onMouseLeave={handleMouseLeave}
                    >
                        <div className="relative w-full mb-4" style={{ aspectRatio: "3 / 2" }}>
                            <img
                                loading="lazy"
                                className="absolute inset-0 h-full w-full rounded-[16px] bg-[#000000] object-cover"
                                alt={selectedCard.alt}
                                src={selectedCard.cover || "/placeholder.svg"}
                                style={{ boxShadow: "rgba(0, 0, 0, 0.05) 0px 5px 6px 0px", opacity: 1 }}
                            />
                        </div>

                        <h3 className="text-white text-xl font-bold mb-4 text-center">{selectedCard.title}</h3>

                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={openAlbum}
                                className="inline-flex h-10 flex-1 items-center justify-center rounded-lg text-base font-medium text-black outline-none transition duration-300 ease-out hover:opacity-80 active:scale-[0.97]"
                                style={{ backgroundColor: "#31b8c6" }}
                            >
                                <div className="flex items-center gap-1.5">
                                    <MapPin className="h-4 w-4" strokeWidth={1.8} />
                                    <span>View Album</span>
                                </div>
                            </button>
                            <button
                                type="button"
                                onClick={toggleFavorite}
                                className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-black outline-none transition duration-300 ease-out hover:opacity-80 active:scale-[0.97]"
                                style={{ backgroundColor: "#31b8c6" }}
                            >
                                <Heart className="h-4 w-4" strokeWidth={1.8} fill={isFavorited ? "currentColor" : "none"} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

/* =========================
   Card Galaxy (inlined)
   ========================= */

function CardGalaxy() {
    const { cards } = useCard()

    const cardPositions = useMemo(() => {
        const positions = []
        const numCards = cards.length

        // Simple sphere distribution (Fibonacci Sphere)
        const goldenRatio = (1 + Math.sqrt(5)) / 2

        for (let i = 0; i < numCards; i++) {
            const y = 1 - (i / (numCards - 1)) * 2
            const radiusAtY = Math.sqrt(1 - y * y)
            const theta = (2 * Math.PI * i) / goldenRatio

            const x = Math.cos(theta) * radiusAtY
            const z = Math.sin(theta) * radiusAtY

            // Radius of the galaxy sphere
            const R = 20

            positions.push({
                x: x * R,
                y: y * R,
                z: z * R,
                rotationX: 0,
                rotationY: 0,
                rotationZ: 0,
            })
        }
        return positions
    }, [cards.length])

    return (
        <>
            {cards.length === 0 && (
                <Html position={[0, 0, 0]} center>
                    <div className="text-white text-xl font-bold animate-pulse">
                        Loading Galaxy...
                    </div>
                </Html>
            )}

            {cards.map((card, i) => (
                <FloatingCard key={card.id} card={card} position={cardPositions[i] || { x: 0, y: 0, z: 0 }} />
            ))}
        </>
    )
}

/* =========================
   Main Component
   ========================= */

export default function StellarCardGallery({ cards }) {
    return (
        <CardProvider initialCards={cards}>
            <div className="w-full h-full relative overflow-hidden bg-black">
                <Canvas
                    camera={{ position: [0, 0, 35], fov: 60 }}
                    className="absolute inset-0 z-10"
                    onCreated={({ gl }) => {
                        gl.domElement.style.pointerEvents = "auto"
                    }}
                >
                    <color attach="background" args={['#000000']} />
                    <Suspense fallback={null}>
                        <Starfield />
                        <Environment preset="night" />
                        <ambientLight intensity={0.4} />
                        <pointLight position={[10, 10, 10]} intensity={0.6} />
                        <pointLight position={[-10, -10, -10]} intensity={0.3} />
                        <CameraController>
                            <CardGalaxy />
                        </CameraController>
                    </Suspense>
                </Canvas>

                <CardModal />

                <div className="absolute top-4 left-4 z-20 text-white pointer-events-none">
                    <h1 className="text-2xl font-bold mb-2">3D Travel Gallery</h1>
                    <p className="text-sm opacity-70">Drag to explore • Scroll to zoom • Click cards to view details</p>
                </div>
            </div>
        </CardProvider>
    )
}
