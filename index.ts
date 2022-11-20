import * as d3 from "d3";
import { noop } from "./src/helpers";
import dataString from "./src/multiples.csv?raw";
import Trellis from "./src/trellis";

/***** DATA *****/

const data = d3.csvParse(dataString);

const chart = new Trellis(data);

const form = d3.select("body").append("div").style("display", "flex");

type FieldKey = "numeric" | "y" | "x";
const keys: FieldKey[] = ["numeric", "y", "x"];

function initConfiguration() {
  return {
    numeric: selects.numeric.node().value,
    y: selects.y.node().value,
    x: selects.x.node().value,
    order: (orderSelect.node().value as "asc" | "desc" | "") || undefined,
  };
}

function changeConfiguration(field?: FieldKey) {
  return () => {
    let configuration = initConfiguration();
    const taken = field ? [configuration[field]] : [];
    const nextAvailable = (prefer: string) => {
      if (!taken.includes(prefer)) {
        taken.push(prefer);
        return prefer;
      }
      for (const v of data.columns) {
        if (!taken.includes(v)) {
          taken.push(v);
          return v;
        }
      }
    };
    for (const key of keys) {
      if (field && key === field) {
        continue;
      }
      configuration[key] = nextAvailable(configuration[key]);
      selects[key].node().value = configuration[key];
    }
    chart.setAxes(configuration.numeric, configuration.x, configuration.y, configuration.order);
    chart.rerender();
  };
}
for (const key of keys) {
  form.append("div").attr("class", "form-group " + key);
  form.selectChild("." + key).append("label").text(key + " field");
}
const selects = Object.fromEntries(keys.map((key) => [
  key,
  form.selectChild("." + key).append("select").attr("class", "columns").on("change", changeConfiguration(key)),
]));

form.selectAll("select.columns").selectChildren("option")
  .data(data.columns)
  .join("option")
  .text(noop)
;
form.append("div").attr("class", "form-group order");
form.selectChild(".order").append("label").text("Order");
const orderSelect = form.selectChild(".order").append("select").on("change", changeConfiguration());
orderSelect
  .selectAll("option")
  .data([["", "Default"], ["asc", "Ascending"], ["desc", "Descending"]])
  .join("option")
  .attr("value", d => d[0])
  .text(d => d[1])
;

changeConfiguration()();

// chart.rerender();

/****** Table ******/

// const table = d3.select("body")
// .append("table").attr("border", 1);
// const thead = table.append("thead").append("tr");
// const tbody = table.append("tbody");
// thead.selectAll("th").data(data.columns).join("th").text(String);
// tbody.selectAll("tr").data(data).join("tr").selectAll("td").data((row: any) => data.columns.map((c) => row[c])).join("td").text(String)