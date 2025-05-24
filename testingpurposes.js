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