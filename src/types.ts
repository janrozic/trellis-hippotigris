import * as d3 from "d3";

export type Data = d3.DSVRowArray<string>;
export type DataRow = d3.DSVRowString<string>;
export type D3Selection<T extends d3.BaseType> = d3.Selection<T, any, HTMLElement, any>;
export type Grouped<T = DataRow[]> = d3.InternMap<string, T>;