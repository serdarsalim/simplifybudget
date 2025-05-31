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





// ======== INCOME SERVER FUNCTIONS ========

// ======== FIXED INCOME SERVER FUNCTIONS WITH CORRECT HEADERS ========

/**
 * Get income data from Income sheet range D4:J6000 
 * Headers: transactionId | Date | Amount | Name | Account | Source | Notes 📝
 * @return {Object} Result with income transactions data
 */
function getIncomeData() {
  console.log("=== SERVER INCOME DATA FETCH ===");
  
  try {
    const props = PropertiesService.getUserProperties();
    const spreadsheetId = props.getProperty("BUDGET_SPREADSHEET_ID");
    
    if (!spreadsheetId) {
      return { success: false, error: "No spreadsheet ID found" };
    }

    const ss = SpreadsheetApp.openById(spreadsheetId);
    const incomeSheet = ss.getSheetByName("Income");
    
    if (!incomeSheet) {
      return { success: false, error: "Income sheet not found" };
    }

    // Headers are at D4:J4 (7 columns)
    // D=transactionId, E=Date, F=Amount, G=Name, H=Account, I=Source, J=Notes
    const headerRange = "D4:J4";
    const headers = incomeSheet.getRange(headerRange).getValues()[0];
    console.log("Income headers found: " + JSON.stringify(headers));
    
    // Direct column mapping based on known positions
    const columnMap = {
      transactionId: 0,  // Column D
      date: 1,           // Column E  
      amount: 2,         // Column F
      name: 3,           // Column G
      account: 4,        // Column H
      source: 5,         // Column I
      notes: 6           // Column J
    };

    // Read data from D5:J6000
    const dataRange = "D5:J6000";
    const lastRow = incomeSheet.getLastRow();
    const actualRange = "D5:J" + Math.min(6000, lastRow);
    
    console.log("Reading income data from range: " + actualRange);
    const incomeData = incomeSheet.getRange(actualRange).getValues();
    console.log("Successfully read " + incomeData.length + " rows");

    const income = [];
    let processedCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < incomeData.length; i++) {
      const row = incomeData[i];
      
      // Skip empty rows
      if (!row || row.every(cell => !cell || cell.toString().trim() === '')) {
        skippedCount++;
        continue;
      }

      // Extract data using direct column mapping
      const transactionId = row[columnMap.transactionId] || '';
      const date = row[columnMap.date];
      const amount = row[columnMap.amount];
      const name = row[columnMap.name] || '';
      const account = row[columnMap.account] || '';
      const source = row[columnMap.source] || 'Other';
      const notes = row[columnMap.notes] || '';
      
      // Skip rows without essential data
      if (!amount || parseFloat(amount) <= 0) {
        skippedCount++;
        continue;
      }

      // Parse date
      let incomeDate = null;
      if (date) {
        if (date instanceof Date) {
          incomeDate = date.toISOString();
        } else {
          incomeDate = new Date(date).toISOString();
        }
      }

      // Parse amount
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount)) {
        skippedCount++;
        continue;
      }

      income.push({
        id: transactionId || "INC-" + (i + 5),
        rowIndex: i + 5,
        date: incomeDate,
        name: name.toString(),
        category: 'Income 💵', // Default category since not in sheet
        amount: parsedAmount,
        account: account.toString(),
        source: source.toString(),
        notes: notes.toString()
      });

      processedCount++;
    }

    return {
      success: true,
      income: income,
      meta: {
        totalRows: incomeData.length,
        processedRows: processedCount,
        skippedRows: skippedCount,
        range: actualRange,
        columnMap: columnMap
      }
    };

  } catch (error) {
    console.log("ERROR in getIncomeData: " + error.toString());
    return { 
      success: false, 
      error: error.toString() 
    };
  }
}

/**
 * Save batch income transactions - FIXED with correct column order
 * D=transactionId, E=Date, F=Amount, G=Name, H=Account, I=Source, J=Notes
 */
function saveBatchIncome(income) {
  const sh = getBudgetSheet("Income");
  if (!sh) return { success: false, error: "Income sheet missing" };

  // 1) pull only col D (transactionId), build map + empty‐row list
  const startRow = 5;
  const lastRow = Math.max(sh.getLastRow(), startRow);
  const ids = sh.getRange(startRow, 4, lastRow - startRow + 1).getValues().flat(); // Column D = 4
  const map = {};
  const holes = [];
  ids.forEach((id, i) => {
    const r = startRow + i;
    if (id) map[id] = r;
    else if (holes.length < income.length) holes.push(r);
  });

  // 2) separate out updates vs inserts
  const toUpdate = [];
  const toInsert = [];
  for (const e of income) {
    if (!e.amount || +e.amount <= 0) continue;
    const row = map[e.id];
    
    // Create values array matching exact header order: D=transactionId, E=Date, F=Amount, G=Name, H=Account, I=Source, J=Notes
    const values = [
      e.id,                           // D - transactionId
      new Date(e.date),              // E - Date  
      +e.amount,                     // F - Amount
      e.name || e.description || "", // G - Name
      e.account || "",               // H - Account
      e.source || "Other",           // I - Source
      e.notes || ""                  // J - Notes
    ];
    
    if (row) {
      toUpdate.push({ row, values });
    } else {
      const target = holes.length ? holes.shift() : ++lastRow;
      toInsert.push({ row: target, values });
      map[e.id] = target;
    }
  }

  // 3) batch‐write updates (D:J = 7 columns)
  toUpdate.forEach(u => {
    sh.getRange(u.row, 4, 1, 7).setValues([u.values]);
  });
  
  // 4) batch‐write inserts (D:J = 7 columns)
  toInsert.forEach(i => {
    sh.getRange(i.row, 4, 1, 7).setValues([i.values]);
  });
  
  // Update master timestamp
  updateMasterDataTimestamp();
  
  return {
    success: true,
    updated: toUpdate.length,
    inserted: toInsert.length,
    reused: income.length - toUpdate.length - toInsert.length
  };
}

