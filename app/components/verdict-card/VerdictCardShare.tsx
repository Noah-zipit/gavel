"use client";

import { useEffect, useRef, useState } from "react";
import {
  drawVerdictCard,
  type VerdictCardData,
} from "./drawVerdictCard";

interface VerdictCardShareProps {
  data: VerdictCardData;
  /** text summary used for the "Copy text" option */
  textFallback: string;
  onClose: () => void;
}

export default function VerdictCardShare({
  data,
  textFallback,
  onClose,
}: VerdictCardShareProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<"share" | "download" | null>(null);

  // Draw once on mount; keep the canvas hidden and show a preview image.
  useEffect(() => {
    const canvas = drawVerdictCard(data);
    canvasRef.current = canvas;
    setImgUrl(canvas.toDataURL("image/png"));
  }, [data]);

  // Escape closes; focus the close button for keyboard users.
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const blobOf = (): Promise<Blob | null> => {
    const canvas = canvasRef.current;
    if (!canvas) return Promise.resolve(null);
    return new Promise((res) => canvas.toBlob(res, "image/png"));
  };

  const downloadBlob = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "gavel-verdict.png";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  const shareImage = async () => {
    setBusy("share");
    try {
      const blob = await blobOf();
      if (!blob) return;
      const file = new File([blob], "gavel-verdict.png", {
        type: "image/png",
      });
      const canFileShare =
        typeof navigator !== "undefined" &&
        "canShare" in navigator &&
        navigator.canShare({ files: [file] });
      if (canFileShare) {
        try {
          await navigator.share({
            files: [file],
            title: "Gavel verdict",
            text: textFallback,
          });
          return;
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") return;
          // fall through to download
        }
      }
      downloadBlob(blob);
    } finally {
      setBusy(null);
    }
  };

  const download = async () => {
    setBusy("download");
    try {
      const blob = await blobOf();
      if (blob) downloadBlob(blob);
    } finally {
      setBusy(null);
    }
  };

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(textFallback);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Clipboard unavailable: nothing more to offer.
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/75"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Share verdict card"
        className="relative w-full max-w-[525px] rounded-lg border border-court-border bg-court-panel p-5"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold tracking-[0.14em] text-court-text">
            SHARE THE VERDICT
          </h3>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close share dialog"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-2xl leading-none text-court-muted"
          >
            ×
          </button>
        </div>

        <div className="mt-3 overflow-hidden rounded-md border border-court-border">
          {imgUrl ? (
            <img
              src={imgUrl}
              alt={`Verdict card: ${data.winnerName} wins`}
              className="block w-full"
            />
          ) : (
            <div className="flex aspect-[4/5] w-full items-center justify-center bg-court-bg">
              <span className="text-sm text-court-muted">
                Drawing the card…
              </span>
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={shareImage}
            disabled={busy !== null}
            className="inline-flex min-h-[48px] w-full items-center justify-center rounded-md bg-court-amber px-6 text-base font-bold text-court-bg disabled:opacity-60"
          >
            {busy === "share" ? "Preparing…" : "Share image"}
          </button>
          <button
            type="button"
            onClick={copyText}
            className="inline-flex min-h-[48px] w-full items-center justify-center rounded-md px-6 text-base font-semibold text-court-muted"
          >
            {copied ? "Copied" : "Copy text instead"}
          </button>
          <button
            type="button"
            onClick={download}
            disabled={busy !== null}
            className="mx-auto mt-1 inline-flex min-h-[44px] items-center justify-center px-4 text-sm font-medium text-court-subtle underline-offset-4 hover:underline disabled:opacity-60"
          >
            {busy === "download" ? "Preparing…" : "Download PNG instead"}
          </button>
        </div>
        <p className="mt-3 text-center text-xs text-court-subtle">
          Shares as an image on your phone.
        </p>
      </div>
    </div>
  );
}
