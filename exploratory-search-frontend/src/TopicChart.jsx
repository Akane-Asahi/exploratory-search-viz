import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';

const TopicChart = ({ rawData }) => {
  const containerRef = useRef();
  const svgRef = useRef();

  useEffect(() => {
    if (!rawData || !rawData.data || rawData.data.length === 0) return;

    const { data } = rawData;

    const container = containerRef.current;
    const width = container.clientWidth || 928;
    const height = 230;
    const marginTop = 20;
    const marginRight = 20;
    const marginBottom = 30;
    const marginLeft = 30;

    // Flatten data into [{date, count, concept}, ...] with Date objects, sorted by date
    const flatData = data
      .map(d => ({
        date: new Date(d.year, 0, 1),
        count: d.count,
        concept: d.concept
      }))
      .sort((a, b) => a.date - b.date);

    // Positional scales
    const x = d3.scaleUtc()
      .domain(d3.extent(flatData, d => d.date))
      .range([marginLeft, width - marginRight]);

    const y = d3.scaleLinear()
      .domain([0, d3.max(flatData, d => d.count)]).nice()
      .range([height - marginBottom, marginTop]);

    // Clear and set up SVG
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [0, 0, width, height])
      .attr("style", "max-width: 100%; height: auto; overflow: visible; font: 8px Inter, sans-serif;");

    // X axis
    svg.append("g")
      .attr("transform", `translate(0,${height - marginBottom})`)
      .call(d3.axisBottom(x).ticks(width / 80).tickSizeOuter(0))
      .call(g => g.select(".domain").attr("stroke", "#d1d5db"))
      .call(g => g.selectAll("line,text").attr("stroke", "#9ca3af").attr("fill", "#6b7280"));

    // Y axis
    svg.append("g")
      .attr("transform", `translate(${marginLeft},0)`)
      .call(d3.axisLeft(y))
      .call(g => g.select(".domain").remove())
      .call(g => g.selectAll(".tick line").clone()
        .attr("x2", width - marginLeft - marginRight)
        .attr("stroke", "#e5e7eb")
        .attr("stroke-opacity", 1))
      .call(g => g.selectAll("text").attr("fill", "#6b7280").style("font-size", "8px"));

    // Compute points as [x, y, z] where z is concept name
    const points = flatData.map(d => [x(d.date), y(d.count), d.concept]);

    // Group points by concept
    const groups = d3.rollup(points, v => Object.assign(v, { z: v[0][2] }), d => d[2]);

    // Draw lines
    const line = d3.line();
    const path = svg.append("g")
      .attr("fill", "none")
      .attr("stroke", "#2563eb")
      .attr("stroke-width", 1.5)
      .attr("stroke-linejoin", "round")
      .attr("stroke-linecap", "round")
      .selectAll("path")
      .data(groups.values())
      .join("path")
      .style("mix-blend-mode", "multiply")
      .attr("d", line);

    // Interactive dot + label
    const dot = svg.append("g")
      .attr("display", "none");

    dot.append("circle")
      .attr("r", 3)
      .attr("fill", "#2563eb")
      .attr("stroke", "white")
      .attr("stroke-width", 1.5);

    dot.append("text")
      .attr("text-anchor", "middle")
      .attr("y", -10)
      .attr("fill", "black")
      .attr("font-weight", "bold")
      .attr("font-size", "12px")
      .attr("paint-order", "stroke")
      .attr("stroke", "white")
      .attr("stroke-width", 3);

    svg
      .on("pointerenter", pointerentered)
      .on("pointermove", pointermoved)
      .on("pointerleave", pointerleft)
      .on("touchstart", event => event.preventDefault());

    function pointermoved(event) {
      const [xm, ym] = d3.pointer(event);
      const i = d3.leastIndex(points, ([px, py]) => Math.hypot(px - xm, py - ym));
      const [px, py, k] = points[i];
      path.style("stroke", ({ z }) => z === k ? null : "#ddd").filter(({ z }) => z === k).raise();
      dot.attr("transform", `translate(${px},${py})`);
      dot.select("text").text(k);
    }

    function pointerentered() {
      path.style("mix-blend-mode", null).style("stroke", "#ddd");
      dot.attr("display", null);
    }

    function pointerleft() {
      path.style("mix-blend-mode", "multiply").style("stroke", null);
      dot.attr("display", "none");
    }

  }, [rawData]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
      <svg ref={svgRef}></svg>
    </div>
  );
};

export default TopicChart;
