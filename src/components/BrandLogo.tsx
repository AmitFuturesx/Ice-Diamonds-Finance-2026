import React from 'react';

interface BrandLogoProps {
  className?: string;
  size?: number;
}

export default function BrandLogo({ className = '', size = 40 }: BrandLogoProps) {
  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      className={`shrink-0 ${className}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="gold-grad" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#8d6e18" />
          <stop offset="25%" stopColor="#f6e293" />
          <stop offset="50%" stopColor="#e2c974" />
          <stop offset="75%" stopColor="#f6e293" />
          <stop offset="100%" stopColor="#b88728" />
        </linearGradient>
      </defs>

      {/* Outer elegant gold circle */}
      <circle
        cx="100"
        cy="100"
        r="92"
        fill="none"
        stroke="url(#gold-grad)"
        strokeWidth="4"
        className="opacity-95"
      />

      {/* The Royal Crown */}
      <g id="crown-and-beads">
        {/* Crown main body */}
        <path
          d="M 51 62 
             Q 57 65 63 67 
             Q 68 56 72 45 
             Q 80 51 87 57 
             Q 94 44 100 31 
             Q 106 44 113 57 
             Q 120 51 128 45 
             Q 133 65 137 67 
             Q 143 65 149 62
             Q 100 84 51 62 Z"
          fill="url(#gold-grad)"
        />

        {/* Droplet cutout in the bottom center of the crown */}
        <path
          d="M 100 64 
             C 97 68 97 73 100 77 
             C 103 73 103 68 100 64 Z"
          fill="#0a0a0a"
          className="mix-blend-normal"
        />

        {/* Beads on crown peaks */}
        <circle cx="51" cy="62" r="2.5" fill="url(#gold-grad)" />
        <circle cx="72" cy="45" r="3" fill="url(#gold-grad)" />
        <circle cx="100" cy="31" r="4.5" fill="url(#gold-grad)" />
        <circle cx="128" cy="45" r="3" fill="url(#gold-grad)" />
        <circle cx="149" cy="62" r="2.5" fill="url(#gold-grad)" />
      </g>

      {/* The Brilliant Diamond */}
      <g id="diamond-facets">
        {/* Outer Frame */}
        <path
          d="M 100 172 L 41 108 L 68 85 L 132 85 L 159 108 Z"
          fill="none"
          stroke="url(#gold-grad)"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Girdle Chevron Line */}
        <path
          d="M 41 108 L 74 112 L 100 118 L 126 112 L 159 108"
          fill="none"
          stroke="url(#gold-grad)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Lower Pavilion Lines targeting bottom corner */}
        <line x1="74" y1="112" x2="100" y2="172" stroke="url(#gold-grad)" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="100" y1="118" x2="100" y2="172" stroke="url(#gold-grad)" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="126" y1="112" x2="100" y2="172" stroke="url(#gold-grad)" strokeWidth="2.5" strokeLinecap="round" />

        {/* Upper Star / Crown Facet Lines */}
        <line x1="68" y1="85" x2="74" y2="112" stroke="url(#gold-grad)" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="68" y1="85" x2="100" y2="118" stroke="url(#gold-grad)" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="132" y1="85" x2="100" y2="118" stroke="url(#gold-grad)" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="132" y1="85" x2="126" y2="112" stroke="url(#gold-grad)" strokeWidth="2.5" strokeLinecap="round" />
      </g>
    </svg>
  );
}
