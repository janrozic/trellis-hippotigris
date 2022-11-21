import * as d3 from "d3";
import drawChart from "./src/drawChart";
import dataString from "./src/multiples.csv?raw";


const fileField = d3.select("body").append("div").attr("class", "form").append("div").attr("class", "form-group");
fileField.append("label").text("Select CSV");
fileField.append("input").attr("type", "file").attr("accept", ".csv").on("change", readFile);

function readFile(e: Event) {
  const file = (e.target as HTMLInputElement).files[0];
  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target.result;
    if (typeof text === "string") {
      drawChart(d3.csvParse(text));
    }
  };
  reader.readAsText(file);
}
drawChart(d3.csvParse(dataString));