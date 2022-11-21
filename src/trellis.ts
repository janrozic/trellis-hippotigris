import * as d3 from "d3";
import { font, margin, size, topPadding } from "./constants";
import { getTextWidth, noop, parseNumber, uniqueValues } from "./helpers";
import { Data, Grouped, DataRow, D3Selection } from "./types";

export default class Trellis {

  private data;
  private rootSelector;
  public constructor(data: Data, elementSelector = "body") {
    this.data = data;
    this.rootSelector = elementSelector;
  }

  private grouped: {x: Grouped, yKeys: string[], maxes: Grouped<number>, sorted: DataRow[]};
  private numericProperty: string;
  private xProperty: string;
  private yProperty: string;
  public setAxes = (numericProperty: string, xProperty: string, yProperty: string, order?: "asc" | "desc" | "alpha" | undefined) => {
    this.numericProperty = numericProperty;
    this.xProperty = xProperty;
    this.yProperty = yProperty;
    const sorted = order ? this.getSortedData(order) : this.data;
    const maxes = d3.rollup(sorted, v => d3.max(v, this.getNumericValue), d => d[xProperty]);
    const yKeys = uniqueValues(sorted, yProperty);
    const x = d3.group(sorted, d => d[xProperty]);
    this.grouped = {
      sorted,
      x,
      yKeys,
      maxes,
    };
    this.rerender();
  }

  private getSortedData(order: "asc" | "desc" | "alpha"): DataRow[] {
    let evaluate: (a: DataRow, b: DataRow) => number = (_a, _b) => 0;
    if (order === "alpha") {
      const generateAlphaEvaluate = (property: string): typeof evaluate => (a, b) => d3.ascending(a[property] || "", b[property] || "");
      const alphaX = generateAlphaEvaluate(this.xProperty);
      const alphaY = generateAlphaEvaluate(this.yProperty);
      evaluate = (a, b) => alphaY(a, b) || alphaX(a, b);
    } else if (order === "asc" || order === "desc") {
      const orderFn = d3[order === "asc" ? "ascending" : "descending"];
      const generateNumEvaluate = (property: string): typeof evaluate => {
        const sums = d3.rollup(this.data, a => d3.sum(a.map(this.getNumericValue)), d => d[property]);
        return (a, b) => orderFn(sums.get(a[property]), sums.get(b[property]));
      };
      const numX = generateNumEvaluate(this.xProperty);
      const numY = generateNumEvaluate(this.yProperty);
      evaluate = (a, b) => numX(a, b) || numY(a, b);
      
      // evaluate = (a, b) => d3[order === "asc" ? "ascending" : "descending"](this.getNumericValue(a), this.getNumericValue(b));
    }
    return this.data.slice().sort(evaluate);
  }

  private _root: D3Selection<HTMLDivElement>;
  private _barsHolder: D3Selection<SVGElement>;
  private _axisHolder: D3Selection<SVGElement>;
  private get root() {
    if (!this._root) {
      this.renderScaffold();
    }
    return this._root;
  }
  private get barsHolder() {
    if (!this._barsHolder) {
      this.renderScaffold();
    }
    return this._barsHolder;
  }
  private get axisHolder() {
    if (!this._axisHolder) {
      this.renderScaffold();
    }
    return this._axisHolder;
  }

  private renderScaffold = () => {
    this._root ??= d3.select(this.rootSelector).append("div");

    const svg = this.root
      .append("svg")
      .attr("viewBox", `0 0 ${this.dimensions.width} ${this.dimensions.height}`)
      .style("max-width", `${this.dimensions.width}px`)
    ;
    this._barsHolder = svg.append("g");
    this._axisHolder = this._barsHolder.append("g");
  }

  private getNumericValue = (d: DataRow | string | number): number => {
    if (typeof d === "number") {
      return d;
    }
    const item = typeof d === "string" ? d : d[this.numericProperty];
    return parseNumber(item) || 0;
  }

  private _dimensions: {width: number, height: number};
  private get dimensions() {
    if (!this._dimensions) {
      this._dimensions = {
        ...size,
        height: topPadding + size.element * Math.max(this.grouped.x.size, this.grouped.yKeys.length) + margin.top + margin.bottom,
      };
    }
    return this._dimensions;
  }

