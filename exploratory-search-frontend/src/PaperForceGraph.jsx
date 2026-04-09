import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as am5 from '@amcharts/amcharts5';
import * as am5hierarchy from '@amcharts/amcharts5/hierarchy';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';

const TREE_CONFIG = {
  singleBranchOnly: false,
  centerStrength: 0.6,
  topDepth: 0,
  downDepth: 2,
  initialDepth: 3,
  maxLabelDepth: 2
};

const COLORS = {
  node: am5.color(0xcbd5e1),
  nodeStroke: am5.color(0x94a3b8),
  nodeHover: am5.color(0x2563eb),
  nodeHoverStroke: am5.color(0x1e3a8a),
  link: am5.color(0x94a3b8),
  linkHover: am5.color(0x2563eb),
  label: am5.color(0x334155)
};

function resolveId(value) {
  return typeof value === 'string' ? value : value?.id;
}

function resolvePointerPosition(event, container) {
  const raw = event?.originalEvent || event?.event?.originalEvent || null;
  if (raw && container?.getBoundingClientRect) {
    const rect = container.getBoundingClientRect();
    return {
      x: raw.clientX - rect.left,
      y: raw.clientY - rect.top
    };
  }

  if (event?.point && Number.isFinite(event.point.x) && Number.isFinite(event.point.y)) {
    return { x: event.point.x, y: event.point.y };
  }

  return { x: 16, y: 16 };
}

function getEndpointInfo(linkSprite, end) {
  // Fix: Check the sprite directly for 'source' or 'target' first
  const endpoint = linkSprite?.get?.(end) || linkSprite?.dataItem?.get?.(end);
  
  const context = endpoint?.dataItem?.dataContext
    || endpoint?.dataItem?.get?.('dataContext')
    || endpoint?.dataContext
    || endpoint?.get?.('dataItem')?.dataContext
    || {};
    
  const depth = endpoint?.dataItem?.get?.('depth') ?? endpoint?.get?.('depth');
  
  return { context, depth };
}

function getLinkParentChildData(linkSprite) {
  const source = getEndpointInfo(linkSprite, 'source');
  const target = getEndpointInfo(linkSprite, 'target');
  const linkContext = (linkSprite?.dataItem?.dataContext && typeof linkSprite.dataItem.dataContext === 'object')
    ? linkSprite.dataItem.dataContext
    : {};

  const sourceDepth = typeof source.depth === 'number' ? source.depth : Number.NEGATIVE_INFINITY;
  const targetDepth = typeof target.depth === 'number' ? target.depth : Number.NEGATIVE_INFINITY;

  if (targetDepth > sourceDepth) {
    return { parentData: source.context || {}, childData: target.context || {} };
  }
  if (sourceDepth > targetDepth) {
    return { parentData: target.context || {}, childData: source.context || {} };
  }

  // Fallback when depth is unavailable: prefer endpoint with parent-edge metadata as child.
  if (source?.context?.parentEdgeDetails && !target?.context?.parentEdgeDetails) {
    return { parentData: target.context || {}, childData: source.context || {} };
  }
  if (target?.context?.parentEdgeDetails && !source?.context?.parentEdgeDetails) {
    return { parentData: source.context || {}, childData: target.context || {} };
  }
  if (linkContext?.parentEdgeDetails) {
    const parentData = Object.keys(source.context || {}).length > 0 ? source.context : (target.context || {});
    return { parentData, childData: linkContext };
  }
  if (Object.keys(target.context || {}).length > 0 || Object.keys(source.context || {}).length > 0) {
    return { parentData: source.context || {}, childData: target.context || {} };
  }
  return { parentData: {}, childData: linkContext || {} };
}

function isSyntheticCitationLink(linkSprite, mode) {
  if (mode !== 'citation') return false;
  const { childData } = getLinkParentChildData(linkSprite);
  return Boolean(childData?.parentEdgeDetails?.isSynthetic);
}

function formatPaperWithYear(title, year) {
  const safeTitle = title || 'Unknown paper';
  const safeYear = Number.isFinite(Number(year)) && Number(year) > 0 ? Number(year) : 'Unknown';
  return `${safeTitle} (${safeYear})`;
}

