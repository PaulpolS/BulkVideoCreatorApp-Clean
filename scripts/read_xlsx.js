const XLSX = require('xlsx');

const workbook = XLSX.readFile('/Users/macos/Desktop/ทดสอบว่าทำได้มั้ย/data_promo_list.xlsx');
const firstSheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[firstSheetName];

const rawJson = XLSX.utils.sheet_to_json(worksheet);

if (rawJson.length > 0) {
    console.log("Found", rawJson.length, "rows.");
    console.log("=== HEADERS AND ROW 1 DATA ===");
    const row1 = rawJson[0];
    Object.keys(row1).forEach(key => {
        console.log(`[${key}]: ${row1[key]}`);
    });
} else {
    console.log("No data found.");
}
