import { font } from "./constants";
import { DataRow } from "./types";

let canvas: HTMLCanvasElement;
const getCanvas = (): HTMLCanvasElement => {
  if (!canvas) {
    canvas = document.createElement("canvas");
  }
  return canvas;
}

const textWidthMap: {[text: string]: number} = {};
export function getTextWidth(text: string): number {
  if (!(text in textWidthMap)) {
    const context = getCanvas().getContext("2d");
    context.font = `${font.face} ${font.size}px`;
    const metrics = context.measureText(text);
    textWidthMap[text] = metrics.width;
  }
  return textWidthMap[text];
}

export function parseNumber(s: string): number {
  return parseFloat(s.replace(/[^0-9.-]+/g,""));
}

export const noop = <T>(a: T): T => a;

export function uniqueValues(data: DataRow[], key: string) {
  return data.reduce<string[]>((acc, val) => acc.includes(val[key]) ? acc : [...acc, val[key]], []);
}