function buildEdgeTooltipLines(linkSprite, mode) {
  const { parentData, childData } = getLinkParentChildData(linkSprite);
  const edgeDetails = childData?.parentEdgeDetails || {};

  if (mode === 'citation') {
    if (edgeDetails.isSynthetic) {
      return null;
    }
    if (!childData || Object.keys(childData).length === 0) {
      return null;
    }
    const childLabel = formatPaperWithYear(
      childData.fullTitle || childData.name || edgeDetails.citingTitle || 'Unknown paper',
      childData.year
    );
    const parentLabel = formatPaperWithYear(
      parentData.fullTitle || parentData.name || edgeDetails.citedTitle || 'Unknown paper',
      parentData.year
    );
    const citationYear = childData.year || edgeDetails.citationYear || 'Unknown';
    const sharedTerms = Array.isArray(edgeDetails.sharedTerms) ? edgeDetails.sharedTerms : [];
    const childUniqueTerms = Array.isArray(edgeDetails.childUniqueTerms) ? edgeDetails.childUniqueTerms : [];
    const parentUniqueTerms = Array.isArray(edgeDetails.parentUniqueTerms) ? edgeDetails.parentUniqueTerms : [];
    return [
      `${childLabel} cites ${parentLabel}`,
      `Year cited: ${citationYear}`,
      `Common terminology: ${sharedTerms.length > 0 ? sharedTerms.join(', ') : 'None'}`,
      `Unique to child: ${childUniqueTerms.length > 0 ? childUniqueTerms.join(', ') : 'None'}`,
      `Unique to parent: ${parentUniqueTerms.length > 0 ? parentUniqueTerms.join(', ') : 'None'}`
    ];
  }

  const targetLabel = formatPaperWithYear(
    edgeDetails.childTitle || childData.fullTitle || childData.name || 'Unknown paper',
    childData.year
  );
  const parentLabel = formatPaperWithYear(
    edgeDetails.parentTitle || parentData.fullTitle || parentData.name || 'Unknown paper',
    parentData.year
  );
  const sharedTerms = Array.isArray(edgeDetails.sharedTerms) ? edgeDetails.sharedTerms : [];
  const childUniqueTerms = Array.isArray(edgeDetails.childUniqueTerms) ? edgeDetails.childUniqueTerms : [];
  const parentUniqueTerms = Array.isArray(edgeDetails.parentUniqueTerms) ? edgeDetails.parentUniqueTerms : [];
  return [
    `${targetLabel} connected with ${parentLabel}`,
    'Year cited: N/A (terminology edge)',
    `Common terminology: ${sharedTerms.length > 0 ? sharedTerms.join(', ') : 'None'}`,
    `Unique to child: ${childUniqueTerms.length > 0 ? childUniqueTerms.join(', ') : 'None'}`,
    `Unique to parent: ${parentUniqueTerms.length > 0 ? parentUniqueTerms.join(', ') : 'None'}`
  ];
}

