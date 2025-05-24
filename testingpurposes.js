/**
 * Get budget data from JSON cell in Dontedit sheet
 * @param {boolean} useCache - Whether to use cached data
 * @return {Object} Budget data by month
 */
function getBudgetData(useCache = true) {
  try {
    const props = PropertiesService.getUserProperties();
    
    // Check cache first
    if (useCache) {
      const cached = props.getProperty("CACHED_BUDGET_DATA");
      if (cached) {
        return {
          success: true,
          budgetData: JSON.parse(cached),
          fromCache: true
        };
      }
    }
    
    const spreadsheetId = props.getProperty("BUDGET_SPREADSHEET_ID");
    if (!spreadsheetId) {
      return { success: false, error: "No spreadsheet ID found" };
    }
    
    const ss = SpreadsheetApp.openById(spreadsheetId);
    const sheet = ss.getSheetByName("Dontedit");
    
    if (!sheet) {
      return { success: false, error: "Dontedit sheet not found" };
    }
    
    // Get budget JSON from N86
    const budgetCell = sheet.getRange("N86").getValue();
    
    if (!budgetCell) {
  // Return empty object if no data yet
  return { 
    success: true, 
    budgetData: {} // This might be the issue
  };
}
    
    let budgetData;
    try {
      budgetData = JSON.parse(budgetCell);
    } catch (e) {
      return { success: false, error: "Invalid JSON in budget cell: " + e.toString() };
    }
    
    // Cache for next time
    props.setProperty("CACHED_BUDGET_DATA", JSON.stringify(budgetData));
    
    return {
      success: true,
      budgetData: budgetData
    };
    
  } catch (error) {
    Logger.log("Error in getBudgetData: " + error.toString());
    return { success: false, error: error.toString() };
  }
}

/**
 * Save budget data to JSON cell
 * @param {Object} budgetData - Complete budget data object
 * @return {Object} Result
 */
function saveBudgetData(budgetData) {
  try {
    const props = PropertiesService.getUserProperties();
    const spreadsheetId = props.getProperty("BUDGET_SPREADSHEET_ID");
    
    if (!spreadsheetId) {
      return { success: false, error: "No spreadsheet ID found" };
    }
    
    const ss = SpreadsheetApp.openById(spreadsheetId);
    const sheet = ss.getSheetByName("Dontedit");
    
    if (!sheet) {
      return { success: false, error: "Dontedit sheet not found" };
    }
    
    // Save to N86
    sheet.getRange("N86").setValue(JSON.stringify(budgetData));
    
    // Update cache
    props.setProperty("CACHED_BUDGET_DATA", JSON.stringify(budgetData));
    
    // Clear dashboard cache since budget changed
    props.deleteProperty("CACHED_DASHBOARD_DATA");
    
    return { success: true };
    
  } catch (error) {
    Logger.log("Error in saveBudgetData: " + error.toString());
    return { success: false, error: error.toString() };
  }
}




// Add this to your transaction.js to test
function testFindTransaction(transactionId) {
  try {
    const sheet = getBudgetSheet("Expenses");
    if (!sheet) return "No sheet found";
    
    Logger.log("=== TESTING TEXTFINDER ===");
    Logger.log("Looking for ID: " + transactionId);
    Logger.log("ID type: " + typeof transactionId);
    
    // Let's try multiple search approaches
    const finder1 = sheet.createTextFinder(transactionId.toString())
                        .matchEntireCell(true)
                        .findNext();
    
    const finder2 = sheet.createTextFinder(transactionId.toString())
                        .matchEntireCell(false)  // Partial match
                        .findNext();
    
    // Also check what's actually in column D
    const columnD = sheet.getRange("D5:D100").getValues();
    Logger.log("First few IDs in column D:");
    for (let i = 0; i < Math.min(10, columnD.length); i++) {
      if (columnD[i][0]) {
        Logger.log(`Row ${i+5}: "${columnD[i][0]}" (type: ${typeof columnD[i][0]})`);
      }
    }
    
    Logger.log("Exact match result: " + (finder1 ? "Found at row " + finder1.getRow() : "Not found"));
    Logger.log("Partial match result: " + (finder2 ? "Found at row " + finder2.getRow() : "Not found"));
    
    return {
      exactMatch: finder1 ? finder1.getRow() : null,
      partialMatch: finder2 ? finder2.getRow() : null
    };
  } catch (e) {
    Logger.log("Test error: " + e.toString());
    return "Error: " + e.toString();
  }
}