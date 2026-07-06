<script lang="ts">
  import type { EvidenceCanvasPosition } from '$lib/types';
  import type { EvidenceGraph, EvidenceGraphEdge, EvidenceGraphNode } from '$lib/utils/evidence';
  import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation } from 'd3-force';
  import { createEventDispatcher, onDestroy, onMount } from 'svelte';

  export let graph: EvidenceGraph = { nodes: [], edges: [] };
  export let selectedNodeId = '';

  const dispatch = createEventDispatcher<{
    selectNode: { node: EvidenceGraphNode };
    selectEdge: { edge: EvidenceGraphEdge };
    positions: { positions: Record<string, EvidenceCanvasPosition> };
  }>();

  interface CanvasNode extends EvidenceGraphNode {
    x: number;
    y: number;
    vx?: number;
    vy?: number;
    fx?: number | null;
    fy?: number | null;
  }

  interface CanvasEdge extends Omit<EvidenceGraphEdge, 'source' | 'target'> {
    source: string | CanvasNode;
    target: string | CanvasNode;
  }

  const nodeColors: Record<string, string> = {
    green: '#4ade80',
    amber: '#f59e0b',
    blue: '#38bdf8',
    cyan: '#22d3ee',
    violet: '#a78bfa'
  };

  let canvas: HTMLCanvasElement;
  let context: CanvasRenderingContext2D | null = null;
  let simulation: ReturnType<typeof forceSimulation<CanvasNode>> | null = null;
  let nodes: CanvasNode[] = [];
  let edges: CanvasEdge[] = [];
  let width = 960;
  let height = 520;
  let zoom = 1;
  let panX = 0;
  let panY = 0;
  let pointerMode: 'idle' | 'pan' | 'drag' = 'idle';
  let activeNode: CanvasNode | null = null;
  let lastPointer = { x: 0, y: 0 };
  let resizeObserver: ResizeObserver | null = null;
  let drawQueued = false;
  let resizeTimer: ReturnType<typeof setTimeout> | null = null;

  $: graphKey = JSON.stringify({
    nodes: graph.nodes.map((node) => [node.id, node.type, node.label, node.subtitle, node.tone]),
    edges: graph.edges.map((edge) => [edge.id, edge.source, edge.target])
  });
  $: if (canvas && !context) setupCanvas();
  $: if (canvas && graphKey) rebuildGraph();

  function worldPoint(clientX: number, clientY: number): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left - panX) / zoom,
      y: (clientY - rect.top - panY) / zoom
    };
  }

  function screenPoint(clientX: number, clientY: number): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function edgeSource(edge: CanvasEdge): CanvasNode | undefined {
    return typeof edge.source === 'string' ? nodes.find((node) => node.id === edge.source) : edge.source;
  }

  function edgeTarget(edge: CanvasEdge): CanvasNode | undefined {
    return typeof edge.target === 'string' ? nodes.find((node) => node.id === edge.target) : edge.target;
  }

  function edgeEndpoint(edgeEndpoint: string | CanvasNode): CanvasNode | undefined {
    return typeof edgeEndpoint === 'string' ? nodes.find((node) => node.id === edgeEndpoint) : edgeEndpoint;
  }

  function linkDistance(edge: CanvasEdge): number {
    const source = edgeEndpoint(edge.source);
    const target = edgeEndpoint(edge.target);
    const sourceLabel = source?.label.length ?? 10;
    const targetLabel = target?.label.length ?? 10;
    const labelAllowance = Math.min(72, Math.max(sourceLabel, targetLabel) * 2.2);
    const nodeAllowance = ((source?.size ?? 16) + (target?.size ?? 16)) * 1.4;
    const base = edge.id.startsWith('folder:')
      ? 82
      : edge.relationship === 'belongs-to'
        ? 118
        : edge.relationship === 'proves'
          ? 148
          : 136;

    return Math.max(92, Math.min(280, base + labelAllowance + nodeAllowance));
  }

  function linkStrength(edge: CanvasEdge): number {
    if (edge.id.startsWith('folder:')) return 0.1;
    if (edge.relationship === 'proves') return 0.24;
    if (edge.relationship === 'belongs-to') return 0.16;
    return 0.14;
  }

  function scaled(value: number): number {
    return value / Math.max(zoom, 0.35);
  }

  function nodeRadius(node: CanvasNode): number {
    return scaled(Math.max(14, node.size * 0.72));
  }

  function nodeHitRadius(node: CanvasNode): number {
    return scaled(Math.max(26, node.size + 10));
  }

  function nodeAt(point: { x: number; y: number }): CanvasNode | null {
    for (const node of [...nodes].reverse()) {
      const dx = point.x - node.x;
      const dy = point.y - node.y;
      if (Math.sqrt(dx * dx + dy * dy) <= nodeHitRadius(node)) return node;
    }
    return null;
  }

  function labelText(text: string, maxLength: number): string {
    return text.length > maxLength ? `${text.slice(0, maxLength - 1)}...` : text;
  }

  function roundedRectPath(x: number, y: number, rectWidth: number, rectHeight: number, radius: number): void {
    if (!context) return;
    const safeRadius = Math.min(radius, rectWidth / 2, rectHeight / 2);
    context.beginPath();
    context.moveTo(x + safeRadius, y);
    context.lineTo(x + rectWidth - safeRadius, y);
    context.quadraticCurveTo(x + rectWidth, y, x + rectWidth, y + safeRadius);
    context.lineTo(x + rectWidth, y + rectHeight - safeRadius);
    context.quadraticCurveTo(x + rectWidth, y + rectHeight, x + rectWidth - safeRadius, y + rectHeight);
    context.lineTo(x + safeRadius, y + rectHeight);
    context.quadraticCurveTo(x, y + rectHeight, x, y + rectHeight - safeRadius);
    context.lineTo(x, y + safeRadius);
    context.quadraticCurveTo(x, y, x + safeRadius, y);
  }

  function distanceToSegment(
    point: { x: number; y: number },
    start: { x: number; y: number },
    end: { x: number; y: number }
  ): number {
    const lengthSquared = (end.x - start.x) ** 2 + (end.y - start.y) ** 2;
    if (lengthSquared === 0) return Math.hypot(point.x - start.x, point.y - start.y);
    const t = Math.max(
      0,
      Math.min(1, ((point.x - start.x) * (end.x - start.x) + (point.y - start.y) * (end.y - start.y)) / lengthSquared)
    );
    return Math.hypot(point.x - (start.x + t * (end.x - start.x)), point.y - (start.y + t * (end.y - start.y)));
  }

  function edgeAt(point: { x: number; y: number }): EvidenceGraphEdge | null {
    for (const edge of edges) {
      const source = edgeSource(edge);
      const target = edgeTarget(edge);
      if (!source || !target) continue;
      if (distanceToSegment(point, source, target) <= 7 / zoom) return edge as EvidenceGraphEdge;
    }
    return null;
  }

  function emitPositions(): void {
    const positions = nodes.reduce<Record<string, EvidenceCanvasPosition>>((acc, node) => {
      acc[node.id] = { x: Math.round(node.x), y: Math.round(node.y) };
      return acc;
    }, {});
    dispatch('positions', { positions });
  }

  function clampNodesToViewport(): void {
    const margin = 112;
    for (const node of nodes) {
      if (!Number.isFinite(node.x)) node.x = width / 2;
      if (!Number.isFinite(node.y)) node.y = height / 2;
      node.x = Math.min(width - margin, Math.max(margin, node.x));
      node.y = Math.min(height - margin, Math.max(margin, node.y));
    }
  }

  function scheduleDraw(): void {
    if (drawQueued) return;
    drawQueued = true;
    requestAnimationFrame(() => {
      drawQueued = false;
      draw();
    });
  }

  function tickLayout(): void {
    clampNodesToViewport();
    if (simulation && simulation.alpha() < 0.025) return;
    scheduleDraw();
  }

  function finishLayout(): void {
    clampNodesToViewport();
    draw();
    emitPositions();
  }

  function rebuildGraph(): void {
    simulation?.stop();
    const byId = new Map(nodes.map((node) => [node.id, node]));
    nodes = graph.nodes.map((node, index) => ({
      ...node,
      x: node.x ?? byId.get(node.id)?.x ?? width / 2 + Math.cos(index) * 160,
      y: node.y ?? byId.get(node.id)?.y ?? height / 2 + Math.sin(index) * 120
    }));
    edges = graph.edges.map((edge) => ({ ...edge }));

    simulation = forceSimulation(nodes)
      .force(
        'link',
        forceLink<CanvasNode, CanvasEdge>(edges)
          .id((node) => node.id)
          .distance(linkDistance)
          .strength(linkStrength)
      )
      .force('charge', forceManyBody().strength(-170))
      .force('collide', forceCollide<CanvasNode>().radius((node) => node.size + 18))
      .force('center', forceCenter(width / 2, height / 2))
      .alpha(0.8)
      .alphaMin(0.025)
      .alphaDecay(0.055)
      .velocityDecay(0.4)
      .on('tick', tickLayout)
      .on('end', finishLayout);

    draw();
  }

  function setupCanvas(): void {
    if (!canvas) return;
    context = canvas.getContext('2d');
    const parent = canvas.parentElement;
    if (!parent) return;

    const resize = () => {
      const rect = parent.getBoundingClientRect();
      const scale = window.devicePixelRatio || 1;
      width = Math.max(320, rect.width);
      height = Math.max(420, rect.height);
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context = canvas.getContext('2d');
      context?.setTransform(scale, 0, 0, scale, 0, 0);
      draw();
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resizeTimer = null;
        simulation?.force('center', forceCenter(width / 2, height / 2));
        simulation?.alpha(0.4).restart();
      }, 150);
    };

    resize();
    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(parent);
  }

  function draw(): void {
    if (!context) return;
    context.clearRect(0, 0, width, height);
    context.save();
    context.translate(panX, panY);
    context.scale(zoom, zoom);

    context.strokeStyle = 'rgba(74, 222, 128, 0.08)';
    context.lineWidth = 1 / zoom;
    for (let x = -panX / zoom - 80; x < (width - panX) / zoom + 80; x += 80) {
      context.beginPath();
      context.moveTo(x, -panY / zoom - 80);
      context.lineTo(x, (height - panY) / zoom + 80);
      context.stroke();
    }
    for (let y = -panY / zoom - 80; y < (height - panY) / zoom + 80; y += 80) {
      context.beginPath();
      context.moveTo(-panX / zoom - 80, y);
      context.lineTo((width - panX) / zoom + 80, y);
      context.stroke();
    }

    for (const edge of edges) {
      const source = edgeSource(edge);
      const target = edgeTarget(edge);
      if (!source || !target) continue;
      const proves = edge.relationship === 'proves';
      const folderEdge = edge.id.startsWith('folder:');
      context.beginPath();
      context.moveTo(source.x, source.y);
      context.lineTo(target.x, target.y);
      context.strokeStyle = proves
        ? 'rgba(74, 222, 128, 0.72)'
        : folderEdge
          ? 'rgba(125, 211, 252, 0.34)'
          : 'rgba(125, 211, 252, 0.48)';
      context.lineWidth = scaled(proves ? 1.15 : folderEdge ? 0.65 : 0.85);
      context.stroke();

      if (folderEdge || (edges.length > 6 && !proves) || zoom < 0.9) continue;

      const midX = (source.x + target.x) / 2;
      const midY = (source.y + target.y) / 2;
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const length = Math.max(1, Math.hypot(dx, dy));
      const label = labelText(edge.label || edge.relationship, 28);
      const labelFontSize = scaled(8.5);
      const labelOffset = scaled(9);
      const labelX = midX + (-dy / length) * labelOffset;
      const labelY = midY + (dx / length) * labelOffset;

      context.font = `650 ${labelFontSize}px Inter, ui-sans-serif, system-ui`;
      context.textAlign = 'center';
      const edgeLabelWidth = context.measureText(label).width + scaled(11);
      const edgeLabelHeight = scaled(16);
      roundedRectPath(labelX - edgeLabelWidth / 2, labelY - edgeLabelHeight / 2, edgeLabelWidth, edgeLabelHeight, scaled(999));
      context.fillStyle = proves ? 'rgba(20, 83, 45, 0.72)' : 'rgba(8, 47, 73, 0.68)';
      context.fill();
      context.strokeStyle = proves ? 'rgba(134, 239, 172, 0.42)' : 'rgba(125, 211, 252, 0.32)';
      context.lineWidth = 1 / zoom;
      context.stroke();
      context.fillStyle = '#ecfeff';
      context.fillText(label, labelX, labelY + scaled(3));
    }

    for (const node of nodes) {
      const selected = node.id === selectedNodeId;
      const color = nodeColors[node.tone] ?? '#94a3b8';
      const radius = nodeRadius(node);
      const haloRadius = radius + scaled(selected ? 6 : 3);
      const coreRadius = scaled(Math.max(5, node.size * 0.28));
      const label = labelText(node.label, 28);
      const subtitle = labelText(node.subtitle, 34);
      const labelFontSize = scaled(10.5);
      const subtitleFontSize = scaled(8.5);
      const labelGap = scaled(10);
      const labelY = node.y + radius + labelGap;

      context.beginPath();
      context.arc(node.x, node.y, haloRadius, 0, Math.PI * 2);
      context.fillStyle = selected ? 'rgba(74, 222, 128, 0.2)' : 'rgba(15, 23, 42, 0.92)';
      context.fill();
      context.strokeStyle = selected ? '#bbf7d0' : color;
      context.lineWidth = (selected ? 2.5 : 1.5) / zoom;
      context.stroke();

      context.beginPath();
      context.arc(node.x, node.y, coreRadius, 0, Math.PI * 2);
      context.fillStyle = color;
      context.fill();

      context.font = `650 ${labelFontSize}px Inter, ui-sans-serif, system-ui`;
      context.textAlign = 'center';
      const labelWidth = Math.max(context.measureText(label).width, context.measureText(subtitle).width) + scaled(14);
      const labelHeight = scaled(28);
      roundedRectPath(node.x - labelWidth / 2, labelY - scaled(11), labelWidth, labelHeight, scaled(8));
      context.fillStyle = 'rgba(2, 6, 23, 0.78)';
      context.fill();
      context.strokeStyle = 'rgba(74, 222, 128, 0.16)';
      context.lineWidth = 1 / zoom;
      context.stroke();

      context.fillStyle = '#f8fafc';
      context.fillText(label, node.x, labelY);
      context.font = `500 ${subtitleFontSize}px Inter, ui-sans-serif, system-ui`;
      context.fillStyle = '#cbd5e1';
      context.fillText(subtitle, node.x, labelY + scaled(11));
    }

    context.restore();
  }

  function fitView(): void {
    if (nodes.length === 0) {
      zoom = 1;
      panX = 0;
      panY = 0;
      draw();
      return;
    }

    const xs = nodes.map((node) => node.x);
    const ys = nodes.map((node) => node.y);
    const minX = Math.min(...xs) - 96;
    const maxX = Math.max(...xs) + 96;
    const minY = Math.min(...ys) - 96;
    const maxY = Math.max(...ys) + 96;
    zoom = Math.max(0.45, Math.min(1.8, Math.min(width / (maxX - minX), height / (maxY - minY))));
    panX = width / 2 - ((minX + maxX) / 2) * zoom;
    panY = height / 2 - ((minY + maxY) / 2) * zoom;
    draw();
  }

  function handlePointerDown(event: PointerEvent): void {
    canvas.setPointerCapture(event.pointerId);
    const world = worldPoint(event.clientX, event.clientY);
    const screen = screenPoint(event.clientX, event.clientY);
    const node = nodeAt(world);
    lastPointer = screen;

    if (node) {
      pointerMode = 'drag';
      activeNode = node;
      simulation?.stop();
      node.vx = 0;
      node.vy = 0;
      selectedNodeId = node.id;
      dispatch('selectNode', { node });
      return;
    }

    const edge = edgeAt(world);
    if (edge) dispatch('selectEdge', { edge });
    pointerMode = 'pan';
  }

  function handlePointerMove(event: PointerEvent): void {
    if (pointerMode === 'idle') return;
    const screen = screenPoint(event.clientX, event.clientY);

    if (pointerMode === 'drag' && activeNode) {
      const world = worldPoint(event.clientX, event.clientY);
      activeNode.x = world.x;
      activeNode.y = world.y;
      activeNode.vx = 0;
      activeNode.vy = 0;
      draw();
    } else if (pointerMode === 'pan') {
      panX += screen.x - lastPointer.x;
      panY += screen.y - lastPointer.y;
      draw();
    }

    lastPointer = screen;
  }

  function handlePointerUp(event: PointerEvent): void {
    canvas.releasePointerCapture(event.pointerId);
    if (activeNode) {
      activeNode.vx = 0;
      activeNode.vy = 0;
      emitPositions();
    }
    activeNode = null;
    pointerMode = 'idle';
  }

  function handleWheel(event: WheelEvent): void {
    event.preventDefault();
    const before = worldPoint(event.clientX, event.clientY);
    const nextZoom = Math.max(0.35, Math.min(2.8, zoom * (event.deltaY > 0 ? 0.9 : 1.1)));
    zoom = nextZoom;
    const after = screenPoint(event.clientX, event.clientY);
    panX = after.x - before.x * zoom;
    panY = after.y - before.y * zoom;
    draw();
  }

  onMount(() => {
    setupCanvas();
    rebuildGraph();
  });

  onDestroy(() => {
    simulation?.stop();
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeObserver?.disconnect();
  });
