import * as d3 from "d3";
import { font, margin, size, topPadding } from "./constants";
import { getTextWidth, noop, parseNumber } from "./helpers";

type Data = d3.DSVRowArray<string>;
type DataRow = d3.DSVRowString<string>;
type Selection<T extends d3.BaseType> = d3.Selection<T, any, HTMLElement, any>;
type Grouped = ReturnType<typeof d3.group<DataRow, string>>;

export default class Trellis {

  private data;
  private rootSelector;
  public constructor(data: Data, elementSelector = "body") {
    this.data = data;
    this.rootSelector = elementSelector;
    this.setData(data.columns[0], data.columns[2], data.columns[1]);
  }

  private grouped: {[k in "x" | "y"]: Grouped};
  private numericProperty: string;
  private xProperty: string;
  private yProperty: string;
  private setData = (numericProperty: string, xProperty: string, yProperty: string) => {
    this.numericProperty = numericProperty;
    this.xProperty = xProperty;
    this.yProperty = yProperty;
    this.grouped = {
      x: d3.group(this.data, d => d[xProperty]),
      y: d3.group(this.data, d => d[yProperty]),
    };
  }

  private _root: Selection<HTMLDivElement>;
  private _barsHolder: Selection<SVGElement>;
  private _axisHolder: Selection<SVGElement>;
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
      .attr("viewBox", `0 0 ${this.size.width} ${this.size.height}`)
      .style("max-width", `${this.size.width}px`)
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

  private _size: {width: number, height: number};
  private get size() {
    if (!this._size) {
      this._size = {
        ...size,
        height: topPadding + size.element * Math.max(this.grouped.x.size, this.grouped.y.size) + margin.top + margin.bottom,
      };
    }
    return this._size;
  }

  private calculateScales = () => {
    const getAggregate = (property: string, aggregate: "min" | "max" | "sum") =>
      d3.rollup(this.data, v => d3[aggregate as "max"](v, this.getNumericValue), d => d[property])
    ;

    const byXMaxes = getAggregate(this.xProperty, "max");
    const movingMaxSum = Array.from(byXMaxes.values()).reduce<number[]>((acc, val) => [...acc, acc[acc.length - 1] + val], [0]);
    const maxByXSum = movingMaxSum.pop();
    const xPositions = Object.fromEntries(Array.from(this.grouped.x.keys(),
      (k, index) => [k, {
        index,
        sum: movingMaxSum[index],
      }]
    ));
    const maxTextWidth = (map: Grouped) => d3.max(Array.from(map.keys(), getTextWidth));
    const leftPadding = Math.max(maxTextWidth(this.grouped.x), maxTextWidth(this.grouped.y));

    const xScale = d3
      .scaleLinear<number>()
      .range([0, this.size.width - margin.right - margin.left - leftPadding - margin.between * (this.grouped.y.size - 1)])
      .domain([0, maxByXSum])
    ;
    const yScale = d3
      .scaleBand<string>()
      .domain(this.grouped.y.keys())
      .range([margin.top + topPadding, size.height - margin.bottom - topPadding])
      .padding(0.4)
      .round(true)  // discrete values
    ;
    const allNumeric = this.data.map(this.getNumericValue);
    const maxAll = Math.max(...allNumeric);
    const minAll = Math.min(...allNumeric);

    const colorScale = d3
      .scaleSequential()
      .domain([minAll, maxAll])
      .interpolator((t: number) => d3.interpolateBlues(0.5 + t * 0.5))
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
    this.axisHolder
      .append("g")
      .attr("transform", `translate(${margin.left + this.scales.leftPadding}, 0)`)
      .style("font", `${font.face} ${font.size}px`)
      .call(d3.axisLeft(this.scales.yScale))
      .selectAll("path.domain, line")
      .remove()
    ;
    this.axisHolder.selectChildren("text")
      .data(this.grouped.x.keys())
      .join("text")
      .html(noop)
      .attr("transform", (a) => `translate(${this.getLeftOffset(a)}, ${margin.top + topPadding})`)
    ;
  }

  public render() {
    this.renderAxes();

    // const group = holder
    //   .selectAll("g.set")
    //   .data(by1)
    //   .join("g")
    //   .attr("class", "set")
    // .attr("transform", (a) => `translate(${xScale(a)}, 0)`)
    ;

    // Rectangles

    this.barsHolder.selectChildren("rect")
      .data(this.data)
      .join("rect")
      .attr("fill", (a) => this.scales.colorScale(this.getNumericValue(a)))
      .attr("width", (a) => this.scales.xScale(this.getNumericValue(a)))
      .attr("height", this.scales.yScale.bandwidth())
      .attr("x", this.getLeftOffset)
      .attr("y", (a) => this.scales.yScale(a[this.yProperty]))
    ;
  }
  private rerender() {
    this._scales = this.calculateScales();
    this.render();
  }
  public transpose = () => {
    this.setData(this.numericProperty, this.yProperty, this.xProperty);
    this.rerender();
  }
  public destroy = () => {
    this._root.remove();
  }
}