"use client";

import { useRef, useState } from "react";
import { AssetPage } from "./AssetPage";
import { HomePage } from "./HomePage";

export function AppNav() {
  const [page, setPage] = useState<"home" | "stock">("home");
  const [x, setX] = useState(0);
  const start = useRef(0);

  return (
    <div className="relative min-h-full overflow-hidden">
      <HomePage onOpenStock={() => setPage("stock")} />
      {page === "stock" ? (
        <div
          className="absolute inset-0 bg-white"
          style={{ transform: `translateX(${x}px)` }}
        >
          <AssetPage />
          <div
            className="absolute inset-y-0 left-0 z-30 w-7"
            onPointerDown={(event) => {
              start.current = event.clientX;
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
              setX(Math.max(0, event.clientX - start.current));
            }}
            onPointerUp={(event) => {
              if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
              event.currentTarget.releasePointerCapture(event.pointerId);
              const dx = event.clientX - start.current;
              if (dx > window.innerWidth * 0.28) {
                setX(0);
                setPage("home");
              } else {
                setX(0);
              }
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
