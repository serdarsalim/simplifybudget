/**
 * Get categories with timestamp from Setup sheet
 * @return {Object} {success: true, categories: [], activeCategories: [], timestamp: "ISO_STRING"}
 */
function getCategoriesWithTimestamp() {
  try {
    Logger.log("getCategoriesWithTimestamp called");
    
    const props = PropertiesService.getUserProperties();
    const spreadsheetId = props.getProperty("BUDGET_SPREADSHEET_ID");
    
    if (!spreadsheetId) {
      return {
        success: false,
        error: "No spreadsheet ID found in user properties"
      };
    }
    
    const ss = SpreadsheetApp.openById(spreadsheetId);
    const setupSheet = ss.getSheetByName("Setup");
    if (!setupSheet) {
      return {
        success: false,
        error: "Setup sheet not found"
      };
    }
    
    // Get timestamp from I50
    const timestampCell = setupSheet.getRange("I50").getValue();
    let timestamp;
    
    if (timestampCell && timestampCell instanceof Date) {
      timestamp = timestampCell.toISOString();
    } else if (timestampCell) {
      timestamp = new Date(timestampCell).toISOString();
    } else {
      // No timestamp exists, create one
      timestamp = new Date().toISOString();
      setupSheet.getRange("I50").setValue(new Date());
    }
    
    // Get category data from columns F and G (15:44)
    const range = setupSheet.getRange("F15:G44");
    const values = range.getValues();
    
    const categories = [];
    const activeCategories = [];
    
    for (let i = 0; i < values.length; i++) {
      const isActive = values[i][0] === true; // Column F is checkbox
      const categoryString = values[i][1];    // Column G is category name
      
      if (!categoryString || categoryString === "") continue;
      
      // Parse category to extract name and emoji
      const parsed = parseCategoryNameAndEmoji(categoryString);
      
      // Create category object 
      const categoryObj = {
        id: parsed.name,
        name: parsed.name,
        emoji: parsed.emoji,
        fullName: categoryString,
        active: isActive,
        order: i  // Preserve spreadsheet order
      };
      
      categories.push(categoryObj);
      
      if (isActive) {
        activeCategories.push(categoryObj);
      }
    }
    
    Logger.log("Returning categories with timestamp: " + categories.length + " total, " + 
               activeCategories.length + " active, timestamp: " + timestamp);
    
    return {
      success: true,
      categories: categories,        // Now returns parsed objects
      activeCategories: activeCategories,  // Now returns parsed objects
      timestamp: timestamp
    };
    
  } catch (error) {
    Logger.log("Error in getCategoriesWithTimestamp: " + error.toString());
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * Parse category string to extract name and emoji (add this helper function)
 */
function parseCategoryNameAndEmoji(categoryString) {
  const parts = categoryString.trim().split(' ');
  
  if (parts.length >= 2) {
    const lastPart = parts[parts.length - 1];
    const emojiRegex = /[\u{1F600}-\u{1F6FF}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
    
    if (emojiRegex.test(lastPart)) {
      const name = parts.slice(0, -1).join(' ');
      const emoji = lastPart;
      return { name, emoji };
    }
  }
  
  return { name: categoryString, emoji: '' };
}

/**
 * Update categories timestamp in Setup!I50
 * @return {Object} Success response
 */
function updateCategoriesTimestamp() {
  try {
    Logger.log("updateCategoriesTimestamp called");
    
    const props = PropertiesService.getUserProperties();
    const spreadsheetId = props.getProperty("BUDGET_SPREADSHEET_ID");
    
    if (!spreadsheetId) {
      return {
        success: false,
        error: "No spreadsheet ID found"
      };
    }
    
    const ss = SpreadsheetApp.openById(spreadsheetId);
    const setupSheet = ss.getSheetByName("Setup");
    if (!setupSheet) {
      return {
        success: false,
        error: "Setup sheet not found"
      };
    }
    
    // Write current timestamp to I50
    const now = new Date();
    setupSheet.getRange("I50").setValue(now);
    
    Logger.log("Categories timestamp updated to: " + now.toISOString());
    
    return {
      success: true,
      timestamp: now.toISOString()
    };
    
  } catch (error) {
    Logger.log("Error in updateCategoriesTimestamp: " + error.toString());
    return {
      success: false,
      error: error.toString()
    };
  }
}



/**
 * Get the master data timestamp from Dontedit!M88
 * @return {Object} {success: true, timestamp: "ISO_STRING"}
 */
function getMasterDataTimestamp() {
  try {
    const sheet = getBudgetSheet("Dontedit");
    if (!sheet) {
      return { success: false, error: "Dontedit sheet not found" };
    }
    
    const timestampCell = sheet.getRange("M88").getValue();
    
    if (!timestampCell) {
      // First time - set it
      const now = new Date();
      sheet.getRange("M88").setValue(now);
      return { success: true, timestamp: now.toISOString() };
    }
    
    const timestamp = timestampCell instanceof Date ? 
      timestampCell.toISOString() : 
      new Date(timestampCell).toISOString();
    
    return { success: true, timestamp: timestamp };
    
  } catch (error) {
    Logger.log("Error getting master timestamp: " + error.toString());
    return { success: false, error: error.toString() };
  }
}

/**
 * Update the master data timestamp to current time
 */
function updateMasterDataTimestamp() {
  try {
    const sheet = getBudgetSheet("Dontedit");
    if (!sheet) return;
    
    sheet.getRange("M88").setValue(new Date());
    Logger.log("Updated master data timestamp");
    
  } catch (error) {
    Logger.log("Error updating master timestamp: " + error.toString());
  }
}