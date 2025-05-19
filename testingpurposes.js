function getExpenseData(month, year) {
  Logger.log("=== SERVER MONTH DEBUG ===");
  Logger.log("Received: month=" + month + ", year=" + year);
  Logger.log("Parameter types: month=" + typeof month + ", year=" + typeof year);
  if (month !== undefined && month !== null) {
    const testDate = new Date(year, month, 1);
    const monthName = testDate.toLocaleString('default', { month: 'long' });
    Logger.log("Server will filter for: " + monthName + " " + year);
  }
  Logger.log("========================");
  
  try {
    // Default to current month/year if not provided
    if (month === undefined || month === null || year === undefined || year === null) {
      const now = new Date();
      month = now.getMonth();
      year = now.getFullYear();
      Logger.log("getExpenseData: Using current month/year: " + month + "/" + year);
    }
    
    // Ensure month and year are numbers
    month = parseInt(month);
    year = parseInt(year);
    Logger.log("getExpenseData: Final parsed values - month:" + month + ", year:" + year);
    
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);
    Logger.log("getExpenseData: Filtering for dates between " + monthStart.toDateString() + " and " + monthEnd.toDateString());
    
    // Get the Dontedit sheet
    const donteditSheet = getBudgetSheet("Dontedit");
    if (!donteditSheet) {
      return { success: false, error: "Dontedit sheet not found" };
    }
    
    const lastRow = donteditSheet.getLastRow();
    Logger.log("getExpenseData: Sheet has " + lastRow + " rows");
    
    // FIXED: Read headers from row 4
    const headerRange = "FU4:FZ4"; // Headers are in row 4
    const headers = donteditSheet.getRange(headerRange).getValues()[0];
    Logger.log("Headers found: " + JSON.stringify(headers));
    
    // Map header names to column indices (case-insensitive)
    const columnMap = {};
    headers.forEach((header, index) => {
      if (header && typeof header === 'string') {
        const cleanHeader = header.toString().trim().toLowerCase();
        columnMap[cleanHeader] = index;
      }
    });
    
    // Define the columns we need with possible variations
    const requiredColumns = {
      'account': ['account', 'acc'],
      'notes': ['notes', 'note', 'description'],
      'date': ['date', 'transaction date'],
      'name': ['name', 'transaction name', 'description', 'desc'],
      'category': ['category', 'cat'],
      'amount': ['amount', 'value', 'cost']
    };
    
    // Find the actual column indices
    const columns = {};
    Object.keys(requiredColumns).forEach(key => {
      let found = false;
      requiredColumns[key].forEach(variation => {
        if (!found && columnMap[variation] !== undefined) {
          columns[key] = columnMap[variation];
          found = true;
          Logger.log("Found " + key + " at index " + columns[key] + " (header: " + headers[columns[key]] + ")");
        }
      });
      if (!found) {
        Logger.log("WARNING: Could not find column for " + key);
      }
    });
    
    // Verify we found all required columns
    const missing = Object.keys(requiredColumns).filter(key => columns[key] === undefined);
    if (missing.length > 0) {
      return { success: false, error: "Missing required columns: " + missing.join(', ') };
    }
    
    // FIXED: Start from row 5 (since headers are in row 4)
    const startRow = 5;
    const endRow = Math.min(lastRow, startRow + 1000); // Read max 1000 rows from start
    const range = "FU" + startRow + ":FZ" + endRow;
    Logger.log("getExpenseData: Reading range " + range + " (starting from row 5)");
    
    const dataRange = donteditSheet.getRange(range);
    const expenseData = dataRange.getValues();
    Logger.log("getExpenseData: Successfully read " + expenseData.length + " rows");
    
    // Process expenses using dynamic column indices
    const expenses = [];
    let monthMatches = 0;
    let skippedCount = 0;
    
    for (let i = 0; i < expenseData.length; i++) {
      const row = expenseData[i];
      
      // Skip empty rows
      if (!row || row.every(cell => !cell || cell.toString().trim() === '')) {
        skippedCount++;
        continue;
      }
      
      // Use column map to extract data safely
      const dateValue = row[columns.date];
      const categoryValue = row[columns.category];
      const amountValue = row[columns.amount];
      
      if (!dateValue || !categoryValue || !amountValue) {
        skippedCount++;
        continue;
      }
      
      // Parse date
      let expenseDate;
      if (dateValue instanceof Date) {
        expenseDate = dateValue;
      } else {
        expenseDate = new Date(dateValue);
      }
      
      if (isNaN(expenseDate.getTime())) {
        Logger.log("Could not parse date: " + dateValue);
        skippedCount++;
        continue;
      }
      
      // Check month/year match
      if (expenseDate.getMonth() === month && expenseDate.getFullYear() === year) {
        monthMatches++;
        
        // Parse amount
        let amount = parseFloat(amountValue);
        if (isNaN(amount) || amount <= 0) {
          skippedCount++;
          continue;
        }
        
        expenses.push({
          rowIndex: i + startRow,
          account: (row[columns.account] || "").toString(),
          notes: (row[columns.notes] || "").toString(),
          date: expenseDate.toISOString(),
          name: (row[columns.name] || "").toString(),
          category: categoryValue.toString(),
          amount: amount
        });
      } else {
        skippedCount++;
      }
    }
    
    Logger.log("getExpenseData: SUMMARY for " + month + "/" + year + ":");
    Logger.log("  - Total rows: " + expenseData.length);
    Logger.log("  - Month matches: " + monthMatches);
    Logger.log("  - Final expenses: " + expenses.length);
    Logger.log("  - Skipped: " + skippedCount);
    
    return {
      success: true,
      expenses: expenses,
      meta: {
        month: month,
        year: year,
        totalRows: expenseData.length,
        monthMatches: monthMatches,
        processedRows: expenses.length,
        skippedRows: skippedCount,
        range: range,
        columnMap: columns
      }
    };
  } catch (error) {
    Logger.log("ERROR in getExpenseData: " + error.toString());
    return { 
      success: false, 
      error: error.toString()
    };
  }
}