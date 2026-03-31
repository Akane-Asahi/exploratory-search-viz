import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';

function PaperForceGraph({ data }) {
  const wrapperRef = useRef(null);
  const [size, setSize] = useState({ width: 640, height: 640 });
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  const [layout, setLayout] = useState({ nodes: [], links: [] });

  useEffect(() => {
    if (!wrapperRef.current) return undefined;
    const el = wrapperRef.current;
    const updateSize = () => {
      setSize({
        width: Math.max(520, Math.floor(el.clientWidth)),
        height: Math.max(420, Math.floor(el.clientHeight))
      });
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const baseNodes = useMemo(() => (Array.isArray(data?.nodes) ? data.nodes : []), [data]);
  const baseLinks = useMemo(() => (Array.isArray(data?.links) ? data.links : []), [data]);
  const maxCitation = useMemo(
    () => Math.max(1, ...baseNodes.map((n) => Number(n.citationCount || 0))),
    [baseNodes]
  );
  const radiusScale = useMemo(
    () => d3.scaleSqrt().domain([0, maxCitation]).range([8, 34]),
    [maxCitation]
  );
  const targetPositions = useMemo(() => {
    const nodes = Array.isArray(baseNodes) ? baseNodes : [];
    const n = nodes.length;
    if (n === 0) return new Map();

    const map = new Map();
    const margin = 24;
    const usableWidth = Math.max(240, size.width - margin * 2);
    const usableHeight = Math.max(200, size.height - margin * 2);
    const cols = Math.max(3, Math.ceil(Math.sqrt(n * (usableWidth / usableHeight))));
    const rows = Math.max(2, Math.ceil(n / cols));
    const stepX = usableWidth / Math.max(1, cols - 1);
    const stepY = usableHeight / Math.max(1, rows - 1);

    nodes.forEach((node, i) => {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const jitterX = ((i * 37) % 11) - 5;
      const jitterY = ((i * 53) % 9) - 4;
      map.set(node.id, {
        x: margin + col * stepX + jitterX,
        y: margin + row * stepY + jitterY
      });
    });
    return map;
  }, [baseNodes, size.width, size.height]);

  useEffect(() => {
    if (baseNodes.length === 0) {
      setLayout({ nodes: [], links: [] });
      return;
    }

    const nodes = baseNodes.map((n) => ({ ...n }));
    const links = baseLinks.map((l) => ({ ...l }));
    const margin = 20;

    const simulation = d3
      .forceSimulation(nodes)
      .force('link', d3.forceLink(links).id((d) => d.id).distance((d) => 130 + (4 - Math.min(d.weight || 1, 4)) * 22).strength(0.08))
      .force('charge', d3.forceManyBody().strength(-320))
      .force('center', d3.forceCenter(size.width / 2, size.height / 2))
      .force('x', d3.forceX((d) => targetPositions.get(d.id)?.x ?? size.width / 2).strength(0.24))
      .force('y', d3.forceY((d) => targetPositions.get(d.id)?.y ?? size.height / 2).strength(0.24))
      .force('collision', d3.forceCollide().radius((d) => radiusScale(Number(d.citationCount || 0)) + 4));

    simulation.on('tick', () => {
      nodes.forEach((node) => {
        const r = radiusScale(Number(node.citationCount || 0));
        node.x = Math.max(margin + r, Math.min(size.width - margin - r, node.x || 0));
        node.y = Math.max(margin + r, Math.min(size.height - margin - r, node.y || 0));
      });
      setLayout({ nodes: [...nodes], links: [...links] });
    });

    return () => simulation.stop();
  }, [baseNodes, baseLinks, size.width, size.height, radiusScale, targetPositions]);

  const tooltipNode = layout.nodes.find((n) => n.id === hoveredNodeId) || null;
  const activeNodeId = hoveredNodeId;
  const connectedNodeIds = useMemo(() => {
    if (!activeNodeId) return new Set();
    const set = new Set([activeNodeId]);
    layout.links.forEach((link) => {
      const sourceId = typeof link.source === 'string' ? link.source : link.source?.id;
      const targetId = typeof link.target === 'string' ? link.target : link.target?.id;
      if (sourceId === activeNodeId && targetId) set.add(targetId);
      if (targetId === activeNodeId && sourceId) set.add(sourceId);
    });
    return set;
  }, [activeNodeId, layout.links]);

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
      <svg width={size.width} height={size.height} style={{ background: '#fbfdff', borderRadius: 8 }}>
        <g>
          {layout.links.map((link, idx) => {
            const sourceId = typeof link.source === 'string' ? link.source : link.source?.id;
            const targetId = typeof link.target === 'string' ? link.target : link.target?.id;
            const isConnectedToActive =
              !!activeNodeId && (sourceId === activeNodeId || targetId === activeNodeId);
            return (
              <line
                key={`link-${idx}`}
                x1={link.source?.x || 0}
                y1={link.source?.y || 0}
                x2={link.target?.x || 0}
                y2={link.target?.y || 0}
                stroke={isConnectedToActive ? '#1d4ed8' : '#94a3b8'}
                strokeOpacity={activeNodeId ? (isConnectedToActive ? 0.9 : 0) : 0}
                strokeWidth={Math.min(3, 0.8 + (link.weight || 1) * 0.35)}
              />
            );
          })}
        </g>
        <g>
          {layout.nodes.map((node) => {
            const r = radiusScale(Number(node.citationCount || 0));
            const isConnected = connectedNodeIds.has(node.id);
            const inactive = !!activeNodeId && !isConnected;
            const activeOrConnected = !!activeNodeId && isConnected;
            return (
              <g key={node.id} transform={`translate(${node.x || 0}, ${node.y || 0})`}>
                <circle
                  r={r}
                  fill={
                    inactive
                      ? '#e5e7eb'
                      : activeOrConnected
                        ? '#2563eb'
                        : '#cbd5e1'
                  }
                  fillOpacity={inactive ? 0.2 : (activeOrConnected ? 0.85 : 0.92)}
                  stroke={activeOrConnected ? '#1e3a8a' : '#94a3b8'}
                  strokeWidth={activeOrConnected ? 1.2 : 0.9}
                  onMouseEnter={() => setHoveredNodeId(node.id)}
                  onMouseLeave={() => setHoveredNodeId(null)}
                  style={{ cursor: 'pointer' }}
                />
                <text
                  y={r + 12}
                  textAnchor="middle"
                  fontSize="9"
                  fill={inactive ? '#cbd5e1' : '#334155'}
                  style={{ pointerEvents: 'none', fontFamily: "'Consolas', monospace" }}
                >
                  {(node.title || '').slice(0, 24)}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {tooltipNode && (
        <div
          style={{
            position: 'absolute',
            right: 10,
            top: 10,
            width: 330,
            maxHeight: 230,
            overflowY: 'auto',
            background: 'rgba(255,255,255,0.96)',
            border: '1px solid #dbe2ea',
            borderRadius: 8,
            padding: 10,
            fontFamily: "'Consolas', monospace",
            fontSize: 11,
            color: '#1f2937',
            lineHeight: 1.45
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 6 }}>{tooltipNode.title}</div>
          <div><strong>Citations:</strong> {tooltipNode.citationCount ?? 0}</div>
          <div><strong>Keywords:</strong> {(tooltipNode.keywords || []).slice(0, 8).join(', ') || 'N/A'}</div>
          <div><strong>Terminologies:</strong> {(tooltipNode.concepts || []).slice(0, 8).join(', ') || 'N/A'}</div>
          {tooltipNode.link ? (
            <div>
              <strong>Link:</strong>{' '}
              <a href={tooltipNode.link} target="_blank" rel="noreferrer">
                {tooltipNode.link}
              </a>
            </div>
          ) : (
            <div><strong>Link:</strong> N/A</div>
          )}
        </div>
      )}
    </div>
  );
}

export default PaperForceGraph;