  private calculateScales = () => {
    const movingMaxSum = Array.from(this.grouped.maxes.values()).reduce<number[]>((acc, val) => [...acc, acc[acc.length - 1] + val], [0]);
    const maxByXSum = movingMaxSum.pop();
    const xPositions = Object.fromEntries(Array.from(this.grouped.x.keys(),
      (k, index) => [k, {
        index,
        sum: movingMaxSum[index],
      }]
    ));
    const maxTextWidth = (map: Grouped) => d3.max(Array.from(map.keys(), getTextWidth));
    const leftPadding = Math.max(maxTextWidth(this.grouped.x), d3.max(this.grouped.yKeys.map(getTextWidth)));

    const xScale = d3
      .scaleLinear<number>()
      .range([0, this.dimensions.width - margin.right - margin.left - leftPadding - margin.between * (this.grouped.yKeys.length - 1)])
      .domain([0, maxByXSum])
    ;
    const yScale = d3
      .scaleBand<string>()
      .domain(this.grouped.yKeys)
      .range([margin.top + topPadding, this.dimensions.height - margin.bottom - topPadding])
      .padding(0.4)
      .round(true)  // discrete values
    ;
    const allNumeric = this.data.map(this.getNumericValue);
    const maxAll = Math.max(...allNumeric);
    const minAll = Math.min(...allNumeric);

    const colorScale = d3
      .scaleSequential()
      .domain([minAll, maxAll])
      .interpolator(d3.interpolateRgb("#939597", "#6667AB"))
    ;
    const scales = {
      leftPadding,
      xPositions,
      xScale,
      yScale,
      colorScale,
    };
    return scales;
  }
  private _scales: ReturnType<typeof Trellis.prototype.calculateScales>;
  private get scales() {
    if (!this._scales) {
      this._scales = this.calculateScales();
    }
    return this._scales;
  }

  private getLeftOffset = (a: d3.DSVRowString<string> | string) => {
    const key = typeof a === "string" ? a : a[this.xProperty];
    const position = this.scales.xPositions[key];
    return (
      this.scales.leftPadding + margin.left + 
      this.scales.xScale(position.sum) +
      position.index * margin.between
    );
  }

  private renderAxes = () => {
    this.axisHolder.selectChildren().remove();
    const yaxis = this.axisHolder
      .append("g")
      .attr("class", "main")
      .attr("transform", `translate(${margin.left + this.scales.leftPadding}, 0)`)
      // .attr("font-size", font.size)
      // .attr("font-family", font.face)
      .call(d3.axisLeft(this.scales.yScale))
      // .remove()
    ;
    yaxis
      .selectAll("path.domain, line")
      .remove()
    ;
    yaxis
      .selectAll("text")
      .attr("font-size", font.size)
      .attr("font-family", font.face)
    ;
    this.axisHolder
      .selectChildren("line")
      .data(this.grouped.x.keys())
      .join("line")
      .attr("stroke", "black")
      .attr("x1", this.getLeftOffset)
      .attr("x2", this.getLeftOffset)
      .attr("y1", topPadding + margin.top + 15)
      .attr("y2", this.dimensions.height - topPadding - margin.bottom - 15)
    ;
    
    this.axisHolder.selectChildren("text")
      .data(this.grouped.x.keys())
      .join("text")
      .text(noop)
      .attr("font-size", font.size)
      .attr("font-family", font.face)
      .attr("transform", (a) => `translate(${this.getLeftOffset(a)}, ${margin.top + topPadding})`)
    ;
  }

  private render() {
    this.renderAxes();

    this.barsHolder.selectChildren("rect")
      .data(this.data)
      .join(
        (enter) => {
          const rect = enter
            .append("rect")
            .attr("fill", (a) => this.scales.colorScale(this.getNumericValue(a)))
            .attr("width", (a) => this.scales.xScale(this.getNumericValue(a)))
            .attr("height", this.scales.yScale.bandwidth())
            .attr("x", this.getLeftOffset)
            .attr("y", (a) => this.scales.yScale(a[this.yProperty]))
          ;
          rect.append("title").text((a) => a[this.numericProperty]);
          return rect;
        },
        (update) => update
          .transition()
          .duration(1000)
          .attr("fill", (a) => this.scales.colorScale(this.getNumericValue(a)))
          .attr("width", (a) => this.scales.xScale(this.getNumericValue(a)))
          .attr("height", this.scales.yScale.bandwidth())
          .attr("x", this.getLeftOffset)
          .attr("y", (a) => this.scales.yScale(a[this.yProperty]))
        ,
      )
    ;
  }
  public rerender() {
    this._scales = this.calculateScales();
    this.render();
  }
  public destroy = () => {
    this._root.remove();
  }
}