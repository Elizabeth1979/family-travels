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

/* =========================
   Responsive hook for mobile detection
   ========================= */

function useIsMobile() {
    const [isMobile, setIsMobile] = useState(false)

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768)
        }

        checkMobile()
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, [])

    return isMobile
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
                maxDistance={100}
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
    const isMobile = useIsMobile()

    // Responsive card dimensions using vw for smooth scaling
    // Desktop: ~320px, Mobile: scales with viewport
    const cardWidth = isMobile ? 'min(200px, 55vw)' : 'min(320px, 25vw)'
    const cardHeight = isMobile ? 'min(250px, 70vw)' : 'min(400px, 32vw)'
    const titleFontSize = isMobile ? 'max(14px, 4vw)' : '24px'

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
                        className="rounded-lg overflow-hidden shadow-lg bg-[#1F2121] select-none cursor-pointer flex flex-col"
                        onFocus={() => {
                            // Animate camera to bring this card into view when focused via keyboard
                            if (cameraContext?.focusOnPosition) {
                                cameraContext.focusOnPosition(position)
                            }
                            setHovered(true)
                        }}
                        onBlur={() => setHovered(false)}
                        style={{
                            width: cardWidth,
                            height: cardHeight,
                            transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
                            boxShadow: hovered
                                ? "0 14px 28px rgba(0,0,0,0.25), 0 10px 10px rgba(0,0,0,0.22)"
                                : "0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)",
                            border: hovered ? "2px solid #31b8c6" : "1px solid rgba(255, 255, 255, 0.1)",
                            transform: hovered ? 'translateY(-5px)' : 'translateY(0)',
                            textDecoration: 'none',
                        }}
                    >
                        {/* Image Container */}
                        <div style={{ flex: '1 1 auto', position: 'relative', overflow: 'hidden', minHeight: 0 }}>
                            <img
                                src={card.cover || "/placeholder.svg"}
                                alt={card.alt}
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                    display: 'block',
                                }}
                                loading="lazy"
                                draggable={false}
                            />
                        </div>

                        {/* Title Footer */}
                        <div
                            style={{
                                flex: '0 0 auto',
                                padding: '12px 16px',
                                background: '#1F2121',
                                borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                minHeight: '50px',
                            }}
                        >
                            <p style={{
                                color: '#e2e8f0',
                                fontSize: isMobile ? '14px' : '16px',
                                fontWeight: '600',
                                textAlign: 'center',
                                margin: 0,
                                lineHeight: '1.2',
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
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
    const isMobile = useIsMobile()

    // Responsive galaxy radius - smaller on mobile for proportional spacing
    const galaxyRadius = isMobile ? 14 : 20

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

            positions.push({
                x: x * galaxyRadius,
                y: y * galaxyRadius,
                z: z * galaxyRadius,
                rotationX: 0,
                rotationY: 0,
                rotationZ: 0,
            })
        }
        return positions
    }, [cards.length, galaxyRadius])

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
    const isMobile = useIsMobile()
    // Mobile needs to start further back to see all smaller cards
    const cameraZ = isMobile ? 45 : 55

    return (
        <CardProvider initialCards={cards}>
            <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: '#000' }}>
                <Canvas
                    camera={{ position: [0, 0, cameraZ], fov: 60 }}
                    style={{ position: 'absolute', inset: 0 }}
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
            </div>
        </CardProvider>
    )
}
