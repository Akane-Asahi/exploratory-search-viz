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

function AuthorBarChart({ rawData, selectAuthor ,updateData}) {
  const containerRef = useRef();
  const svgRef = useRef();
  const selectAuthorRef = useRef(selectAuthor);

  useEffect(() => {
    selectAuthorRef.current = selectAuthor;
  }, [selectAuthor]);

  useEffect(() => {
    if (!rawData || !Array.isArray(rawData) || rawData.length === 0) return;

    const marginTop = 50;
    const marginRight = 60; 
    const marginBottom = 100;
    const marginLeft = 60;
    
   
    const height = containerRef.current.clientHeight;

    const citeColour = "#A8E6A3";
    const countColour = "steelblue"

    const flatData = rawData
      .map(d => ({
        count: d.count,
        cites: d.citations, 
        name: d._id,
        
      }))
      .sort((b, a) => a.count - b.count)
      .slice(0, 25);

    const width = flatData.length * 75 + marginLeft + marginRight;
    
    const x = d3.scaleBand()
      .domain(flatData.map(d => d.name))
      .range([marginLeft, width - marginRight])
      .padding(0.2);

    
    const xSub = d3.scaleBand()
      .domain(['count', 'cites'])
      .range([0, x.bandwidth()])
      .padding(0.1);

    
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
    
    const texttoolCount = svg.append("text")
      .style("opacity", 0)
      .attr("font-size", "9px")
      .attr("fill", countColour);
    
    svg.append("g")
      .attr("fill", countColour)
      .selectAll("rect")
      .data(flatData)
      .join("rect")
      .attr("x", d => x(d.name) + xSub('count'))
      .attr("y", d => y(d.count))
      .attr("width", xSub.bandwidth())
      .attr("height", d => y(0) - y(d.count))
      .on("mouseover", function (event,d) {
        d3.select(this)
          .style("stroke", countColour)
          .style("stroke-width", "5px")
          .style("opacity", .5);
        texttoolCount
          .style("opacity", 1)
          .attr("x", x(d.name) + xSub('count')  +5) 
          .attr("y", y(d.count) -4)
          .text(formatCites(d.count));

      })

      .on("mouseout", function () {
        d3.select(this)
          .style("opacity", 1)
          .style("stroke", "none");
        texttoolCount.style("opacity", 0);
    }).on("click", async (event,d) =>{
        await updateData();
        selectAuthorRef.current({name: d.name});
        

      });

    const texttoolCites = svg.append("text")
      .style("opacity", 0)
      .attr("font-size", "9px")
      .attr("fill", citeColour);

    svg.append("g")
      .attr("fill", citeColour)
      .selectAll("rect")
      .data(flatData)
      .join("rect")
      .attr("x", d => x(d.name) + xSub('cites'))
      .attr("y", d => yr(d.cites))       
      .attr("width", xSub.bandwidth())
      .attr("height", d => yr(0) - yr(d.cites))
      .on("mouseover", function (event,d) {
        d3.select(this)
          .style("stroke", citeColour)
          .style("stroke-width", "5px")
          .style("opacity", .5);
        texttoolCites
          .style("opacity", 1)
          .attr("x", x(d.name) + xSub('cites') ) 
          .attr("y", yr(d.cites) -4)
          .text(formatCites(d.cites));

      })

      .on("mouseout", function () {
      d3.select(this)
        .style("opacity", 1)
        .style("stroke", "none");
      texttoolCites.style("opacity", 0);
    }).on("click", async (event,d) =>{
        await updateData();
        selectAuthorRef.current({name: d.name});
      });

    
    

    


    
    svg.append("g")
      .attr("transform", `translate(0,${height - marginBottom})`)
      .call(d3.axisBottom(x).tickSizeOuter(0))
      .selectAll("text")
      .attr("transform", "rotate(-35)")
      .style("text-anchor", "end")
      .style("cursor", "pointer")
      .style("color","blue")
      .style("font-size", "12px")
      .call(wrapText, 90)
      
      .on("click", async (event,d) =>{
        await updateData();
        selectAuthorRef.current({name: d});
      });

    
    svg.append("g")
      .attr("transform", `translate(${marginLeft},0)`)
      .call(d3.axisLeft(y).ticks(height / 40))
      .call(g => g.select(".domain").remove())
      .call(g => g.selectAll(".tick line").clone()
        .attr("x2", width - marginLeft - marginRight)
        .attr("stroke-opacity", 0.1))
      .call(g => g.append("text")
      .attr("transform", "rotate(-90)")  
      .attr("x", -height / 2)            
      .attr("y", -marginLeft + 10)       
      .attr("fill", "currentColor")
      .attr("text-anchor", "middle")
      .attr("font-size", "12px")
      .text("Paper Count"));
      

    svg.append("g")
      .attr("transform", `translate(${width - marginRight},0)`)
      .call(d3.axisRight(yr).ticks(height / 40))
      .call(g => g.select(".domain").remove())
      .call(g => g.append("text")
        .attr("transform", "rotate(-90)")  
        .attr("x", -height/2)            
        .attr("y", 50)       
        .attr("fill", "currentColor")
        .attr("text-anchor", "middle")
        .attr("font-size", "12px")
        .text("Citation Count"));

   
    const legend = svg.append("g")
      .attr("transform", `translate(${marginLeft + 10}, 0)`);

    legend.append("rect").attr("width", 12).attr("height", 12).attr("fill", countColour);
    legend.append("text").attr("x", 16).attr("y", 10).attr("font-size", "10px").text("Paper Count");

    legend.append("rect").attr("x", 100).attr("width", 12).attr("height", 12).attr("fill", citeColour);
    legend.append("text").attr("x", 116).attr("y", 10).attr("font-size", "10px").text("Citations");

  }, [rawData,selectAuthor]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
      <svg ref={svgRef}></svg>
    </div>
  );
}

export default AuthorBarChart;