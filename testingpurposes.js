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
    
    // Get category data from columns F and G (15:44) - REUSE YOUR LOGIC
    const range = setupSheet.getRange("F15:G44");
    const values = range.getValues();
    
    const categories = [];
    const activeCategories = [];
    
    for (let i = 0; i < values.length; i++) {
      const isActive = values[i][0] === true; // Column F is checkbox
      const categoryName = values[i][1];      // Column G is category name
      
      if (!categoryName || categoryName === "") continue;
      
      categories.push(categoryName);
      
      if (isActive) {
        activeCategories.push(categoryName);
      }
    }
    
    Logger.log("Returning categories with timestamp: " + categories.length + " total, " + 
               activeCategories.length + " active, timestamp: " + timestamp);
    
    return {
      success: true,
      categories: categories,
      activeCategories: activeCategories,
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
 * Get categories from UserProperties
 */
function getCategoriesFromUserProperties() {
  try {
    const userProps = PropertiesService.getUserProperties();
    const categoriesJson = userProps.getProperty('categories');
    
    if (categoriesJson) {
      const categories = JSON.parse(categoriesJson);
      return {
        success: true,
        categories: categories
      };
    } else {
      return {
        success: true,
        categories: [] // Empty array = no categories stored yet
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * Save categories to UserProperties
 */
function saveCategoriestoUserProperties(categories) {
  try {
    const userProps = PropertiesService.getUserProperties();
    userProps.setProperty('categories', JSON.stringify(categories));
    
    return {
      success: true,
      message: 'Categories saved to UserProperties'
    };
  } catch (error) {
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * Clear categories from UserProperties
 */
function clearCategoriesFromUserProperties() {
  try {
    const userProps = PropertiesService.getUserProperties();
    userProps.deleteProperty('categories');
    
    return {
      success: true,
      message: 'Categories cleared from UserProperties'
    };
  } catch (error) {
    return {
      success: false,
      error: error.toString()
    };
  }
}