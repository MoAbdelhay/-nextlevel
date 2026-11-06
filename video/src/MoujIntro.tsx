import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Easing } from "remotion";

const NAVY = "#0a1628";
const INK = "#dce6f2";
const GOLD = "#d9a44a";

/* one wavy line across the frame, drifting with time */
const wavePath = (t: number, y: number, amp: number, len: number, w: number) => {
  let d = `M 0 ${y}`;
  for (let x = 0; x <= w; x += 24) {
    d += ` L ${x} ${(y + Math.sin((x / len) * Math.PI * 2 + t) * amp).toFixed(1)}`;
  }
  return d;
};

export const MoujIntro: React.FC<{ tagline: string; taglineAr: string }> = ({ tagline, taglineAr }) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const t = frame / fps;

  const rise = spring({ frame: frame - 10, fps, config: { damping: 14, mass: 0.8 } });
  const name = interpolate(frame, [35, 65], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const tag = interpolate(frame, [60, 90], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const out = interpolate(frame, [durationInFrames - 20, durationInFrames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: `linear-gradient(#1b3a66 0%, #12284a 45%, ${NAVY} 100%)`, opacity: out }}>
      {/* sea */}
      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <path
            key={i}
            d={wavePath(t * (1.2 + i * 0.25) + i, height * 0.62 + i * 70, 18 - i * 1.5, 520 - i * 40, width)}
            fill="none"
            stroke={INK}
            strokeOpacity={0.28 - i * 0.035}
            strokeWidth={3}
          />
        ))}
      </svg>

      {/* logo + name */}
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 36 }}>
        <svg
          viewBox="0 0 64 64"
          width={220}
          height={220}
          style={{ transform: `translateY(${(1 - rise) * 160}px)`, opacity: rise }}
        >
          <circle cx="32" cy="32" r="29" fill="none" stroke={INK} strokeWidth="2.5" opacity=".35" />
          <path d="M18 34l14-14 14 14" fill="none" stroke={GOLD} strokeWidth="5" strokeLinecap="square" />
          <path d={`M10 42c4-2.6 7.5-2.6 11.5 0s7.5 2.6 11.5 0 7.5-2.6 11.5 0 7.5 2.6 11 0`} fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
          <path d="M14 50c3.5-2.2 6.5-2.2 10 0s6.5 2.2 10 0 6.5-2.2 10 0 6.5 2.2 10 0" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" opacity=".5" />
        </svg>
        <div
          style={{
            fontFamily: "'IBM Plex Mono', 'DejaVu Sans Mono', monospace",
            fontWeight: 300,
            fontSize: 150,
            letterSpacing: `${0.12 + (1 - name) * 0.3}em`,
            color: INK,
            opacity: name,
          }}
        >
          MOUJJ
        </div>
        <div style={{ display: "flex", gap: 40, opacity: tag, color: "#8fa3bd", fontSize: 40, fontFamily: "'IBM Plex Mono', 'DejaVu Sans Mono', monospace", letterSpacing: "0.3em" }}>
          <span>{tagline.toUpperCase()}</span>
          <span style={{ letterSpacing: 0, fontFamily: "'IBM Plex Sans Arabic', 'Noto Sans Arabic', sans-serif" }}>{taglineAr}</span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
