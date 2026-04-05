import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';

function AuthorChartSingle({ rawData }) {
  const containerRef = useRef();
  const svgRef = useRef();

  useEffect(() => {
    if (!rawData || !Array.isArray(rawData) || rawData.length === 0) return;

    const marginTop = 50;
    const marginRight = 60; 
    const marginBottom = 80;
    const marginLeft = 100;
    const width = 928;
    const height = 350;

    const flatData = rawData
      .map(d => ({
        count: d.count,
        cites: d.citations, 
        name: d._id
      }))
      .sort((a, b) => a.count - b.count)
      .slice(0, 15);

    
    const y = d3.scaleBand()
      .domain(flatData.map(d => d.name))
      .range([marginTop, height - marginBottom])
      .padding(0.2);

  
    const ySub = d3.scaleBand()
      .domain(['count', 'cites'])
      .range([0, y.bandwidth()])
      .padding(0.05);

    
    const x = d3.scaleLinear()
      .domain([0, d3.max(flatData, d => d.count)])
      .range([marginLeft, width - marginRight]);

  
    const xr = d3.scaleLinear()
      .domain([0, d3.max(flatData, d => d.cites)])
      .range([marginLeft, width - marginRight]);

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
      .attr("y", d => y(d.name) + ySub('count'))
      .attr("x", marginLeft)
      .attr("height", ySub.bandwidth())
      .attr("width", d => x(d.count) - marginLeft);

   
    svg.append("g")
      .attr("fill", "red")
      .selectAll("rect")
      .data(flatData)
      .join("rect")
      .attr("y", d => y(d.name) + ySub('cites'))
      .attr("x", marginLeft)
      .attr("height", ySub.bandwidth())
      .attr("width", d => xr(d.cites) - marginLeft); 

    
    svg.append("g")
      .attr("text-anchor", "middle")
      .selectAll("text")
      .data(flatData)
      .join("text")
      .attr("y", d => y(d.name) + ySub('count') + ySub.bandwidth() / 2)
      .attr("x", d => x(d.count) + 4)
      .attr("font-size", "9px")
      .attr("fill", "steelblue")
      .text(d => formatCount(d.count));

    
    svg.append("g")
      .attr("text-anchor", "start")
      .selectAll("text")
      .data(flatData)
      .join("text")
      .attr("y", d => y(d.name) + ySub('cites') + ySub.bandwidth() + 2) 
      .attr("x", d => xr(d.cites) + 4)
      .attr("font-size", "9px")
      .attr("fill", "coral")
      .text(d => formatCites(d.cites));
    
    svg.append("g")
      .attr("transform", `translate(${marginLeft},0)`)
      .call(d3.axisLeft(y).tickSizeOuter(0));

    svg.append("g")
      .attr("transform", `translate(0,${height - marginBottom})`)
      .call(d3.axisBottom(x).ticks(5))
      .call(g => g.select(".domain").remove());

    svg.append("g")
      .attr("transform", `translate(0,${marginTop})`)
      .call(d3.axisTop(xr).ticks(5))
      .call(g => g.select(".domain").remove());

    
   
      

    svg.append("g")
      .attr("transform", `translate(${marginTop},0)`)
      .call(d3.axisTop(xr).ticks(height / 40))
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

export default AuthorChartSingle;