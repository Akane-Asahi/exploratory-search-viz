import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import cloud from 'd3-cloud';

const WordCloud = ({ rawData,selectWord}) => {
  const containerRef = useRef();
  const svgRef = useRef();
  const selectWordRef = useRef(selectWord);

  useEffect(() => {
    if (!rawData || !Array.isArray(rawData) || rawData.length === 0) return;

    const container = containerRef.current;
    const width = container.clientWidth || 928;
    const height = 350;
    const fontFamily = "sans-serif";
    const fontScale = 3.5;
    const padding = 3;
    const rotate = 0;

    const flatData = rawData
      .map(d => ({ text: d._id, size: d.count }))
      .sort((a, b) => b.size - a.size)
      .slice(0, 25);

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    svg
      .attr("viewBox", [0, 0, width, height])
      .attr("width", width)
      .attr("height", height)
      .attr("font-family", fontFamily)
      .attr("text-anchor", "middle")
      .attr("style", "max-width: 100%; height: auto;");

    const g = svg.append("g")
      .attr("transform", `translate(${width / 2}, ${height / 2})`);

    cloud()
  .size([width, height])
  .words(flatData)
  .padding(padding)
  .rotate(rotate)
  .font(fontFamily)
  .fontSize(d => Math.sqrt(d.size) * fontScale)
  .on("end", (words) => {

  g.selectAll("text")
    .data(words)
    .join("text")
    .attr("font-size", d => d.size)
    .attr("fill", "steelblue")
    .attr("transform", d =>
      `translate(${d.x}, ${d.y}) rotate(${d.rotate})`
    )
    .text(d => d.text)

    
    .on("mouseover", function () {
      d3.select(this).style("opacity", 0.5);
    })

    .on("mouseout", function () {
      d3.select(this).style("opacity", 1);
    })

    .on("click", (event, d) => {
      selectWordRef.current(d.text);
    });

  }).start();
         

  }, [rawData]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
      <svg ref={svgRef}></svg>
    </div>
  );
};

export default WordCloud;