function graphToTerminologyHierarchy(data) {
  const nodes = Array.isArray(data?.nodes) ? data.nodes : [];
  const links = Array.isArray(data?.terminologyLinks)
    ? data.terminologyLinks
    : (Array.isArray(data?.links) ? data.links : []);
  if (nodes.length === 0) return { name: 'Root', value: 1, children: [] };

  const normalizeTerm = (value) => (value || '').toString().trim().toLowerCase();
  const getTerminologyCount = (paper) => {
    const termSet = new Set();
    (paper?.keywords || []).forEach((t) => {
      const key = normalizeTerm(t);
      if (key) termSet.add(key);
    });
    (paper?.tags || []).forEach((t) => {
      const key = normalizeTerm(t);
      if (key) termSet.add(key);
    });
    const primaryKey = normalizeTerm(paper?.primaryTopic || '');
    if (primaryKey) termSet.add(primaryKey);
    return termSet.size;
  };
  const toYearComparable = (value) => {
    const year = Number(value);
    return Number.isFinite(year) && year > 0 ? year : Number.MAX_SAFE_INTEGER;
  };

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const edgeMeta = new Map();
  const edgeKey = (a, b) => [a, b].sort().join('__');
  const scoreById = new Map(
    nodes.map((n) => {
      const terminologyCount = getTerminologyCount(n);
      const citationCount = Number(n?.citationCount || 0);
      return [n.id, citationCount * terminologyCount];
    })
  );

  links.forEach((link) => {
    const source = resolveId(link.source);
    const target = resolveId(link.target);
    if (!source || !target || source === target) return;
    if (!byId.has(source) || !byId.has(target)) return;
    const weight = Math.max(1, Number(link.weight || 1));
    const sharedTerms = Array.isArray(link.sharedTerms)
      ? link.sharedTerms.filter(Boolean).slice(0, 14)
      : [];
    const sourceUniqueTerms = Array.isArray(link.sourceUniqueTerms)
      ? link.sourceUniqueTerms.filter(Boolean).slice(0, 14)
      : [];
    const targetUniqueTerms = Array.isArray(link.targetUniqueTerms)
      ? link.targetUniqueTerms.filter(Boolean).slice(0, 14)
      : [];
    edgeMeta.set(edgeKey(source, target), {
      weight,
      sharedTerms,
      uniqueById: {
        [source]: sourceUniqueTerms,
        [target]: targetUniqueTerms
      }
    });
  });

  const sortedByTerminologyScore = [...nodes].sort((a, b) => {
    const scoreDiff = (scoreById.get(b.id) || 0) - (scoreById.get(a.id) || 0);
    if (scoreDiff !== 0) return scoreDiff;
    const yearDiff = toYearComparable(a.year) - toYearComparable(b.year);
    if (yearDiff !== 0) return yearDiff; // earlier paper wins tie
    return Number(b.citationCount || 0) - Number(a.citationCount || 0);
  });
  const rootPaper = sortedByTerminologyScore[0];
  const rootId = rootPaper.id;

  const parentByChild = new Map();
  const orderedIds = sortedByTerminologyScore.map((n) => n.id);
  const orderedSet = new Set();
  orderedIds.forEach((childId, index) => {
    if (index === 0) {
      orderedSet.add(childId);
      return;
    }
    const higherRanked = orderedIds.slice(0, index);
    let bestParent = null;
    higherRanked.forEach((candidateParentId) => {
      const meta = edgeMeta.get(edgeKey(childId, candidateParentId));
      if (!meta) return;
      const weight = Number(meta.weight || 0);
      const candidate = {
        id: candidateParentId,
        weight,
        score: scoreById.get(candidateParentId) || 0,
        year: toYearComparable(byId.get(candidateParentId)?.year),
        citations: Number(byId.get(candidateParentId)?.citationCount || 0)
      };
      if (!bestParent) {
        bestParent = candidate;
        return;
      }
      if (candidate.weight > bestParent.weight) {
        bestParent = candidate;
        return;
      }
      if (candidate.weight === bestParent.weight) {
        if (candidate.score > bestParent.score) {
          bestParent = candidate;
          return;
        }
        if (candidate.score === bestParent.score) {
          if (candidate.year < bestParent.year) {
            bestParent = candidate;
            return;
          }
          if (candidate.year === bestParent.year && candidate.citations > bestParent.citations) {
            bestParent = candidate;
          }
        }
      }
    });
    parentByChild.set(childId, bestParent?.id || rootId);
    orderedSet.add(childId);
  });

  const childrenByParent = new Map(nodes.map((n) => [n.id, []]));
  parentByChild.forEach((parentId, childId) => {
    childrenByParent.get(parentId)?.push(childId);
  });

  const buildNode = (id, parentId = null, clusterId = null) => {
    const paper = byId.get(id);
    const children = (childrenByParent.get(id) || []).map((childId) => buildNode(childId, id, clusterId));
    const display = paper?.title || id;
    const sharedTerms = parentId
      ? (edgeMeta.get(edgeKey(id, parentId))?.sharedTerms || [])
      : [];
    const childUniqueTerms = parentId
      ? (edgeMeta.get(edgeKey(id, parentId))?.uniqueById?.[id] || [])
      : [];
    const parentUniqueTerms = parentId
      ? (edgeMeta.get(edgeKey(id, parentId))?.uniqueById?.[parentId] || [])
      : [];
    const parentPaper = parentId ? byId.get(parentId) : null;
    return {
      id,
      name: display.length > 64 ? `${display.slice(0, 64)}...` : display,
      fullTitle: display,
      year: paper?.year || null,
      terminologyScore: scoreById.get(id) || 0,
      value: Math.max(1, Number(paper?.citationCount || 1)),
      parentEdgeDetails: {
        childTitle: display,
        parentTitle: parentPaper?.title || '',
        sharedTerms,
        childUniqueTerms,
        parentUniqueTerms
      },
      children: children.length > 0 ? children : undefined
    };
  };

  return {
    name: rootPaper.title || 'Root',
    fullTitle: rootPaper.title || 'Root',
    year: rootPaper.year || null,
    terminologyScore: scoreById.get(rootId) || 0,
    value: Math.max(1, Number(rootPaper.citationCount || 1)),
    parentEdgeDetails: {
      childTitle: '',
      parentTitle: '',
      sharedTerms: [],
      childUniqueTerms: [],
      parentUniqueTerms: []
    },
    children: (childrenByParent.get(rootId) || []).map((id) => buildNode(id, rootId))
  };
}

