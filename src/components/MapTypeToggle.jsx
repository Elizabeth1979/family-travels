import * as React from "react";
import { GlassFilter } from "@/components/ui/liquid-radio";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";

const MapTypeToggle = ({ value, onValueChange }) => {
    const options = [
        {
            id: "globe",
            label: "3D Globe",
            icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M2 12h20" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
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
