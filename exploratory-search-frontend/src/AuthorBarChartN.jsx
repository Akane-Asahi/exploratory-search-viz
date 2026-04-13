import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';

function wrapText(text, width) {
  text.each(function () {
    const textSel = d3.select(this);
    const words = textSel.text().split(/\s+/).reverse();
    let word;
    let line = [];
    let lineNumber = 0;
    const lineHeight = 1.1; // ems
    const y = textSel.attr("y");
    const dy = 0;

    let tspan = textSel.text(null)
      .append("tspan")
      .attr("x", -10) // adjust for axis alignment
      .attr("y", y)
      .attr("dy", dy + "em");

    while (word = words.pop()) {
      line.push(word);
      tspan.text(line.join(" "));
      if (tspan.node().getComputedTextLength() > width) {
        line.pop();
        tspan.text(line.join(" "));
        line = [word];
        tspan = textSel.append("tspan")
          .attr("x", -10)
          .attr("y", y)
          .attr("dy", ++lineNumber * lineHeight + dy + "em")
          .text(word);
      }
    }
  });
}

function AuthorBarChart({ rawData ,selectAuthor}) {
  const containerRef = useRef();
  const svgRef = useRef();
  const axisRefBot = useRef();
  const axisRefTop = useRef();
  const axisRefLegend = useRef();
  const selectAuthorRef = useRef(selectAuthor);
  
  const container = document.getElementById("chart-container");
  const width = container.clientWidth - 25;
  useEffect(() => {
    selectAuthorRef.current = selectAuthor;
  }, [selectAuthor]);

  useEffect(() => {
    if (!rawData || !Array.isArray(rawData) || rawData.length === 0) return;
    if (!containerRef.current) return;

    const marginTop = 5;
    const marginRight = 60; 
    const marginBottom = 5;
    const marginLeft = 140;
    const width = containerRef.current.clientWidth;
    

    const citeColour = "#A8E6A3";
    const countColour = "steelblue"

    const flatData = rawData
      .map(d => ({
        count: d.count,
        cites: d.citations, 
        name: d._id,
       
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);
    
    const height = flatData.length * 50 + marginTop + marginBottom;
    
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
      .attr("style", "max-width: 100%; height: auto;  overflow: visible; font: 10px sans-serif;");

    const texttoolCount = svg.append("text")
      .style("opacity", 0)
      .attr("font-size", "12px")
      .style("pointer-events", "none")
      .attr("fill", countColour);

    svg.append("g")
      .attr("fill", countColour)
      .selectAll("rect")
      .data(flatData)
      .join("rect")
      .attr("y", d => y(d.name) + ySub('count'))
      .attr("x", x(0))
      .attr("rx", 5)
      .attr("ry", 5)
      .attr("height", ySub.bandwidth())
      .attr("width", d =>  x(d.count)-x(0))
      .on("mouseover", function (event,d) { 
        d3.select(this)
          .style("stroke", countColour)
          .style("stroke-width", "5px")
          .style("opacity", .5);
        texttoolCount
          .style("opacity", 1)
          .attr("y", y(d.name) + ySub('count')  +12) 
          .attr("x", x(d.count) +5)
          .text(formatCites(d.count));

      })

      .on("mouseout", function () {
        d3.select(this)
          .style("opacity", 1)
          .style("stroke", "none");
        texttoolCount.style("opacity", 0);
    }).on("click", (event,d) =>{
        selectAuthorRef.current({name: d.name});
        

      });

    const texttoolCites = svg.append("text")
      .style("opacity", 0)
      .attr("font-size", "12px")
      .style("pointer-events", "none")
      .attr("fill", citeColour);

    svg.append("g")
      .attr("fill", citeColour)
      .selectAll("rect")
      .data(flatData)
      .join("rect")
      .attr("y", d => y(d.name) + ySub('cites'))
      .attr("x", xr(0))
      .attr("rx", 5)
      .attr("ry", 5)
      .attr("height", ySub.bandwidth())
      .attr("width", d => xr(d.cites)-xr(0))
      .on("mouseover", function (event,d) { 
        d3.select(this)
          .style("stroke", citeColour)
          .style("stroke-width", "5px")
          .style("opacity", .5);
        texttoolCites
          .style("opacity", 1)
          .attr("y", y(d.name) + ySub('cites')  +12) 
          .attr("x", xr(d.cites) +5)
          .text(formatCites(d.cites));

      })

      .on("mouseout", function () {
        d3.select(this)
          .style("opacity", 1)
          .style("stroke", "none");
        texttoolCites.style("opacity", 0);
    }).on("click", (event,d) =>{
        selectAuthorRef.current({name: d.name});
      }); 


    

    

    
    svg.append("g")
      .attr("transform", `translate(${marginLeft},0)`)
      .call(d3.axisLeft(y).tickSizeOuter(0))
      .style("font-size", "12px")
      .selectAll(".tick text")
      .call(wrapText, 90)
      .on("click", (event,d) =>{
        selectAuthorRef.current({name: d});
      });

   

   
    
   
    const axisBot = d3.select(axisRefBot.current);

    axisBot.selectAll("*").remove();

    axisBot
    .call(d3.axisBottom(x).ticks(5))
    .call(g => g.select(".domain").remove())
      
      .call(g => g.append("text")
        .attr("x", (width - marginLeft - marginRight) / 2 + marginLeft)
        .attr("y", 30 )
        .attr("fill", "currentColor")
        .attr("text-anchor", "middle")
        .attr("font-size", "12px")
        .text("Paper Count"));

    const axisTop = d3.select(axisRefTop.current);

    axisTop.selectAll("*").remove();
    axisTop.attr("transform", "translate(0,40)")
      .call(d3.axisTop(xr).ticks(5))
      .call(g => g.select(".domain").remove())
      
      .call(g => g.append("text")
        .attr("x", (width - marginLeft - marginRight) / 2 + marginLeft)
        .attr("y", -20) 
        .attr("fill", "currentColor")
        .attr("text-anchor", "middle")
        .attr("font-size", "12px")
        .text("Citations")
        );
   

    const axisLegend = d3.select(axisRefLegend.current);

    axisLegend.selectAll("*").remove();
    const legend = axisLegend.append("g")
        .attr("transform", "translate(200,0)");

    legend.append("rect")
    .attr("width", 12)
    .attr("height", 12)
    .attr("fill", countColour);

    legend.append("text")
    .attr("x", 16)
    .attr("y", 10)
    .attr("font-size", "11px")
    .attr("fill", "black")
    .text("Paper Count");

    legend.append("rect")
    .attr("x", 100)
    .attr("width", 12)
    .attr("height", 12)
    .attr("fill", citeColour);

    legend.append("text")
    .attr("x", 116)
    .attr("y", 10)
    .attr("font-size", "12px")
    .attr("fill", "black")
    .text("Citations");
   
    
  }, [rawData]);

  return (
    <div ref={containerRef} style={{ position: "relative", height: "350px" }}>
        
      
        <svg
        style={{
            position: "sticky",
            top: 0,
            zIndex: 10,
            background: "white"
        }}
        
        height={20}
        width = {width}
        >
        <g ref={axisRefLegend}></g>
        </svg>
        <svg
        style={{
            position: "sticky",
            top: 0,
            zIndex: 10,
            background: "white"
        }}
        
        height={40}
        width = {width}
        >
        <g ref={axisRefTop}></g>
        </svg>
        
        <div style={{ height: "180px", overflowY: "auto", paddingTop: "60px"}}>
        <svg ref={svgRef}></svg>
        </div>
        <svg
        style={{
            position: "sticky",
            top: 0,
            zIndex: 10,
            background: "white"
        }}
        
        height={40}
        width = {width}
        >
        <g ref={axisRefBot}></g>
        </svg>

    </div>
    );
}

export default AuthorBarChart;