function graphToCitationHierarchy(data) {
  const nodes = Array.isArray(data?.nodes) ? data.nodes : [];
  const citationLinks = Array.isArray(data?.citationLinks) ? data.citationLinks : [];
  if (nodes.length === 0) return { name: 'Root', value: 1, children: [] };

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const ROOT_ID = '__citation_forest_root__';
  const parentByChild = new Map();
  const childrenByParent = new Map(nodes.map((n) => [n.id, []]));
  const candidateParentsByChild = new Map(nodes.map((n) => [n.id, []]));
  const edgeMeta = new Map();

  const yearValue = (value) => {
    const year = Number(value);
    return Number.isFinite(year) && year > 0 ? year : null;
  };

  citationLinks.forEach((link) => {
    const citerId = resolveId(link.source);
    const citedId = resolveId(link.target);
    if (!citerId || !citedId || citerId === citedId) return;
    if (!candidateParentsByChild.has(citerId)) return;
    candidateParentsByChild.get(citerId).push(citedId);
    const sourcePaper = byId.get(citerId);
    const targetPaper = byId.get(citedId);
    edgeMeta.set(`${citerId}=>${citedId}`, {
      citingTitle: link.sourceTitle || sourcePaper?.title || citerId,
      citedTitle: link.targetTitle || targetPaper?.title || citedId,
      citationYear: link.citationYear || sourcePaper?.year || null,
      sharedTerms: Array.isArray(link.sharedTerms) ? link.sharedTerms.filter(Boolean).slice(0, 14) : [],
      childUniqueTerms: Array.isArray(link.sourceUniqueTerms) ? link.sourceUniqueTerms.filter(Boolean).slice(0, 14) : [],
      parentUniqueTerms: Array.isArray(link.targetUniqueTerms) ? link.targetUniqueTerms.filter(Boolean).slice(0, 14) : []
    });
  });

  const createsCycle = (childId, parentId) => {
    let current = parentId;
    const guard = new Set();
    while (current && parentByChild.has(current) && !guard.has(current)) {
      if (current === childId) return true;
      guard.add(current);
      current = parentByChild.get(current);
    }
    return current === childId;
  };

  nodes.forEach((childNode) => {
    const childId = childNode.id;
    const childYear = yearValue(childNode.year);
    const candidateParents = (candidateParentsByChild.get(childId) || [])
      .filter((parentId) => byId.has(parentId) && parentId !== childId)
      .filter((parentId) => {
        const parentYear = yearValue(byId.get(parentId)?.year);
        // Rule 1: prefer/require parent to be older than child when years are known.
        if (childYear && parentYear) return parentYear <= childYear;
        return true;
      })
      .sort((a, b) => {
        const yearA = yearValue(byId.get(a)?.year);
        const yearB = yearValue(byId.get(b)?.year);
        const yearScoreA = yearA ?? Number.MAX_SAFE_INTEGER;
        const yearScoreB = yearB ?? Number.MAX_SAFE_INTEGER;
        if (yearScoreA !== yearScoreB) return yearScoreA - yearScoreB; // oldest first
        return Number(byId.get(b)?.citationCount || 0) - Number(byId.get(a)?.citationCount || 0);
      });

    for (const parentId of candidateParents) {
      if (!createsCycle(childId, parentId)) {
        parentByChild.set(childId, parentId);
        break;
      }
    }
  });

  parentByChild.forEach((parentId, childId) => {
    if (!childrenByParent.has(parentId)) return;
    childrenByParent.get(parentId)?.push(childId);
  });

  const rootIds = nodes
    .map((n) => n.id)
    .filter((id) => !parentByChild.has(id))
    .sort((a, b) => {
      const yearA = yearValue(byId.get(a)?.year) ?? Number.MAX_SAFE_INTEGER;
      const yearB = yearValue(byId.get(b)?.year) ?? Number.MAX_SAFE_INTEGER;
      if (yearA !== yearB) return yearA - yearB;
      return Number(byId.get(b)?.citationCount || 0) - Number(byId.get(a)?.citationCount || 0);
    });

  const buildNode = (id, parentId = null, clusterId = null) => {
    const paper = byId.get(id);
    const children = (childrenByParent.get(id) || []).map((childId) => buildNode(childId, id, clusterId));
    const display = paper?.title || id;
    const parentPaper = parentId && parentId !== ROOT_ID ? byId.get(parentId) : null;
    const citationMeta = parentId && parentId !== ROOT_ID
      ? edgeMeta.get(`${id}=>${parentId}`)
      : null;
    const isSyntheticParent = parentId === ROOT_ID;
    return {
      id,
      name: display.length > 64 ? `${display.slice(0, 64)}...` : display,
      fullTitle: display,
      year: paper?.year || null,
      clusterId: clusterId || id,
      value: Math.max(1, Number(paper?.citationCount || 1)),
      parentEdgeDetails: citationMeta || {
        isSynthetic: isSyntheticParent,
        citingTitle: display,
        citedTitle: parentPaper?.title || parentId || '',
        citationYear: paper?.year || null,
        sharedTerms: [],
        childUniqueTerms: citationMeta?.childUniqueTerms || [],
        parentUniqueTerms: citationMeta?.parentUniqueTerms || []
      },
      children: children.length > 0 ? children : undefined
    };
  };
  return {
    id: ROOT_ID,
    // Hidden container root so all actual paper roots are visible (like the example pattern).
    name: 'CitationRoot',
    fullTitle: 'CitationRoot',
    year: null,
    value: 1,
    parentEdgeDetails: {
      isSynthetic: true,
      sharedTerms: [],
      childUniqueTerms: [],
      parentUniqueTerms: []
    },
    children: rootIds.map((id) => buildNode(id, ROOT_ID, id))
  };
}

