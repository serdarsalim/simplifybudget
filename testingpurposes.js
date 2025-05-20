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
    
    // Updated header range to include GA4 column (Label)
    const headerRange = "FU4:GA4";
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
    
    // Define the columns we need with possible variations - added 'label'
    const requiredColumns = {
      'account': ['account', 'acc'],
      'notes': ['notes', 'note', 'description'],
      'date': ['date', 'transaction date'],
      'name': ['name', 'transaction name', 'description', 'desc'],
      'category': ['category', 'cat'],
      'amount': ['amount', 'value', 'cost'],
      'label': ['label', 'type', 'transaction type'] // Added label column variations
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
        // Make label optional (don't fail if not found)
        if (key !== 'label') {
          Logger.log("WARNING: Could not find column for " + key);
        } else {
          Logger.log("INFO: Label column not found - will be null for transactions");
        }
      }
    });
    
    // Verify we found all required columns (except label which is optional)
    const requiredKeys = Object.keys(requiredColumns).filter(key => key !== 'label');
    const missing = requiredKeys.filter(key => columns[key] === undefined);
    if (missing.length > 0) {
      return { success: false, error: "Missing required columns: " + missing.join(', ') };
    }
    
    // Start from row 5 (since headers are in row 4)
    const startRow = 5;
    const endRow = Math.min(lastRow, startRow + 1000);
    const range = "FU" + startRow + ":GA" + endRow;
    Logger.log("getExpenseData: Reading range " + range + " (starting from row 5)");
    
    const dataRange = donteditSheet.getRange(range);
    const expenseData = dataRange.getValues();
    Logger.log("getExpenseData: Successfully read " + expenseData.length + " rows");
    
    // Process expenses using dynamic column indices
    const expenses = [];
    let monthMatches = 0;
    let skippedCount = 0;
    let incomeSkipped = 0; // Track income transactions skipped
    
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
      
      // FILTER OUT INCOME TRANSACTIONS
      const categoryString = categoryValue.toString().toLowerCase();
      if (categoryString.includes('income')) {
        incomeSkipped++;
        skippedCount++;
        Logger.log("Skipping income transaction: " + categoryValue);
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
        
        // Get the label value if the column exists
        const labelValue = columns.label !== undefined ? row[columns.label] : null;
        const label = labelValue ? labelValue.toString() : "";
        
        expenses.push({
          rowIndex: i + startRow,
          account: (row[columns.account] || "").toString(),
          notes: (row[columns.notes] || "").toString(),
          date: expenseDate.toISOString(),
          name: (row[columns.name] || "").toString(),
          category: categoryValue.toString(),
          amount: amount,
          label: label // Include the label field
        });
      } else {
        skippedCount++;
      }
    }
    
    Logger.log("getExpenseData: SUMMARY for " + month + "/" + year + ":");
    Logger.log("  - Total rows: " + expenseData.length);
    Logger.log("  - Income transactions skipped: " + incomeSkipped);
    Logger.log("  - Month matches: " + monthMatches);
    Logger.log("  - Final expenses: " + expenses.length);
    Logger.log("  - Total skipped: " + skippedCount);
    
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
        incomeSkipped: incomeSkipped,
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


/**
 * Save user settings to server-side storage
 * @param {Object} settings - The settings object to save
 * @return {Object} Result with success/failure status
 */
function setUserSettings(settings) {
  try {
    const userProperties = PropertiesService.getUserProperties();
    userProperties.setProperty('simbudget_settings', JSON.stringify(settings));
    
    return {
      success: true,
      message: "Settings saved successfully"
    };
  } catch (e) {
    return {
      success: false,
      error: e.toString()
    };
  }
}

/**
 * Get user settings from server-side storage
 * @return {Object} Result with success/failure status and settings
 */
function getUserSettings() {
  try {
    const userProperties = PropertiesService.getUserProperties();
    const settingsString = userProperties.getProperty('simbudget_settings');
    
    return {
      success: true,
      settings: settingsString ? JSON.parse(settingsString) : {}
    };
  } catch (e) {
    return {
      success: false,
      error: e.toString()
    };
  }
}