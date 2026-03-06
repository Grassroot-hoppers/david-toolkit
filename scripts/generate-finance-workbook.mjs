import fs from "node:fs";
import path from "node:path";
import xlsx from "xlsx";

const root = process.cwd();
const outPath = path.join(root, "sample-data", "raw", "chez-julien-finance-demo.xlsx");

const pnlRows = [
  ["Month", "Revenue 2023", "Revenue 2024", "Revenue 2025", "Margin 2025", "Opex 2025"],
  ["Jan", 31200, 33800, 36150, 15910, 12240],
  ["Feb", 29800, 32420, 35240, 15420, 12180],
  ["Mar", 30500, 33260, 36980, 16350, 12410],
  ["Apr", 32100, 34810, 38250, 17010, 12620],
  ["May", 33600, 35980, 39940, 17790, 12940],
  ["Jun", 34980, 37240, 41820, 18740, 13220],
  ["Jul", 35240, 38120, 42660, 19040, 13310],
  ["Aug", 34440, 37480, 41900, 18510, 13200],
  ["Sep", 32680, 36140, 39880, 17680, 12860],
  ["Oct", 33820, 36980, 40760, 18010, 12990],
  ["Nov", 36100, 39240, 43220, 19280, 13560],
  ["Dec", 38840, 42160, 46620, 20940, 14210]
];

function toRows(year) {
  return [
    ["ACCOUNT", "ACCOUNT NAME", "CONSO KEY", "YEAR", "MONTH", "ENTITE", "YTD", "AMOUNT", "Document Nr", "Commentaires", "Axe analytique 1"],
    ["700000", "Ventes boutique", "REV", year, 1, "CHEZ JULIEN", 12, pnlRows[1][year === 2023 ? 1 : year === 2024 ? 2 : 3], `${year}01`, "Revenue month 1", "BOUTIQUE"],
    ["600000", "Achats marchandises", "COGS", year, 1, "CHEZ JULIEN", 12, -Math.round(pnlRows[1][year === 2023 ? 1 : year === 2024 ? 2 : 3] * 0.46), `${year}01`, "COGS month 1", "BOUTIQUE"],
    ["610000", "Charges fixes", "OPEX", year, 1, "CHEZ JULIEN", 12, -Math.round(pnlRows[1][year === 2023 ? 1 : year === 2024 ? 2 : 3] * 0.34), `${year}01`, "Opex month 1", "BOUTIQUE"]
  ];
}

const workbook = xlsx.utils.book_new();
xlsx.utils.book_append_sheet(workbook, xlsx.utils.aoa_to_sheet(pnlRows), "P&L");
xlsx.utils.book_append_sheet(workbook, xlsx.utils.aoa_to_sheet(toRows(2025)), "Datas 2025");
xlsx.utils.book_append_sheet(workbook, xlsx.utils.aoa_to_sheet(toRows(2024)), "Datas 2024");
xlsx.utils.book_append_sheet(workbook, xlsx.utils.aoa_to_sheet(toRows(2023)), "Datas 2023");
xlsx.utils.book_append_sheet(
  workbook,
  xlsx.utils.aoa_to_sheet([
    ["Metric", "Budget 2026"],
    ["Revenue", 498000],
    ["Margin", 214000]
  ]),
  "Datas Budget 2026"
);
xlsx.utils.book_append_sheet(
  workbook,
  xlsx.utils.aoa_to_sheet([
    ["Code", "Account Name", "Mapping"],
    ["700000", "Ventes boutique", "REV"],
    ["600000", "Achats marchandises", "COGS"],
    ["610000", "Charges fixes", "OPEX"]
  ]),
  "Mapping"
);

xlsx.writeFile(workbook, outPath);
console.log(`Wrote ${outPath}`);

