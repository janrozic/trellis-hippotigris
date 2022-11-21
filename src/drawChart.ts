import * as d3 from "d3";
import { noop, parseNumber, uniqueValues } from "./helpers";
import Trellis from "./trellis";
import { D3Selection, Data } from "./types";

let form: D3Selection<HTMLDivElement>;
let chart: Trellis;
function initForm() {
  if (!form) {
    form = d3.select("body").append("div").attr("class", "form");
  }
}

export default function drawChart(data: Data) {
  initForm();
  /******* PARSE COLUMNS *******/

  if (data.columns.length < 3) {
    return alert("Data should have at least 3 columns");
  }
  const numericColumns: string[] = [];
  for (const col of data.columns) {
    const vals = uniqueValues(data, col);
    if (!vals.some((v) => isNaN(parseNumber(v)))) {
      numericColumns.push(col);
    }
  }
  if (numericColumns.length === 0) {
    return alert("No numeric columns");
  }
  let stringColumns = data.columns;
  if (numericColumns.length === 1) {
    stringColumns = data.columns.filter((c) => c !== numericColumns[0]);
  }

  /******* DELETE OLD *******/

  form.selectChildren().remove();
  if (chart) {
    chart.destroy();
  }

  /******* SET UP FORM *******/

  type FieldKey = "numeric" | "y" | "x";
  const axiskeys: FieldKey[] = ["numeric", "y", "x"];

  // Axes selects
  const selects: Partial<{[key in FieldKey]: D3Selection<HTMLSelectElement>}> = {};
  for (const key of axiskeys) {
    // form group
    const group = form.append("div").attr("class", "form-group " + key);
    // label
    form.selectChild("." + key).append("label").text(key + " field");
    // select
    selects[key] = group.append("select").attr("class", "columns").on("change", changeConfiguration(key));
    // options
    const cols = key === "numeric" ? numericColumns : stringColumns;
    selects[key].selectChildren("option")
      .data(cols)
      .join("option")
      .text(noop)
    ;
    if (cols.length === 1) {
      selects[key].attr("readonly", true);
      selects[key].selectChild("option").attr("selected", true)
    }
  }

  // Order select
  form.append("div").attr("class", "form-group order");
  form.selectChild(".order").append("label").text("Order");
  const orderOptions = [["alpha", "Alphabetically"], ["asc", "Ascending"], ["desc", "Descending"], ["", "None"]];
  const orderSelect = form.selectChild(".order").append("select").on("change", changeConfiguration());
  orderSelect
    .selectAll("option")
    .data(orderOptions)
    .join("option")
    .attr("value", d => d[0])
    .text(d => d[1])
  ;

  /******* INIT CHART *******/

  chart = new Trellis(data);
  
  function initConfiguration() {
    return {
      numeric: selects.numeric.node().value,
      y: selects.y.node().value,
      x: selects.x.node().value,
      order: (orderSelect.node().value as "asc" | "desc" | "alpha" | "") || undefined,
    };
  }
  
  function changeConfiguration(field?: FieldKey) {
    return () => {
      let configuration = initConfiguration();
      const taken = field ? [configuration[field]] : [];
      const nextAvailable = (prefer: string, columns: string[]) => {
        if (!taken.includes(prefer)) {
          taken.push(prefer);
          return prefer;
        }
        for (const v of columns) {
          if (!taken.includes(v)) {
            taken.push(v);
            return v;
          }
        }
      };
      for (const key of axiskeys) {
        if (field && key === field) {
          continue;
        }
        configuration[key] = nextAvailable(configuration[key], key === "numeric" ? numericColumns : stringColumns);
        selects[key].node().value = configuration[key];
      }
      chart.setAxes(configuration.numeric, configuration.x, configuration.y, configuration.order);
    };
  }
  changeConfiguration()();
}