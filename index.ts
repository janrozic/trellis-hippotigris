import * as d3 from "d3";
import dataString from "./src/multiples.csv?raw";
import Trellis from "./src/trellis";

/***** DATA *****/

const data = d3.csvParse(dataString);

const chart = new Trellis(data);

const btn = d3.select("body")
  .append("div")
  .append("button")
  .text("Transpose")
;
btn.on("click", chart.transpose);

chart.render();

/****** Table ******/

// const table = d3.select("body")
// .append("table").attr("border", 1);
// const thead = table.append("thead").append("tr");
// const tbody = table.append("tbody");
// thead.selectAll("th").data(data.columns).join("th").text(String);
// tbody.selectAll("tr").data(data).join("tr").selectAll("td").data((row: any) => data.columns.map((c) => row[c])).join("td").text(String)