import * as React from "react";
import { GlassFilter } from "@/components/ui/liquid-radio";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";

const MapTypeToggle = ({ value, onValueChange }) => {
    const options = [
        {
            id: "gallery",
            label: "Gallery",
            icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path d="M21 15l-5-5L5 21" />
                </svg>
            ),
        },
        {
            id: "accessible",
            label: "2D Map",
            icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <path d="M3 9h18" />
                    <path d="M9 21V9" />
                </svg>
            ),
        },
    ];


    return (
        <>
            <GlassFilter />
            <RadioGroupPrimitive.Root
                value={value}
                onValueChange={onValueChange}
                className="liquid-radio-group"
                aria-label="Choose map style"
            >
                {options.map((option, idx) => (
                    <RadioGroupPrimitive.Item
                        key={option.id}
                        value={option.id}
                        className={`liquid-radio-item ${value === option.id ? "active" : ""}`}
                        id={`map-type-${option.id}`}
                    >
                        <span className="liquid-radio-icon">{option.icon}</span>
                        <span className="liquid-radio-label">{option.label}</span>
                        {value === option.id && (
                            <span className="liquid-radio-indicator" />
                        )}
                    </RadioGroupPrimitive.Item>
                ))}
            </RadioGroupPrimitive.Root>
        </>
    );
};

export default MapTypeToggle;
