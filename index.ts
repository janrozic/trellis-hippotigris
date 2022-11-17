import * as d3 from "d3";
import dataString from "./src/multiples.csv?raw";
const data = d3.csvParse(dataString);

// const data: d3.DSVRowArray = [
//   {a: "1", b: "1", c: "1",},
//   {a: "2", c: "2",},
//   {a: "3", b: "3",},
// ] as any;
// data.columns = ["a", "b", "c"];

const table = d3.select("body")
.append("table").attr("border", 1);
const thead = table.append("thead").append("tr");
const tbody = table.append("tbody");
thead.selectAll("th").data(data.columns).join("th").text(String);
tbody.selectAll("tr").data(data).join("tr").selectAll("td").data((row: any) => data.columns.map((c) => row[c])).join("td").text(String)