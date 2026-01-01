import React from "react";

function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(" ");
}

type Candle = { o: number; c: number; h: number; l: number };

type Streak = {
  id: number;
  lane: number;
  delay: number;
  duration: number;
  length: number;
  thickness: number;
  opacity: number;
  blur: number;
  tilt: number;
};

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ----------------- DATA STREAKS ----------------- */
function makeStreaks(count = 12, seed = 1337): Streak[] {
  const r = mulberry32(seed);
  return Array.from({ length: count }, (_, id) => {
    const duration = 6 + r() * 10;          // 6–16s
    const delay = -r() * duration;          // negative = starts mid-animation (prepopulated)
    const length = 180 + r() * 320;         // 80–300px trail
    const thickness = 1 + r() * 2.2;        // 1–3.2px
    const opacity = 0.20 + r() * 0.18;      // subtle
    const blur = 0.2 + r() * 1.8;           // faint softness
    const lane = r();                       // 0..1
    const tilt = (r() - 0.5) * 6;           // -3..+3 degrees
    return { id, lane, delay, duration, length, thickness, opacity, blur, tilt };
  });
}

function DataStreaksMicroTrails({
  count = 14,
  seed = 2026,
  direction = "down-right",
}: {
  count?: number;
  seed?: number;
  direction?: "down-right" | "up-right";
}) {
  const streaks = React.useMemo(() => makeStreaks(count, seed), [count, seed]);
  const baseAngle = direction === "down-right" ? 22 : -22;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute left-1/2 top-1/2 h-[200%] w-[200%] -translate-x-1/2 -translate-y-1/2"
        style={{ transform: `translate(0%, 0%) rotate(${baseAngle}deg)` }}
      >
        {streaks.map((s) => (
          <span
            key={s.id}
            className="tt-streak"
            style={
              {
                top: `${s.lane * 100}%`,
                height: `${s.thickness}px`,
                width: `${s.length}px`,
                opacity: s.opacity,
                filter: `blur(${s.blur}px)`,
                transform: `rotate(${s.tilt}deg)`,
                animationDuration: `${s.duration}s`,
                animationDelay: `${s.delay}s`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      <style jsx global>{`
        .tt-streak {
          position: absolute;
          left: -30%;
          border-radius: 9999px;
          background: linear-gradient(
            90deg,
            rgba(56, 189, 248, 0) 0%,
            rgba(56, 189, 248, 0.08) 35%,
            rgba(56, 189, 248, 0.28) 70%,
            rgba(186, 230, 253, 0.8) 92%,
            rgba(255, 255, 255, 0.95) 100%
          );
          box-shadow: 0 0 18px rgba(56, 189, 248, 0.1);
          will-change: transform, left;
          animation-name: ttStreakMove;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }

        @keyframes ttStreakMove {
          0% { left: -30%; }
          100% { left: 130%; }
        }
      `}</style>
    </div>
  );
}

/* ----------------- CANDLE TAPES ----------------- */
function buildCandles(count: number, seed = 42): Candle[] {
  const rand = mulberry32(seed);
  let price = 70;

  const candles: Candle[] = [];
  for (let i = 0; i < count; i++) {
    const drift = (rand() - 0.5) * 6; // gentle drift
    const vol = 6 + rand() * 10;

    const o = price;
    const c = o + drift;
    const high = Math.max(o, c) + rand() * vol * 0.6;
    const low = Math.min(o, c) - rand() * vol * 0.6;

    candles.push({ o, c, h: high, l: low });
    price = c;
  }
  return candles;
}


function CandleTape({
  seed,
  height = 140,
  candleWidth = 14,
  gap = 10,
  opacity = 0.28,
}: {
  seed: number;
  height?: number;
  candleWidth?: number;
  gap?: number;
  opacity?: number;
}) {
  const count = 44;
  const candles = React.useMemo(() => buildCandles(count, seed), [seed]);

  // Map price-ish values to SVG y
  const all = candles.flatMap((k) => [k.o, k.c, k.h, k.l]);
  const min = Math.min(...all);
  const max = Math.max(...all);

  const pad = 10;
  const y = (v: number) => {
    const t = (v - min) / (max - min + 1e-9);
    return pad + (1 - t) * (height - pad * 2);
  };

  const totalW = count * (candleWidth + gap);

  return (
    <svg
      viewBox={`0 0 ${totalW} ${height}`}
      style={{ width: `${totalW}px`, height: "100%" }}
      className="block"
      preserveAspectRatio="none"
    >
      {/* faint grid lines */}
      <g opacity={0.14} stroke="currentColor" strokeWidth="1">
        <path d={`M0 ${height * 0.25} H${totalW}`} />
        <path d={`M0 ${height * 0.5} H${totalW}`} />
        <path d={`M0 ${height * 0.75} H${totalW}`} />
      </g>

      <g fill="currentColor" stroke="currentColor">
        {candles.map((k, i) => {
          const cx = i * (candleWidth + gap) + candleWidth / 2;
          const bodyTop = Math.min(y(k.o), y(k.c));
          const bodyBot = Math.max(y(k.o), y(k.c));
          const bodyH = Math.max(5, bodyBot - bodyTop);

          // Up candle if close > open in price space
          const isUp = k.c > k.o;

          return (
            <g key={i} opacity={opacity}>
              {/* wick */}
              <line
                x1={cx}
                y1={y(k.h)}
                x2={cx}
                y2={y(k.l)}
                strokeWidth="2"
                opacity={0.85}
              />
              {/* body */}
              <rect
                x={cx - candleWidth / 2}
                y={bodyTop}
                width={candleWidth}
                height={bodyH}
                rx="3"
                opacity={isUp ? 0.52 : 0.34}
              />
            </g>
          );
        })}
      </g>
    </svg>
  );
}

function TapeRow({
  top,
  heightClass,
  seed,
  dir,
  duration,
  opacityClass,
  blurClass,
  tapeHeight,
  candleOpacity,
}: {
  top: string;
  heightClass: string;
  seed: number;
  dir: "left" | "right";
  duration: number;
  opacityClass: string;
  blurClass: string;
  tapeHeight: number;
  candleOpacity: number;
}) {
  return (
    <div className={cn("absolute inset-x-0 overflow-hidden", top, heightClass)}>
      <div
        className={cn(
          "tt-belt",
          dir === "left" ? "tt-left" : "tt-right",
          "text-sky-300",
          opacityClass,
          blurClass
        )}
        style={{ animationDuration: `${duration}s` }}
      >
        {/* Five copies. This is the key to seamless looping. */}
        <CandleTape seed={seed} height={tapeHeight} opacity={candleOpacity} />
        <CandleTape seed={seed} height={tapeHeight} opacity={candleOpacity} />
        <CandleTape seed={seed} height={tapeHeight} opacity={candleOpacity} />
        <CandleTape seed={seed} height={tapeHeight} opacity={candleOpacity} />
        <CandleTape seed={seed} height={tapeHeight} opacity={candleOpacity} />
      </div>
    </div>
  );
}


export function CandlestickBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Alternate directions explicitly */}
      <TapeRow
        top="top-[14%]"
        heightClass="h-44"
        seed={11}
        dir="right"
        duration={34}
        opacityClass="opacity-95"
        blurClass="blur-[0.5px]"
        tapeHeight={160}
        candleOpacity={0.55}
      />

      <TapeRow
        top="top-[40%]"
        heightClass="h-52"
        seed={23}
        dir="left"
        duration={46}
        opacityClass="opacity-90"
        blurClass="blur-[1px]"
        tapeHeight={190}
        candleOpacity={0.45}
      />

      <TapeRow
        top="top-[68%]"
        heightClass="h-40"
        seed={92}
        dir="right"
        duration={58}
        opacityClass="opacity-80"
        blurClass="blur-[2px]"
        tapeHeight={140}
        candleOpacity={0.35}
      />

      {/* Add fog back later once it looks right */}
      <div className="absolute inset-0 bg-neutral-950/20" />
      <div className="absolute inset-0 backdrop-blur-[1px]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0)_0%,rgba(0,0,0,0.35)_55%,rgba(0,0,0,0.75)_100%)]" />

      {/* soft cyan haze */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(56,189,248,0.10),transparent_45%),radial-gradient(circle_at_80%_70%,rgba(56,189,248,0.08),transparent_50%)]" />

      <style jsx global>{`
        .tt-belt {
          display: inline-flex;
          gap: 0;
          width: max-content;
          will-change: transform;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }

        /* Move exactly one tape width (half of the belt = 50%) */
        @keyframes ttScrollLeft {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes ttScrollRight {
          0% { transform: translateX(-50%); }
          100% { transform: translateX(0); }
        }

        .tt-left { animation-name: ttScrollLeft; }
        .tt-right { animation-name: ttScrollRight; }
      `}</style>
    </div>
  );
}

/* ----------------- PUBLIC WRAPPER ----------------- */
export function AuthDecorBackground({
  children,
  streaksCount = 16,
  streaksSeed = 2026,
  streaksDirection = "up-right",
}: {
  children: React.ReactNode;
  streaksCount?: number;
  streaksSeed?: number;
  streaksDirection?: "down-right" | "up-right";
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-neutral-950 text-white">
      <CandlestickBackground />
      <DataStreaksMicroTrails count={streaksCount} seed={streaksSeed} direction={streaksDirection} />
      <div className="relative z-10">{children}</div>
    </div>
  );
}