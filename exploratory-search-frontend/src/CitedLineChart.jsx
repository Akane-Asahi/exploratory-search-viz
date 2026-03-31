import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';

function CitedLineChart({ rawData }) {
  const containerRef = useRef();
  const svgRef = useRef();

  useEffect(() => {
    if (!rawData || !Array.isArray(rawData) || rawData.length === 0) return;

    
    const marginTop = 30;
    const marginRight = 120;
    const marginBottom = 40;
    const marginLeft = 200;
    const width = 928;
    const height = 300;

    // Flatten and sort by count ascending (so highest is at top)
    const flatData = rawData
      .map(d => ({
        count: d.count,
        year: d.year
      }))
      .sort((a, b) => a.year - b.year)
      .slice(0,7);

    const x = d3.scaleLinear()
      .domain([d3.min(flatData, d => d.year), d3.max(flatData, d => d.year)])
      .range([marginLeft, width - marginRight]);

    
    const y = d3.scaleLinear()
      .domain([ d3.max(flatData, d => d.count),0])
      .range([height - marginBottom, marginTop])
      

    const line = d3.line()
      .x(d => x(d.year))
      .y(d => y(d.count));
    const format = d3.format(",");

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width", width)
      .attr("height", height)
      .attr("viewBox", [0, 0, width, height])
      .attr("style", "max-width: 100%; height: auto; font: 10px sans-serif;");

    svg.append("g")
      .attr("transform", `translate(0,${height - marginBottom})`)
      .call(d3.axisBottom(x)
      .ticks(flatData.length)
      .tickFormat(d3.format("d")) 
      .tickSizeOuter(0));

  
    svg.append("g")
      .attr("transform", `translate(${marginLeft},0)`)
      .call(d3.axisLeft(y).ticks(height / 40))
      .call(g => g.select(".domain").remove())
      .call(g => g.selectAll(".tick line").clone()
          .attr("x2", width - marginLeft - marginRight)
          .attr("stroke-opacity", 0.1));
      


    svg.append("path")
      .attr("fill", "none")
      .attr("stroke", "steelblue")
      .attr("stroke-width", 1.5)
      .attr("d", line(flatData));
    }, [rawData]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
     
      <svg ref={svgRef}></svg>
    </div>
  );
}

export default CitedLineChart;