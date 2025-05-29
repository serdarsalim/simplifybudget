// Server side code for transaction management
// This file contains functions to manage transactions, including getting, saving, and clearing transactions.

/**
 * Get active categories from setup sheet with improved caching
 * @param {boolean} useCache - Whether to use cached data if available (true by default)
 * @return {Object} Categories data and active status
 */
function getCategories(useCache = true) {
  try {
    const props = PropertiesService.getUserProperties();
    Logger.log("getCategories called with useCache=" + useCache);
    
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
    Logger.log("No cache or cache bypassed, getting from spreadsheet");
    const spreadsheetId = props.getProperty("BUDGET_SPREADSHEET_ID");
    
    if (!spreadsheetId) {
      return {
        success: false,
        error: "No spreadsheet ID found in user properties"
      };
    }
    
    // Open spreadsheet and get Setup sheet
    const ss = SpreadsheetApp.openById(spreadsheetId);
    const setupSheet = ss.getSheetByName("Setup");
    if (!setupSheet) {
      return {
        success: false,
        error: "Setup sheet not found"
      };
    }
    
    // Get category data from columns F and G (15:44)
    const range = setupSheet.getRange("F15:G44");
    const values = range.getValues();
    
    // Process categories
    const categories = [];
    const activeCategories = [];
    
    for (let i = 0; i < values.length; i++) {
      const isActive = values[i][0] === true; // Column F is checkbox (active/inactive)
      const categoryName = values[i][1];      // Column G is category name
      
      // Skip empty rows
      if (!categoryName || categoryName === "") continue;
      
      // Add to categories list
      categories.push(categoryName);
      
      // If active, add to active categories list
      if (isActive) {
        activeCategories.push(categoryName);
      }
    }
    
    // Save to user properties for caching
    props.setProperty("CACHED_CATEGORIES", JSON.stringify(categories));
    props.setProperty("ACTIVE_CATEGORIES", JSON.stringify(activeCategories));
    
    Logger.log("Returning categories from spreadsheet: " + categories.length + " total, " + 
               activeCategories.length + " active");
    
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


function getExpenseData(month, year) {
  
  if (month !== undefined && month !== null) {
    const testDate = new Date(year, month, 1);
    const monthName = testDate.toLocaleString('default', { month: 'long' });
  }
  
  try {
    // Default to current month/year if not provided
    if (month === undefined || month === null || year === undefined || year === null) {
      const now = new Date();
      month = now.getMonth();
      year = now.getFullYear();
    }
    
    // Ensure month and year are numbers
    month = parseInt(month);
    year = parseInt(year);
    
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);
    
    // Get the Dontedit sheet
    const donteditSheet = getBudgetSheet("Dontedit");
    if (!donteditSheet) {
      return { success: false, error: "Dontedit sheet not found" };
    }
    
    const lastRow = donteditSheet.getLastRow();
    
    // Updated header range to include GA4 column (Label)
    const headerRange = "FU4:GB4"; // Adjusted to include the ID column
    const headers = donteditSheet.getRange(headerRange).getValues()[0];
    
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
      'label': ['label', 'type', 'transaction type'],
      'transactionId': ['transactionid', 'transaction id', 'transaction_id', 'transactionId']
    };
    
    // Find the actual column indices
    const columns = {};
    Object.keys(requiredColumns).forEach(key => {
      let found = false;
      requiredColumns[key].forEach(variation => {
        if (!found && columnMap[variation] !== undefined) {
          columns[key] = columnMap[variation];
          found = true;
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
    const range = "FU" + startRow + ":GB" + endRow;
    
    const dataRange = donteditSheet.getRange(range);
    const expenseData = dataRange.getValues();
    
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
      
     const categoryString = categoryValue.toString().toLowerCase();
    if (categoryString.includes('income')) {
      incomeSkipped++; // Still track for logging but don't skip
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
          transactionId: (row[columns.transactionId] || "").toString(),
          amount: amount,
          label: label // Include the label field
        });
      } else {
        skippedCount++;
      }
    }
    

    
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
 * Enhanced setUserSettings - saves to sheet with timestamp
 * @param {Object} settings - The settings object to save
 * @return {Object} Result with success status and timestamp
 */
function setUserSettings(settings) {
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
    
    // ENHANCED: Add timestamp and version to settings
    const enhancedSettings = {
      settings: settings,
      timestamp: new Date().toISOString(),
      version: 1
    };
    
    // Save to L88 (same pattern as budget data in N86)
    sheet.getRange("L88").setValue(JSON.stringify(enhancedSettings));
    
    // Update cache with enhanced data
    props.setProperty("CACHED_SETTINGS_DATA", JSON.stringify(enhancedSettings));
    
    // ENHANCED: Return timestamp so client knows when data was saved
    return { 
      success: true, 
      timestamp: enhancedSettings.timestamp 
    };
    
  } catch (error) {
    Logger.log("Error in setUserSettings: " + error.toString());
    return { success: false, error: error.toString() };
  }
}

/**
 * Enhanced getUserSettings - reads from sheet with timestamp
 * @param {boolean} useCache - Whether to use cached data
 * @return {Object} Settings data with timestamp
 */
function getUserSettings(useCache = true) {
  try {
    const props = PropertiesService.getUserProperties();
    
    // Check cache first
    if (useCache) {
      const cached = props.getProperty("CACHED_SETTINGS_DATA");
      if (cached) {
        const parsedData = JSON.parse(cached);
        return {
          success: true,
          settings: parsedData.settings || parsedData, // Handle both formats
          timestamp: parsedData.timestamp,
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
    
    // Get settings JSON from L88
    const settingsCell = sheet.getRange("L88").getValue();
    
    if (!settingsCell) {
      // Return empty settings with current timestamp if no data yet
      const emptySettings = {
        settings: {},
        timestamp: new Date().toISOString(),
        version: 1
      };
      
      return { 
        success: true, 
        settings: emptySettings.settings,
        timestamp: emptySettings.timestamp
      };
    }
    
    let settingsData;
    try {
      settingsData = JSON.parse(settingsCell);
    } catch (e) {
      return { success: false, error: "Invalid JSON in settings cell: " + e.toString() };
    }
    
    // ENHANCED: If old data without timestamp, add one
    if (!settingsData.timestamp) {
      settingsData = {
        settings: settingsData,
        timestamp: new Date().toISOString(),
        version: 1
      };
      
      // Save back to sheet with timestamp
      sheet.getRange("L88").setValue(JSON.stringify(settingsData));
    }
    
    // Cache for next time
    props.setProperty("CACHED_SETTINGS_DATA", JSON.stringify(settingsData));
    
    return {
      success: true,
      settings: settingsData.settings,
      timestamp: settingsData.timestamp
    };
    
  } catch (error) {
    Logger.log("Error in getUserSettings: " + error.toString());
    return { success: false, error: error.toString() };
  }
}


/**
 * Enhanced saveBatchExpenses that reuses cleared rows
 */
function saveBatchExpenses(expenses) {
  const sh = getBudgetSheet("Expenses");
  if (!sh)  return { success: false, error: "Expenses sheet missing" };

  // 1) pull only col D, build map + empty‐row list
  const startRow = 5;
  const lastRow  = Math.max(sh.getLastRow(), startRow);
  const ids      = sh.getRange(startRow, 4, lastRow - startRow + 1).getValues().flat();
  const map = {};
  const holes = [];
  ids.forEach((id, i) => {
    const r = startRow + i;
    if (id)       map[id] = r;
    else if (holes.length < expenses.length) holes.push(r);
  });

  // 2) separate out updates vs inserts
  const toUpdate = [];
  const toInsert = [];
  for (const e of expenses) {
    if (!e.amount || +e.amount <= 0) continue;
    const row = map[e.transactionId];
    const values = [
      e.transactionId,
      new Date(e.date),
      +e.amount,
      e.category,
      e.name || e.description || "",
      e.label  || "",
      e.notes  || "",
      e.account|| ""
    ];
    if (row)       toUpdate.push({ row, values });
    else {
      const target = holes.length ? holes.shift() : ++lastRow;
      toInsert.push({ row: target, values });
      map[e.transactionId] = target;
    }
  }

  // 3) batch‐write updates
  toUpdate.forEach(u => {
    sh.getRange(u.row, 4, 1, 8).setValues([u.values]);
  });
  // 4) batch‐write inserts (they may not be contiguous—group if you can)
  toInsert.forEach(i => {
    sh.getRange(i.row, 4, 1, 8).setValues([i.values]);
  });
  // Update master timestamp
  updateMasterDataTimestamp();
  return {
    success: true,
    updated: toUpdate.length,
    inserted: toInsert.length,
    reused: expenses.length - toUpdate.length - toInsert.length
  };
}

/**
 * Clear a transaction row by ID (sets all cells to blank)
 * @param {string} transactionId - Transaction ID to clear
 * @return {Object} Result object with success status
 */
function clearTransactionRow(transactionId) {
  try {
    // Get the expenses sheet
    const sheet = getBudgetSheet("Expenses");
    if (!sheet) {
      return { success: false, error: "Expenses sheet not found" };
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
        error: "Transaction not found: " + transactionId
      };
    }
    
    // Determine the row of the found cell
    const rowIndex = finder.getRow();
    
    // Clear the cells in that row (columns D through K)
    sheet.getRange(rowIndex, 4, 1, 8).clearContent();
    
    // Update any caches
    const { month, year } = getCurrentMonthYear();
    // Update master timestamp
  updateMasterDataTimestamp();
    return {
      success: true,
      message: "Transaction row cleared successfully",
      transactionId,
      rowIndex
    };
    
  } catch (e) {
    Logger.log("Error in clearTransactionRow: " + e.toString());
    return { success: false, error: e.toString() };
  }
}

/**
 * Get current month and year
 * @return {Object} Object with month and year properties
 */
function getCurrentMonthYear() {
  const now = new Date();
  return {
    month: now.getMonth() + 1, // JavaScript months are 0-based
    year: now.getFullYear()
  };
}




/**
 * Simplified saveRecurringTransaction - Only handles columns C-M
 * Status and Next Payment are calculated in the app, not saved
 * @param {Array} recurring - Array of recurring transaction objects
 * @return {Object} Result object
 */
function saveRecurringTransaction(recurring) {
  try {
    const props = PropertiesService.getUserProperties();
    const spreadsheetId = props.getProperty("BUDGET_SPREADSHEET_ID");
    
    if (!spreadsheetId) {
      return { success: false, error: "No spreadsheet ID found" };
    }

    const ss = SpreadsheetApp.openById(spreadsheetId);
    const sheet = ss.getSheetByName("Recurring");
    
    if (!sheet) {
      return { success: false, error: "Recurring sheet not found" };
    }

    // Read headers from row 5, columns C-M (11 columns)
    const headerRow = 5;
    const firstColumn = 3; // Column C
    const numColumns = 11; // C through M
    
    const headers = sheet.getRange(headerRow, firstColumn, 1, numColumns).getValues()[0];
    console.log("Headers found:", headers);
    
    // Build column map
    const columnMap = {};
    const headerMappings = {
      'transactionid': 'id',
      'transaction id': 'id',
      'start date': 'startDate',
      'dstart': 'startDate',
      'name': 'name',
      'category': 'category',
      'type': 'type',
      'frequency': 'frequency',
      'amount': 'amount',
      'account': 'account',
      'end date': 'endDate',
      'enddate': 'endDate',
      'owner': 'owner',
      'notes': 'notes',
      'note': 'notes'
    };
    
    headers.forEach((header, index) => {
      if (header) {
        const cleanHeader = header.toString().trim().toLowerCase();
        Object.keys(headerMappings).forEach(key => {
          if (cleanHeader.includes(key)) {
            columnMap[headerMappings[key]] = index;
          }
        });
      }
    });

    // Build ID map from existing data
    const startRow = 6;
    const lastRow = Math.max(sheet.getLastRow(), startRow);
    
    // Read only the ID column
    const idColumnNumber = firstColumn + (columnMap.id || 0);
    const ids = sheet.getRange(startRow, idColumnNumber, lastRow - startRow + 1).getValues().flat();
    
    const map = {};
    const holes = [];
    
    ids.forEach((id, i) => {
      const r = startRow + i;
      if (id) {
        map[id] = r;
      } else if (holes.length < recurring.length) {
        holes.push(r);
      }
    });

    // Prepare data for saving
    const toUpdate = [];
    const toInsert = [];
    
    for (const item of recurring) {
      if (!item.amount || parseFloat(item.amount) <= 0) continue;
      
      const row = map[item.id];
      
      // Create values array
      const values = new Array(numColumns);
      
      // Fill values based on mapping
      if (columnMap.id !== undefined) {
        values[columnMap.id] = item.id || `REC-${Date.now()}`;
      }
      
      if (columnMap.startDate !== undefined) {
        values[columnMap.startDate] = item.startDate ? new Date(item.startDate) : new Date();
      }
      
      if (columnMap.name !== undefined) {
        values[columnMap.name] = item.name || '';
      }
      
      if (columnMap.category !== undefined) {
        values[columnMap.category] = item.category || '';
      }
      
      if (columnMap.type !== undefined) {
        // Write "TRUE" or "FALSE" as strings
        values[columnMap.type] = item.type || 'TRUE';
      }
      
      if (columnMap.frequency !== undefined) {
        values[columnMap.frequency] = item.frequency || 'Monthly';
      }
      
      if (columnMap.amount !== undefined) {
        values[columnMap.amount] = parseFloat(item.amount) || 0;
      }
      
      if (columnMap.account !== undefined) {
        values[columnMap.account] = item.account || '';
      }
      
      if (columnMap.endDate !== undefined) {
        values[columnMap.endDate] = item.endDate ? new Date(item.endDate) : '';
      }
      
      if (columnMap.owner !== undefined) {
        values[columnMap.owner] = ''; // Always empty for now
      }
      
      if (columnMap.notes !== undefined) {
        values[columnMap.notes] = item.notes || '';
      }
      
      if (row) {
        toUpdate.push({ row, values });
      } else {
        const target = holes.length ? holes.shift() : ++lastRow;
        toInsert.push({ row: target, values });
        map[item.id] = target;
      }
    }

    // Batch write data
    toUpdate.forEach(u => {
      sheet.getRange(u.row, firstColumn, 1, numColumns).setValues([u.values]);
    });
    
    toInsert.forEach(i => {
      sheet.getRange(i.row, firstColumn, 1, numColumns).setValues([i.values]);
    });

      // Update master timestamp
  updateMasterDataTimestamp();

    return {
      success: true,
      updated: toUpdate.length,
      inserted: toInsert.length,
      reused: recurring.length - toUpdate.length - toInsert.length
    };

  } catch (error) {
    Logger.log("Error in saveRecurringTransaction: " + error.toString());
    return { success: false, error: error.toString() };
  }
}

/**
 * Simplified clearRecurringTransaction - Only clears columns C-M
 * @param {string} transactionId - Transaction ID to clear
 * @return {Object} Result object
 */
function clearRecurringTransaction(transactionId) {
  try {
    const props = PropertiesService.getUserProperties();
    const spreadsheetId = props.getProperty("BUDGET_SPREADSHEET_ID");
    
    if (!spreadsheetId) {
      return { success: false, error: "No spreadsheet ID found" };
    }

    const ss = SpreadsheetApp.openById(spreadsheetId);
    const sheet = ss.getSheetByName("Recurring");
    
    if (!sheet) {
      return { success: false, error: "Recurring sheet not found" };
    }

    // Find the transaction
    const finder = sheet.createTextFinder(transactionId.toString())
                       .matchEntireCell(true)
                       .matchCase(false)
                       .useRegularExpression(false)
                       .findNext();
    
    if (!finder) {
      return {
        success: false,
        error: "Recurring transaction not found: " + transactionId
      };
    }

    const rowIndex = finder.getRow();
    
    // Clear only columns C through M (11 columns)
    sheet.getRange(rowIndex, 3, 1, 11).clearContent();
    // Update any caches
    updateMasterDataTimestamp()
    
    return {
      success: true,
      message: "Recurring transaction row cleared successfully",
      transactionId: transactionId,
      rowIndex: rowIndex
    };

  } catch (error) {
    Logger.log("Error in clearRecurringTransaction: " + error.toString());
    return { success: false, error: error.toString() };
  }
}

/**
 * Updated getRecurringData - Only reads columns C-M
 * Status and Next Payment are calculated client-side
 * @return {Object} Result with recurring transactions data
 */
function getRecurringData() {
  console.log("=== SERVER RECURRING DATA FETCH ===");
  
  try {
    const props = PropertiesService.getUserProperties();
    const spreadsheetId = props.getProperty("BUDGET_SPREADSHEET_ID");
    
    if (!spreadsheetId) {
      return { success: false, error: "No spreadsheet ID found" };
    }

    const ss = SpreadsheetApp.openById(spreadsheetId);
    const recurringSheet = ss.getSheetByName("Recurring");
    
    if (!recurringSheet) {
      return { success: false, error: "Recurring sheet not found" };
    }

    // Headers are at C5:M5 (11 columns)
    const headerRange = "C5:M5";
    const headers = recurringSheet.getRange(headerRange).getValues()[0];
    console.log("Recurring headers found: " + JSON.stringify(headers));
    
    // Build column map
    const columnMap = {};
    const expectedHeaders = {
      'transactionI': ['transactioni', 'transaction id', 'id'],
      'startDate': ['dstart', 'start date', 'start'],
      'name': ['name', 'subscription name', 'title'],
      'category': ['category', 'cat'],
      'type': ['type', 'subscription type'],
      'frequency': ['frequency', 'freq'],
      'amount': ['amount', 'cost', 'price'],
      'account': ['account', 'payment method', 'acc'],
      'endDate': ['end date', 'enddate', 'expiry'],
      'owner': ['owner'],
      'notes': ['notes', 'note', 'comments', 'memo']
    };

    // Map headers to column indices
    headers.forEach((header, index) => {
      if (header && typeof header === 'string') {
        const cleanHeader = header.toString().trim().toLowerCase();
        
        Object.keys(expectedHeaders).forEach(key => {
          expectedHeaders[key].forEach(variation => {
            if (cleanHeader.includes(variation)) {
              if (!columnMap[key]) {
                columnMap[key] = index;
                console.log("Mapped " + key + " to column " + index + " (" + header + ")");
              }
            }
          });
        });
      }
    });

    // Read data from C6:M500
    const dataRange = "C6:M500";
    const lastRow = recurringSheet.getLastRow();
    const actualRange = "C6:M" + Math.min(500, lastRow);
    
    console.log("Reading recurring data from range: " + actualRange);
    const recurringData = recurringSheet.getRange(actualRange).getValues();
    console.log("Successfully read " + recurringData.length + " rows");

    const recurring = [];
    let processedCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < recurringData.length; i++) {
      const row = recurringData[i];
      
      // Skip empty rows
      if (!row || row.every(cell => !cell || cell.toString().trim() === '')) {
        skippedCount++;
        continue;
      }

      // Extract data using column mapping
      const transactionId = columnMap.transactionI !== undefined ? row[columnMap.transactionI] : '';
      const name = columnMap.name !== undefined ? row[columnMap.name] : '';
      const amount = columnMap.amount !== undefined ? row[columnMap.amount] : 0;
      
      // Skip rows without essential data
      if (!name || !amount) {
        skippedCount++;
        continue;
      }

      // Parse dates
      const startDateValue = columnMap.startDate !== undefined ? row[columnMap.startDate] : null;
      const endDateValue = columnMap.endDate !== undefined ? row[columnMap.endDate] : null;

      let startDate = null;
      let endDate = null;

      if (startDateValue) {
        startDate = startDateValue instanceof Date ? startDateValue.toISOString() : new Date(startDateValue).toISOString();
      }
      if (endDateValue) {
        endDate = endDateValue instanceof Date ? endDateValue.toISOString() : new Date(endDateValue).toISOString();
      }

      // Parse amount
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount)) {
        skippedCount++;
        continue;
      }

      recurring.push({
        id: transactionId || "recurring-" + (i + 6),
        rowIndex: i + 6,
        startDate: startDate,
        endDate: endDate,
        name: name.toString(),
        category: columnMap.category !== undefined ? row[columnMap.category].toString() : '',
        type: columnMap.type !== undefined ? row[columnMap.type].toString() : '',
        frequency: columnMap.frequency !== undefined ? row[columnMap.frequency].toString() : 'Monthly',
        amount: parsedAmount,
        account: columnMap.account !== undefined ? row[columnMap.account].toString() : '',
        owner: columnMap.owner !== undefined ? row[columnMap.owner].toString() : '',
        notes: columnMap.notes !== undefined ? row[columnMap.notes].toString() : ''
        // Status and nextPayment will be calculated client-side
      });

      processedCount++;
    }




    return {
      success: true,
      recurring: recurring,
      meta: {
        totalRows: recurringData.length,
        processedRows: processedCount,
        skippedRows: skippedCount,
        range: actualRange,
        columnMap: columnMap
      }
    };

  } catch (error) {
    console.log("ERROR in getRecurringData: " + error.toString());
    return { 
      success: false, 
      error: error.toString() 
    };
  }
}


/**
 * Enhanced saveBudgetData function with timestamp support
 * Saves to Dontedit sheet, cell N86 with embedded timestamp
 * @param {Object} budgetData - Complete budget data object
 * @return {Object} Result with success status and timestamp
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
    
    // ENHANCED: Add timestamp and version to the budget data
    const enhancedBudgetData = {
      ...budgetData,
      timestamp: new Date().toISOString(),
      version: 1
    };
    
    // Save to N86 (same cell as before, but with timestamp)
    sheet.getRange("N86").setValue(JSON.stringify(enhancedBudgetData));
    
    // Update cache with enhanced data
    props.setProperty("CACHED_BUDGET_DATA", JSON.stringify(enhancedBudgetData));
    
    // Clear dashboard cache since budget changed
    props.deleteProperty("CACHED_DASHBOARD_DATA");
    
    // ENHANCED: Return the timestamp so client knows when data was saved
    return { 
      success: true, 
      timestamp: enhancedBudgetData.timestamp 
    };
    
  } catch (error) {
    Logger.log("Error in saveBudgetData: " + error.toString());
    return { success: false, error: error.toString() };
  }
}

/**
 * Enhanced getBudgetData function with timestamp support
 * @param {boolean} useCache - Whether to use cached data
 * @return {Object} Budget data with timestamp
 */
function getBudgetData(useCache = true) {
  try {
    const props = PropertiesService.getUserProperties();
    
    // Check cache first
    if (useCache) {
      const cached = props.getProperty("CACHED_BUDGET_DATA");
      if (cached) {
        const parsedData = JSON.parse(cached);
        return {
          success: true,
          budgetData: parsedData,
          timestamp: parsedData.timestamp, // Extract timestamp
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
      // Return empty object with current timestamp if no data yet
      const emptyData = {
        categories: [],
        budgets: {},
        timestamp: new Date().toISOString(),
        version: 1
      };
      
      return { 
        success: true, 
        budgetData: emptyData,
        timestamp: emptyData.timestamp
      };
    }
    
    let budgetData;
    try {
      budgetData = JSON.parse(budgetCell);
    } catch (e) {
      return { success: false, error: "Invalid JSON in budget cell: " + e.toString() };
    }
    
    // ENHANCED: If old data without timestamp, add one
    if (!budgetData.timestamp) {
      budgetData.timestamp = new Date().toISOString();
      budgetData.version = 1;
      
      // Save back to spreadsheet with timestamp
      sheet.getRange("N86").setValue(JSON.stringify(budgetData));
    }
    
    // Cache for next time
    props.setProperty("CACHED_BUDGET_DATA", JSON.stringify(budgetData));
    
    return {
      success: true,
      budgetData: budgetData,
      timestamp: budgetData.timestamp
    };
    
  } catch (error) {
    Logger.log("Error in getBudgetData: " + error.toString());
    return { success: false, error: error.toString() };
  }
}