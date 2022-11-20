import * as d3 from "d3";
import { font, margin, size, topPadding } from "./constants";
import { getTextWidth, noop, parseNumber } from "./helpers";

type Data = d3.DSVRowArray<string>;
type DataRow = d3.DSVRowString<string>;
type Selection<T extends d3.BaseType> = d3.Selection<T, any, HTMLElement, any>;
type Grouped<T = DataRow[]> = d3.InternMap<string, T>;

export default class Trellis {

  private data;
  private rootSelector;
  public constructor(data: Data, elementSelector = "body") {
    this.data = data;
    this.rootSelector = elementSelector;
    this.setAxes(data.columns[0], data.columns[2], data.columns[1]);
  }

  private grouped: {x: Grouped, y: Grouped, maxes: Grouped<number>};
  private numericProperty: string;
  private xProperty: string;
  private yProperty: string;
  public setAxes = (numericProperty: string, xProperty: string, yProperty: string, order?: "asc" | "desc" | undefined) => {
    this.numericProperty = numericProperty;
    this.xProperty = xProperty;
    this.yProperty = yProperty;
    type Tuple = [DataRow[], number];
    const sortK = order === "desc" ? -1 : 1;
    let getAggregate = (property: string) => d3.group(this.data, d => d[property]);
    let xMaxes = d3.rollup(this.data, v => d3.max(v, this.getNumericValue), d => d[xProperty]);
    if (order) {
      getAggregate = (property: string) => new d3.InternMap(
        d3.rollups(
          this.data,
          (d): Tuple => [d, d3.max(d, this.getNumericValue)], 
          d => d[property]
        )
        .sort((a: [string, Tuple], b: [string, Tuple]) => (a[1][1] - b[1][1]) * sortK)
        .map(([k, v]) => [k, v[0]])
      );
      xMaxes = new d3.InternMap(
        d3.rollups(this.data, v => d3.max(v, this.getNumericValue), d => d[xProperty])
        .sort((a, b) => (a[1] - b[1]) * sortK)
      );
    }
    this.grouped = {
      x: getAggregate(xProperty),
      y: getAggregate(yProperty),
      maxes: xMaxes,
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
    const movingMaxSum = Array.from(this.grouped.maxes.values()).reduce<number[]>((acc, val) => [...acc, acc[acc.length - 1] + val], [0]);
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
      .selectChildren("g.group")
      .data(this.grouped.x.keys())
      .join(enter => 
        enter.append("g")
          .attr("class", "group")
          .attr("transform", (a) => `translate(${this.getLeftOffset(a)}, ${topPadding})`)
          .call(d3.axisLeft(this.scales.yScale))
      )
      .selectAll("text, line")
      .remove()
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
        (enter) => enter
          .append("rect")
          .attr("fill", (a) => this.scales.colorScale(this.getNumericValue(a)))
          .attr("width", (a) => this.scales.xScale(this.getNumericValue(a)))
          .attr("height", this.scales.yScale.bandwidth())
          .attr("x", this.getLeftOffset)
          .attr("y", (a) => this.scales.yScale(a[this.yProperty]))
        ,
        (update) => update
          .transition()
          .duration(500)
          .attr("x", this.getLeftOffset)
          .attr("y", (a) => this.scales.yScale(a[this.yProperty]))
      )
      // .attr("fill", (a) => this.scales.colorScale(this.getNumericValue(a)))
      // .attr("width", (a) => this.scales.xScale(this.getNumericValue(a)))
      // .attr("height", this.scales.yScale.bandwidth())
      // .attr("x", this.getLeftOffset)
      // .attr("y", (a) => this.scales.yScale(a[this.yProperty]))
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