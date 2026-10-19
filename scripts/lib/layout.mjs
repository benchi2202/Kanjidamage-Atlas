import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
} from "d3";

/**
 * Deterministic group-level layout. All initial positions are explicit, so the
 * simulation does not rely on Math.random and a rebuild produces the same map.
 */
export function forceLayout(nodes, edges, options = {}) {
  const {
    ticks = 420,
    charge = -130,
    linkGap = 34,
    collisionPadding = 10,
  } = options;
  const n = nodes.length;
  if (!n) return [];
  const ring = Math.max(280, Math.sqrt(n) * 95);
  nodes.forEach((node, i) => {
    const angle = (i / n) * Math.PI * 2;
    const wobble = 1 + ((i * 37) % 17) / 100;
    node.x = Math.cos(angle) * ring * wobble;
    node.y = Math.sin(angle) * ring * wobble;
    node.vx = 0;
    node.vy = 0;
  });

  const linkForce = forceLink(
    edges.map((edge) => ({ ...edge })),
  )
    .id((node) => node.id)
    .distance((edge) => (edge.source.r ?? 40) + (edge.target.r ?? 40) + linkGap)
    .strength((edge) => 0.08 + 0.72 * (edge.similarity ?? 0));

  const simulation = forceSimulation(nodes)
    .force("link", linkForce)
    .force("charge", forceManyBody().strength(charge).distanceMax(1200))
    .force("collide", forceCollide((node) => (node.r ?? 40) + collisionPadding).iterations(2))
    .force("center", forceCenter(0, 0))
    .stop();

  for (let i = 0; i < ticks; i++) simulation.tick();
  simulation.stop();

  // Normalize around the origin.
  const xs = nodes.map((node) => node.x ?? 0);
  const ys = nodes.map((node) => node.y ?? 0);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  return nodes.map((node) => ({
    id: node.id,
    x: Math.round(((node.x ?? 0) - cx) * 10) / 10,
    y: Math.round(((node.y ?? 0) - cy) * 10) / 10,
    r: node.r,
  }));
}
