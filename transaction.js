// SERVER-SIDE CODE: Add to transaction.js (server-side)

/**
 * Get active categories from setup sheet with caching
 * @param {boolean} useCache - Whether to use cached data if available
 * @return {Object} Categories data and active status
 */
function getCategories(useCache = true) {
  try {
    const props = PropertiesService.getUserProperties();
    
    // Check for cached data if useCache is true
    if (useCache) {
      const cachedCategories = props.getProperty("CACHED_CATEGORIES");
      const cachedActiveCategories = props.getProperty("ACTIVE_CATEGORIES");
      
      if (cachedCategories && cachedActiveCategories) {
        Logger.log("Using cached categories data from user properties");
        return {
          success: true,
          categories: JSON.parse(cachedCategories),
          activeCategories: JSON.parse(cachedActiveCategories),
          fromCache: true
        };
      }
    }
    
    // No cache or cache bypassed, get data from spreadsheet
    const spreadsheetId = props.getProperty("BUDGET_SPREADSHEET_ID");
    
    if (!spreadsheetId) {
      return {
        success: false,
        error: "No spreadsheet ID found in user properties"
      };
    }
    
    // Open spreadsheet
    const ss = SpreadsheetApp.openById(spreadsheetId);
    
    // Get Setup sheet
    const setupSheet = ss.getSheetByName("Setup");
    if (!setupSheet) {
      return {
        success: false,
        error: "Setup sheet not found"
      };
    }
    
    // Get category names from range G15:G44
    const categoryRange = setupSheet.getRange("G15:G44").getValues();
    
    // Get active status from range F15:F44
    const activeRange = setupSheet.getRange("F15:F44").getValues();
    
    // Process into category array
    const categories = [];
    for (let i = 0; i < categoryRange.length; i++) {
      const category = categoryRange[i][0];
      
      // Only add non-empty categories
      if (category && category.trim() !== "") {
        categories.push(category);
      }
    }
    
    // Filter for only active categories
    const activeCategories = categories.filter((cat, i) => {
      const index = categoryRange.findIndex(row => row[0] === cat);
      return index >= 0 && (activeRange[index][0] === true || activeRange[index][0] === "TRUE");
    });
    
    // Store data in user properties for caching
    props.setProperty("CACHED_CATEGORIES", JSON.stringify(categories));
    props.setProperty("ACTIVE_CATEGORIES", JSON.stringify(activeCategories));
    
    // Return both full list and active status
    return {
      success: true,
      categories: categories,
      activeCategories: activeCategories
    };
  } catch (error) {
    Logger.log("Error in getCategories: " + error.toString());
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * Update a category's active status in the spreadsheet
 * @param {string} categoryName - The name of the category to update
 * @param {boolean} active - The new active status
 * @return {Object} Status object with success/error
 */
function updateCategoryStatus(categoryName, active) {
  try {
    const props = PropertiesService.getUserProperties();
    const spreadsheetId = props.getProperty("BUDGET_SPREADSHEET_ID");
    
    if (!spreadsheetId) {
      return {
        success: false,
        error: "No spreadsheet ID found in user properties"
      };
    }
    
    // Open spreadsheet
    const ss = SpreadsheetApp.openById(spreadsheetId);
    
    // Get Setup sheet
    const setupSheet = ss.getSheetByName("Setup");
    if (!setupSheet) {
      return {
        success: false,
        error: "Setup sheet not found"
      };
    }
    
    // Get category names to find the row
    const categoryRange = setupSheet.getRange("G15:G44").getValues();
    
    // Find the row for this category
    let rowIndex = -1;
    for (let i = 0; i < categoryRange.length; i++) {
      if (categoryRange[i][0] === categoryName) {
        rowIndex = i + 15; // Range starts at row 15
        break;
      }
    }
    
    if (rowIndex === -1) {
      return {
        success: false,
        error: "Category not found in spreadsheet"
      };
    }
    
    // Update the active status in column F
    setupSheet.getRange(rowIndex, 6).setValue(active);
    
    // Also update user properties for consistency
    // First get the current active categories
    let activeCategories = [];
    const cachedActive = props.getProperty("ACTIVE_CATEGORIES");
    if (cachedActive) {
      activeCategories = JSON.parse(cachedActive);
    }
    
    // Update the active categories list
    if (active) {
      // Add to active if not already there
      if (!activeCategories.includes(categoryName)) {
        activeCategories.push(categoryName);
      }
    } else {
      // Remove from active
      activeCategories = activeCategories.filter(cat => cat !== categoryName);
    }
    
    // Save back to user properties
    props.setProperty("ACTIVE_CATEGORIES", JSON.stringify(activeCategories));
    
    return {
      success: true,
      activeCategories: activeCategories
    };
  } catch (error) {
    Logger.log("Error in updateCategoryStatus: " + error.toString());
    return {
      success: false,
      error: error.toString()
    };
  }
}