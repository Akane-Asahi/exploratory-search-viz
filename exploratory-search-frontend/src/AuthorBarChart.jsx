import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';

function AuthorBarChart({ rawData }) {
  const containerRef = useRef();
  const svgRef = useRef();

  useEffect(() => {
    if (!rawData || !Array.isArray(rawData) || rawData.length === 0) return;

    const marginTop = 50;
    const marginRight = 60; 
    const marginBottom = 80;
    const marginLeft = 40;
    const width = 928;
    const height = 350;

    const flatData = rawData
      .map(d => ({
        count: d.count,
        cites: d.citations, 
        name: d._id
      }))
      .sort((b, a) => a.count - b.count)
      .slice(0, 15);

    // ✅ Use scaleBand with two sub-bands for grouped bars
    const x = d3.scaleBand()
      .domain(flatData.map(d => d.name))
      .range([marginLeft, width - marginRight])
      .padding(0.2);

    // ✅ Sub-band for the two bars inside each group
    const xSub = d3.scaleBand()
      .domain(['count', 'cites'])
      .range([0, x.bandwidth()])
      .padding(0.05);

    
    const y = d3.scaleLinear()
      .domain([0, d3.max(flatData, d => d.count)])
      .range([height - marginBottom, marginTop]);

  
    const yr = d3.scaleLinear()
      .domain([0, d3.max(flatData, d => d.cites)])
      .range([height - marginBottom, marginTop]);

    const formatCount = d3.format("d");
    const formatCites = d3.format(",");

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width", width)
      .attr("height", height)
      .attr("viewBox", [0, 0, width, height])
      .attr("style", "max-width: 100%; height: auto; font: 10px sans-serif;");

   
    svg.append("g")
      .attr("fill", "steelblue")
      .selectAll("rect")
      .data(flatData)
      .join("rect")
      .attr("x", d => x(d.name) + xSub('count'))
      .attr("y", d => y(d.count))
      .attr("width", xSub.bandwidth())
      .attr("height", d => y(0) - y(d.count));

   
    svg.append("g")
      .attr("fill", "red")
      .selectAll("rect")
      .data(flatData)
      .join("rect")
      .attr("x", d => x(d.name) + xSub('cites'))
      .attr("y", d => yr(d.cites))       
      .attr("width", xSub.bandwidth())
      .attr("height", d => yr(0) - yr(d.cites)); 

    
    svg.append("g")
      .attr("text-anchor", "middle")
      .selectAll("text")
      .data(flatData)
      .join("text")
      .attr("x", d => x(d.name) + xSub('count') + xSub.bandwidth() / 2)
      .attr("y", d => y(d.count) - 4)
      .attr("font-size", "9px")
      .attr("fill", "steelblue")
      .text(d => formatCount(d.count));

    
    svg.append("g")
      .attr("text-anchor", "start")
      .selectAll("text")
      .data(flatData)
      .join("text")
      .attr("x", d => x(d.name) + xSub('cites') + xSub.bandwidth() + 2) 
      .attr("y", d => yr(d.cites) + 4)
      .attr("font-size", "9px")
      .attr("fill", "coral")
      .text(d => formatCites(d.cites));

    // X axis
    svg.append("g")
      .attr("transform", `translate(0,${height - marginBottom})`)
      .call(d3.axisBottom(x).tickSizeOuter(0))
      .selectAll("text")
      .attr("transform", "rotate(-35)")
      .style("text-anchor", "end");

    // Left Y axis (count)
    svg.append("g")
      .attr("transform", `translate(${marginLeft},0)`)
      .call(d3.axisLeft(y).ticks(height / 40))
      .call(g => g.select(".domain").remove())
      .call(g => g.selectAll(".tick line").clone()
        .attr("x2", width - marginLeft - marginRight)
        .attr("stroke-opacity", 0.1));

    svg.append("g")
      .attr("transform", `translate(${width - marginRight},0)`)
      .call(d3.axisRight(yr).ticks(height / 40))
      .call(g => g.select(".domain").remove());

   
    const legend = svg.append("g")
      .attr("transform", `translate(${marginLeft + 10}, 0)`);

    legend.append("rect").attr("width", 12).attr("height", 12).attr("fill", "steelblue");
    legend.append("text").attr("x", 16).attr("y", 10).attr("font-size", "10px").text("Paper Count");

    legend.append("rect").attr("x", 100).attr("width", 12).attr("height", 12).attr("fill", "red");
    legend.append("text").attr("x", 116).attr("y", 10).attr("font-size", "10px").text("Citations");

  }, [rawData]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
      <svg ref={svgRef}></svg>
    </div>
  );
}

export default AuthorBarChart;