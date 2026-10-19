import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { select, zoom, zoomIdentity, type ZoomBehavior } from "d3";
import { Icon } from "./Icon";

export interface MapBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface MapApi {
  fit: () => void;
  focusOn: (x: number, y: number, k?: number) => void;
  zoomBy: (factor: number) => void;
}

interface MapViewProps {
  bounds: MapBounds;
  render: (k: number) => ReactNode;
  label: string;
  onBackgroundClick?: () => void;
}

export const MapView = forwardRef<MapApi, MapViewProps>(function MapView(
  { bounds, render, label, onBackgroundClick },
  ref,
) {
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const behaviorRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [k, setK] = useState(0.4);

  const fit = useCallback(() => {
    const svg = svgRef.current;
    const behavior = behaviorRef.current;
    if (!svg || !behavior) return;
    const width = svg.clientWidth;
    const height = svg.clientHeight;
    if (!width || !height) return;
    const spanX = Math.max(1, bounds.maxX - bounds.minX);
    const spanY = Math.max(1, bounds.maxY - bounds.minY);
    const pad = Math.min(110, Math.max(52, Math.min(width, height) * 0.08));
    const nextK = Math.max(0.05, Math.min(2.2, Math.min((width - pad * 2) / spanX, (height - pad * 2) / spanY)));
    const cx = (bounds.minX + bounds.maxX) / 2;
    const cy = (bounds.minY + bounds.maxY) / 2;
    const transform = zoomIdentity.translate(width / 2 - cx * nextK, height / 2 - cy * nextK).scale(nextK);
    select(svg).transition().duration(360).call(behavior.transform, transform);
    setK(nextK);
  }, [bounds]);

  const zoomBy = useCallback((factor: number) => {
    const svg = svgRef.current;
    const behavior = behaviorRef.current;
    if (!svg || !behavior) return;
    select(svg).transition().duration(180).call(behavior.scaleBy, factor);
  }, []);

  const focusOn = useCallback((x: number, y: number, nextK = 1.1) => {
    const svg = svgRef.current;
    const behavior = behaviorRef.current;
    if (!svg || !behavior) return;
    const width = svg.clientWidth;
    const height = svg.clientHeight;
    const transform = zoomIdentity.translate(width / 2 - x * nextK, height / 2 - y * nextK).scale(nextK);
    select(svg).transition().duration(420).call(behavior.transform, transform);
    setK(nextK);
  }, []);

  useImperativeHandle(ref, () => ({ fit, focusOn, zoomBy }), [fit, focusOn, zoomBy]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const behavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.035, 4])
      .on("zoom", (event) => {
        if (gRef.current) gRef.current.setAttribute("transform", event.transform.toString());
      })
      .on("end", (event) => setK(event.transform.k));
    behaviorRef.current = behavior;
    select(svg).call(behavior);
    const frame = requestAnimationFrame(() => fit());
    return () => {
      cancelAnimationFrame(frame);
      select(svg).on(".zoom", null);
      behaviorRef.current = null;
    };
    // The map is remounted per mode; fit on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => fit());
    observer.observe(svg);
    return () => observer.disconnect();
  }, [fit]);

  useEffect(() => {
    fit();
  }, [fit]);

  return (
    <div className="map-view">
      <svg
        ref={svgRef}
        className="map-svg"
        aria-label={label}
        role="group"
        onClick={(event) => {
          if (event.target === svgRef.current) onBackgroundClick?.();
        }}
      >
        <g ref={gRef}>{render(k)}</g>
      </svg>
      <div className="map-controls" aria-label="Map controls">
        <button type="button" className="icon-button" onClick={() => zoomBy(1.3)} aria-label="Zoom in">
          <Icon name="plus" size={16} />
        </button>
        <button type="button" className="icon-button" onClick={() => zoomBy(0.77)} aria-label="Zoom out">
          <Icon name="minus" size={16} />
        </button>
        <button type="button" className="icon-button" onClick={fit} aria-label="Fit map">
          <Icon name="fit" size={16} />
        </button>
      </div>
    </div>
  );
});