/**
 * Clear income transaction row by ID - searches column D, clears D:J
 * @param {string} transactionId - Transaction ID to clear
 * @return {Object} Result object with success status
 */
function clearIncomeRow(transactionId) {
  try {
    // Get the income sheet
    const sheet = getBudgetSheet("Income");
    if (!sheet) {
      return { success: false, error: "Income sheet not found" };
    }
    
    // Use TextFinder to locate the exact ID in column D
    const finder = sheet.createTextFinder(transactionId.toString())
                       .matchEntireCell(true)
                       .matchCase(false)
                       .useRegularExpression(false)
                       .findNext();
    if (!finder) {
      return {
        success: false,
        error: "Income transaction not found: " + transactionId
      };
    }
    
    // Determine the row of the found cell
    const rowIndex = finder.getRow();
    
    // Clear the cells in that row (columns D through J = 7 columns)
    sheet.getRange(rowIndex, 4, 1, 7).clearContent();
    
    // Update master timestamp
    updateMasterDataTimestamp();
    
    return {
      success: true,
      message: "Income transaction row cleared successfully",
      transactionId,
      rowIndex
    };
    
  } catch (e) {
    Logger.log("Error in clearIncomeRow: " + e.toString());
    return { success: false, error: e.toString() };
  }
}


/**
 * Update a category name and/or emoji in the Setup sheet
 * @param {string} oldFullName - Current full name "Food 🍕" 
 * @param {string} newName - New category name "Groceries"
 * @param {string} newEmoji - New emoji "🛒"
 * @return {Object} Success response or error
 */
function updateCategoryName(oldFullName, newName, newEmoji) {
  try {
    Logger.log("updateCategoryName called with:", { oldFullName, newName, newEmoji });
    
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
    
    // Get category data from G15:G44
    const range = setupSheet.getRange("G15:G44");
    const values = range.getValues();
    
    // Find the category to update
    let categoryRowIndex = -1;
    for (let i = 0; i < values.length; i++) {
      const currentValue = values[i][0];
      if (currentValue && currentValue.toString().trim() === oldFullName.trim()) {
        categoryRowIndex = i;
        break;
      }
    }
    
    if (categoryRowIndex === -1) {
      // If exact match not found, try to find by name part
      for (let i = 0; i < values.length; i++) {
        const currentValue = values[i][0];
        if (currentValue && currentValue.toString().includes(newName)) {
          categoryRowIndex = i;
          break;
        }
      }
    }
    
    if (categoryRowIndex === -1) {
      return {
        success: false,
        error: "Category not found in Setup sheet: " + oldFullName
      };
    }
    
    // Validate inputs
    if (!newName || !newName.trim()) {
      return {
        success: false,
        error: "Category name cannot be empty"
      };
    }
    
    if (!newEmoji || !newEmoji.trim()) {
      return {
        success: false,
        error: "Category emoji cannot be empty"
      };
    }
    
    // Create the new full name
    const newFullName = `${newName.trim()} ${newEmoji.trim()}`;
    
    // Check for duplicates (exclude current row)
    for (let i = 0; i < values.length; i++) {
      if (i !== categoryRowIndex && values[i][0] && 
          values[i][0].toString().trim() === newFullName) {
        return {
          success: false,
          error: "A category with this name and emoji already exists"
        };
      }
    }
    
    // Update the category in the spreadsheet
    const actualRowNumber = categoryRowIndex + 15; // G15 is row 15
    setupSheet.getRange(actualRowNumber, 7).setValue(newFullName); // Column G
    
    // AWESOMICO: Update the named range to point to the new value
    // The zategory named ranges will automatically reference the updated cell
    const zategoryNumber = categoryRowIndex + 1;
    const namedRangeName = `zategory${zategoryNumber}`;
    
    try {
      // The named range should already exist and point to G15+categoryRowIndex
      // Since we updated that cell, the named range will automatically resolve to new value
      Logger.log(`Named range ${namedRangeName} will automatically reference new value: ${newFullName}`);
    } catch (namedRangeError) {
      Logger.log("Note: Named range update not required - automatic reference: " + namedRangeError.toString());
    }
    
    // Update categories timestamp
    try {
      setupSheet.getRange("I50").setValue(new Date());
      Logger.log("Updated categories timestamp");
    } catch (timestampError) {
      Logger.log("Warning: Could not update categories timestamp: " + timestampError.toString());
    }
    
    // Clear cache to force refresh
    try {
      props.deleteProperty("CACHED_CATEGORIES");
      props.deleteProperty("ACTIVE_CATEGORIES");
      Logger.log("Cleared categories cache");
    } catch (cacheError) {
      Logger.log("Warning: Could not clear cache: " + cacheError.toString());
    }
    
    Logger.log("Successfully updated category: " + oldFullName + " → " + newFullName);
    
    return {
      success: true,
      oldFullName: oldFullName,
      newFullName: newFullName,
      message: "Category updated successfully"
    };
    
  } catch (error) {
    Logger.log("Error in updateCategoryName: " + error.toString());
    return {
      success: false,
      error: error.toString()
    };
  }
}