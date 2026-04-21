import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';

function CitedLineChart({ rawData, type }) {
  const containerRef = useRef();
  const svgRef = useRef();

  useEffect(() => {
    if (!rawData || !Array.isArray(rawData) || rawData.length === 0) return;
    if (!containerRef.current) return;
    let colour;
    let fontColour = "#a8afb9";
    let labelColour = "#c5c8cd;"
    let axisColour = "#939699"
    const height = containerRef.current.clientHeight;
    if (type === "paper"){
      colour = "lightblue";
      
    }else if (type === "author"){
      colour = "coral";
      
    }
    const marginTop = 30;
    const marginRight = 40;
    const marginBottom = 70;
    const marginLeft = 50;
    const width = containerRef.current.clientWidth;
    

    // Flatten and sort by count ascending (so highest is at top)
    const flatData = rawData
      .map(d => ({
        count: d.count,
        year: d.year
      }))
      .sort((a, b) => a.year - b.year)
      .filter((a) => a.year >= 2012 && a.year < 2026);
      
      

    const x = d3.scaleLinear()
      .domain([d3.min(flatData, d => d.year), d3.max(flatData, d => d.year)])
      .range([marginLeft, width - marginRight]);

    
    const y = d3.scaleLinear()
      .domain([0, d3.max(flatData, d => d.count)])
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
      .attr("style", "max-width: 100%; height: auto; font: 25px sans-serif;");

    svg.append("g")
      .attr("transform", `translate(0,${height - marginBottom})`)
      .call(d3.axisBottom(x)
      .ticks(Math.max(flatData.length,10))
      .tickFormat(d3.format("d")) 
      .tickSizeOuter(0))
      .call(g => g.select(".domain")
        .attr("stroke", axisColour))  
      .call(g => g.selectAll(".tick line")
        .attr("stroke", axisColour))
      .call(g => g.selectAll("text")
        .style("font-size", "10px")
        .attr("transform", "rotate(-35)")
        .attr("stroke", fontColour)
        .style("text-anchor", "end")
        .attr("dx", "-0.5em")
        .attr("dy", "0.25em"));
      
      

  
    svg.append("g")
      .attr("transform", `translate(${marginLeft},0)`)
      .call(d3.axisLeft(y).ticks(height / 60))
      .attr("stroke", fontColour)
      .call(g => g.select(".domain").remove())
      .call(g => g.selectAll(".tick line").clone()
          .attr("x2", width - marginLeft - marginRight)
          .attr("stroke-opacity", 0.1))
          .attr("stroke", axisColour)
      .call(g => g.selectAll("text")
          .style("font-size", "8px"))
          .attr("stroke", fontColour);

    svg.append("text")
      .attr("transform", `translate(${marginLeft - 40}, ${height / 2}) rotate(-90)`)
      .attr("text-anchor", "middle")
      .attr("fill", labelColour)
      .attr("font-size", "12px")
      .text("Citations");


      
                
    const texttoolCites = svg.append("text")
      .style("opacity", 0)
      .attr("font-size", "9px")
      .attr("stroke", fontColour)
      .attr("fill", colour);

    

    svg.append("path")
      .attr("fill", "none")
      .attr("stroke", colour)
      .attr("stroke-width", 3)
      .attr("d", line(flatData));
      
    const bisect = d3.bisector(d => d.year).right;


    const tooltip = svg.append("g").style("display", "none");

    tooltip.append("circle")
      .attr("r", 5)
      .attr("fill", colour);

  

    const tooltipText = tooltip.append("text")
      .attr("x", 0)
      .attr("fill", colour)
      .style("font-size", "11px");

 

    tooltipText.append("tspan")
      .attr("class", "tooltip-count")
      .attr("x", 0)
      .attr("dy", "-1em");

    
    svg.append("rect")
      .attr("width", width - marginLeft - marginRight)
      .attr("height", height - marginTop - marginBottom)
      .attr("transform", `translate(${marginLeft}, ${marginTop})`)
      .attr("fill", "none")
      .attr("pointer-events", "all")
      .on("mousemove", (event) => {
        const [mx] = d3.pointer(event);
        const adjustedX = mx - marginLeft;
        const xYear = x.invert(mx);
        
        const index = bisect(flatData, xYear, 1);
        const d0 = flatData[index - 1];
        const d1 = flatData[index] || d0;
        
       
        const d = d1;

        tooltip.style("display", null);
        tooltip.attr("transform", `translate(${x(d.year)}, ${y(d.count)})`);

        
        const flip = x(d.year) > width - 120;
        tooltip.select("rect").attr("x", flip ? -90 : -10);
        tooltipText.selectAll("tspan").attr("x", flip ? -84 : -10);

        
        tooltip.select(".tooltip-count").text(` ${d.count}`);
      })
      .on("mouseleave", () => {
        tooltip.style("display", "none");
      });

    }, [rawData]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
     
      <svg ref={svgRef}></svg>
    </div>
  );
}

export default CitedLineChart;