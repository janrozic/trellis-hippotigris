import * as d3 from "d3";
import { font, margin, size } from "./src/constants";
import { getTextWidth, noop, parseNumber } from "./src/helpers";
import dataString from "./src/multiples.csv?raw";

/***** DATA *****/

const data = d3.csvParse(dataString);

// const data: d3.DSVRowArray = [
//   {a: "1", b: "1", c: "1",},
//   {a: "2", c: "2",},
//   {a: "3", b: "3",},
// ] as any;
// data.columns = ["a", "b", "c"];

const numberKey = data.columns[0];
const property1 = data.columns[1];
const property2 = data.columns[2];
const parseNumberKeySafe = (d: (typeof data)[number]) => parseNumber(d[numberKey]) || 0;

const by1 = d3.group(data, d => d[property1]);
const by2 = d3.group(data, d => d[property2]);

const getAggregate = (property: string, aggregate: "min" | "max" | "sum") =>
  d3.rollup(data, v => d3[aggregate as "max"](v, d => parseNumber(d[numberKey]) || 0), d => d[property])
;

const by2Maxes = getAggregate(property2, "max");
const movingMaxSum = Array.from(by2Maxes.values()).reduce<number[]>((acc, val) => [...acc, acc[acc.length - 1] + val], [0]);
const maxBy2Sum = movingMaxSum.pop();

const yScale = d3
  .scaleBand<string>()
  .domain(by1.keys())
  .range([margin.top, size.height - margin.bottom])
  .padding(0.4)
  .round(true)  // discrete values
;

const maxTextWidth = (map: typeof by1) => d3.max(Array.from(map.keys(), getTextWidth));
const leftPadding = Math.max(maxTextWidth(by1), maxTextWidth(by2));

const xPositions = Object.fromEntries(Array.from(by2.keys(), (k, i) => [k, movingMaxSum[i]]));

const xScale = d3
  .scaleLinear<number>()
  .range([0, size.width - margin.right - margin.left - leftPadding])
  .domain([0, maxBy2Sum])
;

/****** RENDER ******/


// base SVG
const svg = d3.select("body")
  .append("svg")
  .attr("viewBox", `0 ${margin.top} ${size.width} ${size.height - margin.top}`)
  .style("max-width", `${size.width}px`)
  // .attr("width", width)
  // .attr("height", height)
  .attr("background", "red")
;
const holder = svg.append("g");

// left axis

svg.append("g")
  .attr("transform", `translate(${margin.left + leftPadding}, 0)`)
  .style("font", `${font.face} ${font.size}px`)
  .call(d3.axisLeft(yScale))
  .selectAll("path.domain, line")
  .remove()
;

// top axis

// const group = holder
//   .selectAll("g.set")
//   .data(by1)
//   .join("g")
//   .attr("class", "set")
  // .attr("transform", (a) => `translate(${xScale(a)}, 0)`)
;
holder.selectAll("rect")
  .data(data)
  .join("rect")
  .attr("fill", "blue")
  // .attr("width", (a) => {console.log("width", parseNumberKeySafe(a), xScale(parseNumberKeySafe(a))); return xScale(parseNumberKeySafe(a));})
  .attr("width", (a) => xScale(parseNumberKeySafe(a)))
  .attr("height", yScale.bandwidth())
  // .attr("x", (_, i) => {console.log("move", movingMaxSum[i], xScale(movingMaxSum[i])); return xScale(movingMaxSum[i])})
  .attr("x", (a) => leftPadding + margin.left + xScale(xPositions[a[property2]]))
  // .attr("x", (_, i) => leftPadding + margin.left + xScale(movingMaxSum[i]))
  .attr("y", (a) => yScale(a[property1]))
  // .attr("transform", (a) => {console.log("as", a); return `translate(${xScale(2)}, 0)`;})
  // .attr
;

const table = d3.select("body")
.append("table").attr("border", 1);
const thead = table.append("thead").append("tr");
const tbody = table.append("tbody");
thead.selectAll("th").data(data.columns).join("th").text(String);
tbody.selectAll("tr").data(data).join("tr").selectAll("td").data((row: any) => data.columns.map((c) => row[c])).join("td").text(String)