</script>

<section class="hf-card overflow-hidden">
  <div class="flex flex-col gap-3 border-b border-border/70 p-4 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <p class="op-kicker">Canvas</p>
      <h2 class="mt-2 text-lg font-semibold text-foreground">Evidence graph</h2>
      <p class="mt-1 text-sm text-muted-foreground">Drag nodes, pan the field, and use the wheel to zoom.</p>
    </div>
    <div class="flex flex-wrap gap-2">
      <button type="button" class="hf-button-secondary" on:click={fitView}>Fit view</button>
    </div>
  </div>

  <div class="relative h-[520px] min-h-[420px] bg-black/40">
    {#if graph.nodes.length > 0}
      <canvas
        bind:this={canvas}
        class="block cursor-grab touch-none focus:outline-none"
        aria-label="Interactive evidence graph canvas"
        tabindex="0"
        on:pointerdown={handlePointerDown}
        on:pointermove={handlePointerMove}
        on:pointerup={handlePointerUp}
        on:pointercancel={handlePointerUp}
        on:wheel={handleWheel}
      ></canvas>
    {:else}
      <div class="flex h-full items-center justify-center px-6 text-center">
        <div>
          <p class="text-sm font-semibold text-foreground">No graph nodes yet</p>
          <p class="mt-2 max-w-md text-sm text-muted-foreground">
            Add evidence and attach it to a target, note, or session to populate the canvas.
          </p>
        </div>
      </div>
    {/if}
  </div>
</section>
