import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';

function BarGraph({ rawData }) {
  const containerRef = useRef();
  const svgRef = useRef();

  useEffect(() => {
    if (!rawData || !Array.isArray(rawData) || rawData.length === 0) return;

    const barHeight = 4;
    const marginTop = 30;
    const marginRight = 120;
    const marginBottom = 10;
    const marginLeft = 200;
    const width = 928;
    const height = Math.ceil(rawData.length * barHeight) + marginTop + marginBottom;

    // Flatten and sort by count ascending (so highest is at top)
    const flatData = rawData
      .map(d => ({
        count: d.count,
        concept: d._id
      }))
      .sort((b, a ) => a.count - b.count)
      .slice(0,7);

    const x = d3.scaleLinear()
      .domain([0, d3.max(flatData, d => d.count)])
      .range([marginLeft, width - marginRight]);

    // ✅ Fix 1: use d.concept not d.letter or d.frequency
    const y = d3.scaleBand()
      .domain(flatData.map(d => d.concept))
      .rangeRound([marginTop, height - marginBottom])
      .padding(0.1);

    // ✅ Fix 2: format as a plain number not percentage
    const format = d3.format(",");

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width", width)
      .attr("height", height)
      .attr("viewBox", [0, 0, width, height])
      .attr("style", "max-width: 100%; height: auto; font: 10px sans-serif;");

    // Draw bars
    svg.append("g")
      .attr("fill", "steelblue")
      .selectAll("rect")
      .data(flatData)
      .join("rect")
      .attr("x", x(0))
      .attr("y", d => y(d.concept))       // ✅ Fix 3: use d.concept not d._id
      .attr("width", d => x(d.count) - x(0))
      .attr("height", y.bandwidth());

    // Draw labels
    svg.append("g")
      .attr("fill", "white")
      .attr("text-anchor", "end")
      .selectAll("text")
      .data(flatData)
      .join("text")
      .attr("x", d => x(d.count))
      .attr("y", d => y(d.concept) + y.bandwidth() / 2)  // ✅ Fix 4: use d.concept
      .attr("dy", "0.35em")
      .attr("dx", -4)
      .text(d => format(d.count))
      .call(text => text.filter(d => x(d.count) - x(0) < 20)
        .attr("dx", +4)
        .attr("fill", "black")
        .attr("text-anchor", "start"));

    // X axis
    svg.append("g")
      .attr("transform", `translate(0,${marginTop})`)
      .call(d3.axisTop(x).ticks(width / 80))
      .call(g => g.select(".domain").remove());

    // Y axis
    svg.append("g")
      .attr("transform", `translate(${marginLeft},0)`)
      .call(d3.axisLeft(y).tickSizeOuter(0));

  }, [rawData]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
     
      <svg ref={svgRef}></svg>
    </div>
  );
}

export default BarGraph;