function graphToHierarchy(data, mode = 'terminology') {
  return mode === 'citation'
    ? graphToCitationHierarchy(data)
    : graphToTerminologyHierarchy(data);
}

function findClusterIdByPaperId(rootNode, paperId) {
  if (!rootNode || !paperId) return null;
  const queue = [rootNode];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current?.id && String(current.id) === String(paperId)) {
      return current?.clusterId || null;
    }
    const children = Array.isArray(current?.children) ? current.children : [];
    children.forEach((child) => queue.push(child));
  }
  return null;
}

function PaperForceGraph({ data, mode = 'terminology', citationSpacing = 100, focusPaperId = null }) {
  const viewportRef = useRef(null);
  const chartRef = useRef(null);
  const contentContainerRef = useRef(null);
  const lastPanPointRef = useRef(null);
  const [edgeTooltip, setEdgeTooltip] = useState(null);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const chartData = useMemo(() => graphToHierarchy(data, mode), [data, mode]);
  const focusedClusterId = useMemo(() => {
    if (mode !== 'citation' || !focusPaperId) return null;
    return findClusterIdByPaperId(chartData, focusPaperId);
  }, [chartData, mode, focusPaperId]);
  const spacingRatio = Math.max(0, Math.min(100, Number(citationSpacing || 0))) / 100;
  const clusterCenterStrength = 1 - spacingRatio * 0.4; // left => compact, right => current spacing
  const clusterManyBodyStrength = -4 - spacingRatio * 12;

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === viewportRef.current);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    const container = contentContainerRef.current;
    if (!container) return;
    container.setAll({
      x: panOffset.x,
      y: panOffset.y,
      scale: zoomLevel
    });
  }, [panOffset, zoomLevel]);

  useEffect(() => {
    if (!isPanning) return undefined;
    const handleMove = (event) => {
      const last = lastPanPointRef.current;
      if (!last) return;
      const dx = event.clientX - last.x;
      const dy = event.clientY - last.y;
      lastPanPointRef.current = { x: event.clientX, y: event.clientY };
      setPanOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
    };
    const handleUp = () => {
      setIsPanning(false);
      lastPanPointRef.current = null;
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [isPanning]);

  const toggleFullscreen = async () => {
    if (!viewportRef.current) return;
    if (document.fullscreenElement === viewportRef.current) {
      await document.exitFullscreen?.();
      return;
    }
    await viewportRef.current.requestFullscreen?.();
  };

  const handleMouseDown = (event) => {
    if (event.button !== 1) return;
    event.preventDefault();
    lastPanPointRef.current = { x: event.clientX, y: event.clientY };
    setIsPanning(true);
  };

  const handleAuxClick = (event) => {
    if (event.button === 1) {
      event.preventDefault();
    }
  };

  const zoomOut = () => {
    setZoomLevel((prev) => Math.max(0.5, Number((prev - 0.15).toFixed(2))));
  };

  const zoomIn = () => {
    setZoomLevel((prev) => Math.min(2.5, Number((prev + 0.15).toFixed(2))));
  };

  useLayoutEffect(() => {
    if (!chartRef.current) return undefined;

    const root = am5.Root.new(chartRef.current);
    root.setThemes([am5themes_Animated.new(root)]);

    const container = root.container.children.push(
      am5.Container.new(root, {
        width: am5.percent(100),
        height: am5.percent(100),
        layout: root.verticalLayout
      })
    );
    contentContainerRef.current = container;

    const series = container.children.push(
      am5hierarchy.ForceDirected.new(root, {
        downDepth: mode === 'terminology' ? 99 : TREE_CONFIG.downDepth,
        initialDepth: mode === 'terminology' ? 99 : TREE_CONFIG.initialDepth,
        topDepth: mode === 'citation' ? 1 : TREE_CONFIG.topDepth,
        valueField: 'value',
        categoryField: 'name',
        childDataField: 'children',
        singleBranchOnly: TREE_CONFIG.singleBranchOnly,
        centerStrength: clusterCenterStrength,
        manyBodyStrength: clusterManyBodyStrength
      })
    );

    // Keep the same hover/disabled state style behavior as the sample.
    series.outerCircles.template.states.create('disabled', {
      fillOpacity: 0.5,
      strokeOpacity: 0,
      strokeDasharray: 0
    });

    series.outerCircles.template.states.create('hoverDisabled', {
      fillOpacity: 0.5,
      strokeOpacity: 0,
      strokeDasharray: 0
    });

    // Node colors and hover state.
    series.circles.template.setAll({
      fill: COLORS.node,
      stroke: COLORS.nodeStroke,
      strokeWidth: 1,
      fillOpacity: 0.95,
      tooltipY: 0
    });
    series.circles.template.states.create('hover', {
      fill: COLORS.nodeHover,
      stroke: COLORS.nodeHoverStroke,
      strokeWidth: 1.4,
      fillOpacity: 1
    });
    series.circles.template.adapters.add('fillOpacity', (current, target) => {
      if (mode !== 'citation' || !focusedClusterId) return current;
      const clusterId = target?.dataItem?.dataContext?.clusterId || null;
      return clusterId === focusedClusterId ? 0.96 : 0.12;
    });
    series.circles.template.adapters.add('fill', (current, target) => {
      if (mode !== 'citation' || !focusPaperId) return current;
      const nodeId = target?.dataItem?.dataContext?.id ? String(target.dataItem.dataContext.id) : '';
      return nodeId && nodeId === String(focusPaperId) ? am5.color(0x111827) : current;
    });
    series.circles.template.adapters.add('strokeOpacity', (current, target) => {
      if (mode !== 'citation' || !focusedClusterId) return current;
      const clusterId = target?.dataItem?.dataContext?.clusterId || null;
      return clusterId === focusedClusterId ? 1 : 0.15;
    });
    series.circles.template.adapters.add('stroke', (current, target) => {
      if (mode !== 'citation' || !focusPaperId) return current;
      const nodeId = target?.dataItem?.dataContext?.id ? String(target.dataItem.dataContext.id) : '';
      return nodeId && nodeId === String(focusPaperId) ? am5.color(0x000000) : current;
    });

    // Link colors and hover state.
    series.links.template.setAll({
      stroke: COLORS.link,
      strokeOpacity: 0.68,
      strokeWidth: 3.2,
      interactive: true
    });
    series.links.template.states.create('hover', {
      stroke: COLORS.linkHover,
      strokeOpacity: 0.95,
      strokeWidth: 4.8
    });
    series.links.template.adapters.add('strokeOpacity', (current, target) => {
      if (mode !== 'citation' || !focusedClusterId) return current;
      const { parentData, childData } = getLinkParentChildData(target);
      const clusterId = childData?.clusterId || parentData?.clusterId || null;
      if (isSyntheticCitationLink(target, mode)) {
        return clusterId === focusedClusterId ? 0.18 : 0.03;
      }
      return clusterId === focusedClusterId ? 0.82 : 0.08;
    });
    series.links.template.adapters.add('strokeWidth', (current, target) => {
      if (mode !== 'citation' || !focusedClusterId) return current;
      const { parentData, childData } = getLinkParentChildData(target);
      const clusterId = childData?.clusterId || parentData?.clusterId || null;
      return clusterId === focusedClusterId ? 3.8 : 1.6;
    });
    series.links.template.events.on('pointerover', (ev) => {
      const target = ev.target;
      if (isSyntheticCitationLink(target, mode)) {
        target.set('cursorOverStyle', 'default');
        setEdgeTooltip(null);
        return;
      }
      const lines = buildEdgeTooltipLines(target, mode);
      target.set('cursorOverStyle', 'pointer');
      target.states.applyAnimate('hover');
      if (!lines || lines.length === 0) {
        setEdgeTooltip(null);
        return;
      }
      const position = resolvePointerPosition(ev, viewportRef.current);
      setEdgeTooltip({
        x: position.x,
        y: position.y,
        lines
      });
    });
    series.links.template.events.on('pointermove', (ev) => {
      const target = ev.target;
      if (isSyntheticCitationLink(target, mode)) {
        setEdgeTooltip(null);
        return;
      }
      const position = resolvePointerPosition(ev, viewportRef.current);
      setEdgeTooltip((previous) => {
        if (!previous) return previous;
        const lines = buildEdgeTooltipLines(target, mode);
        if (!lines || lines.length === 0) return null;
        return {
          x: position.x,
          y: position.y,
          lines
        };
      });
    });
    series.links.template.events.on('pointerout', (ev) => {
      const target = ev.target;
      target.states.applyAnimate('default');
      setEdgeTooltip(null);
    });

    // Label styling and depth-based visibility.
    series.labels.template.setAll({
      fill: COLORS.label,
      fontSize: 11,
      fontFamily: 'Consolas, monospace',
      oversizedBehavior: 'truncate',
      maxWidth: 180
    });
    series.labels.template.adapters.add('forceHidden', (hidden, target) => {
      const depth = target?.dataItem?.get('depth');
      if (typeof depth !== 'number') return hidden;
      return depth > TREE_CONFIG.maxLabelDepth;
    });
    series.labels.template.adapters.add('fill', (current, target) => {
      if (mode !== 'citation' || !focusPaperId) return current;
      const nodeId = target?.dataItem?.dataContext?.id ? String(target.dataItem.dataContext.id) : '';
      return nodeId && nodeId === String(focusPaperId) ? am5.color(0xffffff) : current;
    });
    series.labels.template.adapters.add('fillOpacity', (current, target) => {
      if (mode !== 'citation' || !focusedClusterId) return current;
      const clusterId = target?.dataItem?.dataContext?.clusterId || null;
      return clusterId === focusedClusterId ? 1 : 0.22;
    });

    // Preserve full title context on hover.
    series.nodes.template.adapters.add('tooltipText', (_value, target) => {
      const fullTitle = target?.dataItem?.dataContext?.fullTitle || target?.dataItem?.dataContext?.name || 'Untitled';
      const year = target?.dataItem?.dataContext?.year;
      const value = target?.dataItem?.dataContext?.value || 0;
      return `${formatPaperWithYear(fullTitle, year)}\nCitations: ${value}`;
    });

    series.data.setAll([chartData]);
    if (series.dataItems.length > 0) {
      series.set('selectedDataItem', series.dataItems[0]);
    }
    series.events.on('datavalidated', () => {
      series.links.each((link) => {
        if (isSyntheticCitationLink(link, mode)) {
          link.setAll({
            interactive: false,
            strokeOpacity: 0.28,
            strokeDasharray: [4, 4]
          });
        } else {
          link.setAll({
            interactive: true,
            strokeOpacity: 0.68,
            strokeDasharray: []
          });
        }
      });
    });

    series.appear(1000, 100);

    return () => {
      setEdgeTooltip(null);
      contentContainerRef.current = null;
      root.dispose();
    };
  }, [chartData, mode, clusterCenterStrength, clusterManyBodyStrength, focusedClusterId, focusPaperId]);

  const controlButtonStyle = {
    width: 30,
    height: 30,
    border: '1px solid rgba(15, 23, 42, 0.3)',
    borderRadius: 6,
    background: '#ffffff',
    color: '#111827',
    fontSize: 16,
    lineHeight: '1',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer'
  };

  return (
    <div
      ref={viewportRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        cursor: isPanning ? 'grabbing' : 'default',
        backgroundColor: '#ffffff'
      }}
      onMouseDown={handleMouseDown}
      onAuxClick={handleAuxClick}
    >
      <div
        ref={chartRef}
        style={{
          width: '140%',
          height: '140%',
          position: 'absolute',
          left: '-20%',
          top: '-20%'
        }}
      />
      {edgeTooltip ? (
        <div
          style={{
            position: 'absolute',
            left: edgeTooltip.x + 12,
            top: edgeTooltip.y + 12,
            zIndex: 20,
            pointerEvents: 'none',
            maxWidth: 420,
            background: 'rgba(15, 23, 42, 0.95)',
            color: '#e2e8f0',
            border: '1px solid rgba(148, 163, 184, 0.45)',
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(15, 23, 42, 0.35)',
            padding: '8px 10px',
            fontSize: 12,
            lineHeight: 1.4,
            fontFamily: 'Consolas, monospace'
          }}
        >
          {edgeTooltip.lines.map((line, index) => (
            <div key={`${index}-${line}`}>{line}</div>
          ))}
        </div>
      ) : null}
      <div
        style={{
          position: 'absolute',
          right: 10,
          bottom: 8,
          zIndex: 24,
          display: 'flex',
          gap: 6,
          alignItems: 'center',
        }}
      >
        <button
          type="button"
          onClick={zoomOut}
          title="Zoom out"
          style={controlButtonStyle}
        >
          −
        </button>
        <button
          type="button"
          onClick={zoomIn}
          title="Zoom in"
          style={controlButtonStyle}
        >
          +
        </button>
        <button
          type="button"
          onClick={toggleFullscreen}
          title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          style={controlButtonStyle}
        >
          {isFullscreen ? '🡼' : '⛶'}
        </button>
      </div>
    </div>
  );
}

export default PaperForceGraph;
