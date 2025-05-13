// Code.gs - Server-side logic for SimBudget

/**
 * SimBudget - Google Sheets Budget Management App
 * Built on the Architecture of WriteAway CMS
 * 
 * Main server-side script file for SimBudget
 */

/** 
 * Core function list:
 * onOpen() - Creates custom menu when spreadsheet is opened
 * doGet() - Returns HTML service for webapp UI
 * include() - Includes HTML template by file name
 * getSheetByStoredIds() - Gets sheet using stored spreadsheet and sheet IDs
 * setBudgetSheetUrl() - Sets the budget sheet URL for the current session
 * parseSheetUrl() - Parses Google Sheet URL to extract IDs
 * verifySheetUrl() - Verifies Google Sheet URL and extracts IDs
 * getBudgetData() - Gets budget summary data
 * getExpenseData() - Gets expense transaction data
 * getIncomeData() - Gets income transaction data
 * getNetWorthData() - Gets net worth data
 * getRecurringData() - Gets recurring payments data
 * saveExpense() - Saves an expense with account balance adjustment
 * saveIncome() - Saves income with account balance adjustment
 * setCurrentMonthYear() - Sets the current month and year in the budget sheet
 * setMonthYear() - Sets specific month and year in the budget sheet
 * 
 * // Utility functions
 * getUserCredentials() - Retrieves user credentials from UserProperties
 * setUserProperty() - Sets a user property
 * getCurrentUserEmail() - Gets current user's email address
 * formatCurrency() - Formats number as currency
 * testServerConnection() - Tests server communication
 */

/**
 * Creates a custom menu when the spreadsheet is opened
 */
function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu("SimBudget")
      .addItem("Launch SimBudget", "showSimBudgetApp")
      .addItem("Settings", "showSettingsDialog")
      .addToUi();
  } catch (error) {
    Logger.log("Error in onOpen: " + error.toString());
  }
}

/**
 * Shows the SimBudget app in a modeless dialog
 */
function showSimBudgetApp() {
  const html = HtmlService.createTemplateFromFile("Index")
    .evaluate()
    .setWidth(1400)
    .setHeight(900)
    .setTitle("SimBudget");

  SpreadsheetApp.getUi().showModelessDialog(html, "SimBudget");
}

/**
 * Shows settings dialog
 */
function showSettingsDialog() {
  // We'll actually include Settings in the main app, but this is for direct access
  const html = HtmlService.createTemplateFromFile("Settings")
    .evaluate()
    .setWidth(600)
    .setHeight(400)
    .setTitle("SimBudget Settings");

  SpreadsheetApp.getUi().showModalDialog(html, "Settings");
}

/**
 * Returns the HTML content for the web app
 */
function doGet() {
  return HtmlService.createTemplateFromFile("Index")
    .evaluate()
    .setTitle("SimBudget")
    .addMetaTag("viewport", "width=device-width, initial-scale=1");
}

/**
 * Includes an HTML file in another HTML file
 * @param {string} filename - The name of the file to include
 * @return {string} The contents of the file
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Sets the budget sheet URL for the current session
 * @param {string} url - The Google Sheet URL
 * @return {Object} Success response or error
 */
function setBudgetSheetUrl(url) {
  try {
    Logger.log("Setting budget sheet URL: " + url);
    
    if (!url) {
      return { 
        success: false, 
        error: "No URL provided" 
      };
    }
    
    // Store in user properties
    PropertiesService.getUserProperties().setProperty('BUDGET_SHEET_URL', url);
    
    // Verify it was stored correctly
    const storedUrl = PropertiesService.getUserProperties().getProperty('BUDGET_SHEET_URL');
    Logger.log("Successfully stored URL: " + storedUrl);
    
    return { 
      success: true,
      message: "URL set successfully"
    };
  } catch (error) {
    Logger.log("Error setting sheet URL: " + error);
    return { 
      success: false, 
      error: error.toString() 
    };
  }
}

/**
 * Parse a Google Sheet URL to extract spreadsheet ID and sheet GID
 * @param {string} url - Full Google Sheet URL
 * @return {Object} Object with spreadsheetId and sheetId
 */
function parseSheetUrl(url) {
  try {
    // Extract spreadsheet ID
    const spreadsheetIdMatch = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    const spreadsheetId = spreadsheetIdMatch ? spreadsheetIdMatch[1] : null;
    
    // Extract GID
    const gidMatch = url.match(/[#&]gid=([0-9]+)/);
    const sheetId = gidMatch ? gidMatch[1] : null;
    
    return {
      success: true,
      spreadsheetId: spreadsheetId,
      sheetId: sheetId
    };
  } catch (error) {
    return {
      success: false,
      error: "Could not parse Sheet URL: " + error.toString()
    };
  }
}

/**
 * Verify a Google Sheet URL and extract its IDs
 * @param {string} url - The Sheet URL to verify
 * @return {Object} Result indicating if sheet is accessible
 */
function verifySheetUrl(url) {
  try {
    if (!url) return { success: false, error: "No URL provided" };
    
    // Parse the URL to extract IDs
    const parsedUrl = parseSheetUrl(url);
    if (!parsedUrl.success) return parsedUrl;
    
    const { spreadsheetId, sheetId } = parsedUrl;
    
    // Validate both IDs exist
    if (!spreadsheetId) return { success: false, error: "Could not extract spreadsheet ID from URL" };
    
    // Try to access the sheet to verify permissions
    try {
      const ss = SpreadsheetApp.openById(spreadsheetId);
      
      // If no specific sheet ID, return success
      if (!sheetId) {
        return { success: true, message: "Sheet URL verified and accessible" };
      }
      
      // Otherwise verify the specific sheet exists
      const sheets = ss.getSheets();
      let found = false;
      
      for (const sheet of sheets) {
        if (sheet.getSheetId().toString() === sheetId.toString()) {
          found = true;
          break;
        }
      }
      
      if (!found) return { success: false, error: "Sheet with this ID not found in spreadsheet" };
      
      // Store in user properties
      const userProps = PropertiesService.getUserProperties();
      userProps.setProperty("BUDGET_SPREADSHEET_ID", spreadsheetId);
      userProps.setProperty("BUDGET_SHEET_ID", sheetId);
      userProps.setProperty('BUDGET_SHEET_URL', url);
      
      return { success: true, message: "Sheet URL verified and accessible" };
    } catch (e) {
      return { 
        success: false, 
        error: "Cannot access this sheet. Make sure it's shared with you.",
        details: e.toString()
      };
    }
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/**
 * Get a sheet from spreadsheet using stored IDs
 * @return {SpreadsheetApp.Sheet} Sheet object or null
 */
function getBudgetSheet(sheetName) {
  try {
    // Get the stored spreadsheet ID
    const props = PropertiesService.getUserProperties();
    const spreadsheetId = props.getProperty("BUDGET_SPREADSHEET_ID");
    
    if (!spreadsheetId) {
      Logger.log("Missing spreadsheet ID");
      return null;
    }
    
    // Open the spreadsheet by ID
    const ss = SpreadsheetApp.openById(spreadsheetId);
    if (!ss) return null;
    
    // If sheet name provided, return that sheet
    if (sheetName) {
      return ss.getSheetByName(sheetName);
    }
    
    // Otherwise return the first sheet by default
    return ss.getSheets()[0];
  } catch (error) {
    Logger.log("Error in getBudgetSheet: " + error.toString());
    return null;
  }
}

/**
 * Sets the current month and year in the Budget sheet
 * @return {Object} Result with success flag and the current month/year
 */
function setCurrentMonthYear() {
  try {
    const sheet = getBudgetSheet("Budget");
    if (!sheet) {
      return { success: false, error: "Budget sheet not found" };
    }
    
    // Get the current date
    const now = new Date();
    const currentMonth = now.toLocaleString('default', { month: 'MMMM' }); // "January", "February", etc.
    const currentYear = now.getFullYear();
    
    // Update the cells
    sheet.getRange("C6").setValue(currentMonth);
    sheet.getRange("E6").setValue(currentYear);
    
    return { 
      success: true,
      month: currentMonth,
      year: currentYear
    };
  } catch (error) {
    Logger.log("Error in setCurrentMonthYear: " + error.toString());
    return { success: false, error: error.toString() };
  }
}

/**
 * Sets a specific month and year in the Budget sheet
 * @param {string} month - Month name (January, February, etc.)
 * @param {number|string} year - Year (e.g., 2025)
 * @return {Object} Result with success flag
 */
function setMonthYear(month, year) {
  try {
    const sheet = getBudgetSheet("Budget");
    if (!sheet) {
      return { success: false, error: "Budget sheet not found" };
    }
    
    // Update the cells
    sheet.getRange("C6").setValue(month);
    sheet.getRange("E6").setValue(parseInt(year));
    
    return { success: true };
  } catch (error) {
    Logger.log("Error in setMonthYear: " + error.toString());
    return { success: false, error: error.toString() };
  }
}

/**
 * Get budget summary data
 * @return {Object} Budget data including totals and categories
 */
function getBudgetData() {
  try {
    const sheet = getBudgetSheet("Budget");
    if (!sheet) {
      return { success: false, error: "Budget sheet not found" };
    }

    // Get the info/alert message from H6:L7
    const infoMessage = sheet.getRange("H6").getValue();
    
    // Get month and year
    const month = sheet.getRange("C1").getValue();
    const year = sheet.getRange("E1").getValue();
    
    // Get financial summary
    const income = sheet.getRange("C7").getValue();
    const spent = sheet.getRange("D7").getValue();
    const leftToSpend = sheet.getRange("E7").getValue();
    
    // Get category data (names, budgeted, actual spending)
    const categoryNames = sheet.getRange("I9:I39").getValues();
    const budgetedAmounts = sheet.getRange("J9:J39").getValues();
    const actualSpending = sheet.getRange("K9:K39").getValues();
    
    // Combine into category objects
    const categories = [];
    for (let i = 0; i < categoryNames.length; i++) {
      const categoryName = categoryNames[i][0];
      
      // Only include non-empty categories
      if (categoryName) {
        categories.push({
          name: categoryName,
          budgeted: budgetedAmounts[i][0] || 0,
          actual: actualSpending[i][0] || 0
        });
      }
    }
    
    return {
      success: true,
      budget: {
        month: month,
        year: year,
        income: income,
        spent: spent,
        leftToSpend: leftToSpend,
        infoMessage: infoMessage,
        categories: categories
      }
    };
  } catch (error) {
    Logger.log("Error in getBudgetData: " + error.toString());
    return { success: false, error: error.toString() };
  }
}

/**
 * Get expense transaction data
 * @return {Object} Expense transactions
 */
function getExpenseData() {
  try {
    const sheet = getBudgetSheet("Expenses");
    if (!sheet) {
      return { success: false, error: "Expenses sheet not found" };
    }

    // Get data starting from row 4 (after headers)
    const dataRange = sheet.getRange(4, 4, sheet.getLastRow() - 3, 7).getValues();
    const expenses = [];
    
    for (let i = 0; i < dataRange.length; i++) {
      const row = dataRange[i];
      if (row[0]) { // Date exists
        expenses.push({
          date: row[0],
          amount: row[1] || 0,
          category: row[2] || "",
          name: row[3] || "",
          label: row[4] || "",
          notes: row[5] || "",
          rowIndex: i + 4 // Adding 4 to account for the header rows
        });
      }
    }
    
    return {
      success: true,
      expenses: expenses
    };
  } catch (error) {
    Logger.log("Error in getExpenseData: " + error.toString());
    return { success: false, error: error.toString() };
  }
}

/**
 * Save an expense with account balance adjustment
 * @param {Object} expense - The expense data to save
 * @return {Object} Success response or error
 */
function saveExpense(expense) {
  try {
    if (!expense) {
      return { success: false, error: "No expense data provided" };
    }
    
    // Basic validation
    if (!expense.amount || isNaN(parseFloat(expense.amount))) {
      return { success: false, error: "Invalid amount" };
    }
    
    if (!expense.category) {
      return { success: false, error: "Category is required" };
    }
    
    // Get the expenses sheet
    const expenseSheet = getBudgetSheet("Expenses");
    if (!expenseSheet) {
      return { success: false, error: "Expenses sheet not found" };
    }
    
    // Create a new row for the expense
    const newRow = [
      null, null, null, // Empty columns A-C
      expense.date || new Date(), // Date
      parseFloat(expense.amount), // Amount
      expense.category, // Category
      expense.name || "", // Name
      expense.label || "", // Label
      expense.notes || "", // Notes
      null, // Empty column J
      "" // Empty column K
    ];
    
    // Insert the row at position 4 (after headers)
    if (expense.rowIndex) {
      // Update existing row
      expenseSheet.getRange(expense.rowIndex, 1, 1, newRow.length).setValues([newRow]);
    } else {
      // Insert new row
      expenseSheet.insertRowAfter(3);
      expenseSheet.getRange(4, 1, 1, newRow.length).setValues([newRow]);
    }
    
    // Update account balance if account specified
    if (expense.account) {
      updateAccountBalance(expense.account, -expense.amount);
    }
    
    return {
      success: true,
      message: "Expense saved successfully"
    };
  } catch (error) {
    Logger.log("Error in saveExpense: " + error.toString());
    return { success: false, error: error.toString() };
  }
}

/**
 * Update account balance
 * @param {string} accountName - Name of the account
 * @param {number} amount - Amount to adjust (positive or negative)
 * @return {boolean} Success indicator
 */
function updateAccountBalance(accountName, amount) {
  try {
    // Get the Net Worth sheet to find account balances
    const netWorthSheet = getBudgetSheet("Net Worth");
    if (!netWorthSheet) {
      Logger.log("Net Worth sheet not found");
      return false;
    }
    
    // Find the account in the sheet
    const data = netWorthSheet.getDataRange().getValues();
    
    // Look for the account name in the first column
    for (let i = 0; i < data.length; i++) {
      if (data[i][0] === accountName) {
        // Get the current balance from column with current month
        // This would need to be adjusted based on the sheet structure
        // For this example, we assume column 4 has the current month
        const currentBalance = netWorthSheet.getRange(i + 1, 4).getValue();
        const newBalance = currentBalance + amount;
        
        // Update the balance
        netWorthSheet.getRange(i + 1, 4).setValue(newBalance);
        return true;
      }
    }
    
    // Account not found
    Logger.log("Account not found: " + accountName);
    return false;
  } catch (error) {
    Logger.log("Error in updateAccountBalance: " + error.toString());
    return false;
  }
}

/**
 * Test server connection
 * @param {string} sheetUrl - Optional sheet URL to set
 * @return {Object} Simple response to verify connection
 */
function testServerConnection(sheetUrl) {
  try {
    // If URL provided, store it
    if (sheetUrl) {
      const result = setBudgetSheetUrl(sheetUrl);
      if (!result.success) {
        return { success: false, error: result.error };
      }
    }
    
    return {
      success: true,
      timestamp: new Date().toString(),
      message: "Server connection successful",
      userEmail: Session.getActiveUser().getEmail()
    };
  } catch (error) {
    Logger.log("Error in testServerConnection: " + error.toString());
    return { success: false, error: error.toString() };
  }
}

/**
 * Get user credentials
 * @return {Object} User credentials
 */
function getUserCredentials() {
  try {
    const props = PropertiesService.getUserProperties();
    
    return {
      success: true,
      email: Session.getActiveUser().getEmail(),
      sheetUrl: props.getProperty('BUDGET_SHEET_URL') || ''
    };
  } catch (error) {
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * Sets a user property
 * @param {string} key - The property key
 * @param {string} value - The property value
 * @return {Object} Result with success flag
 */
function setUserProperty(key, value) {
  try {
    PropertiesService.getUserProperties().setProperty(key, value);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/**
 * Updates a budget value for a specific category
 * @param {string} categoryName - Name of the category to update
 * @param {number|string} budgetValue - New budget value
 * @return {Object} Result with success flag
 */
function updateBudgetValue(categoryName, budgetValue) {
  try {
    const sheet = getBudgetSheet("Budget");
    if (!sheet) {
      return { success: false, error: "Budget sheet not found" };
    }
    
    // Get all category names
    const categoryRange = sheet.getRange("I9:I39");
    const categories = categoryRange.getValues();
    
    // Find the row index of the category
    let rowIndex = -1;
    for (let i = 0; i < categories.length; i++) {
      if (categories[i][0] === categoryName) {
        rowIndex = i + 9; // Add 9 to get the actual row number
        break;
      }
    }
    
    if (rowIndex === -1) {
      return { success: false, error: "Category not found" };
    }
    
    // Convert the budget value to a number
    const numericValue = parseFloat(budgetValue);
    if (isNaN(numericValue)) {
      return { success: false, error: "Invalid budget value" };
    }
    
    // Update the budget value in column J (budgeted amount)
    sheet.getRange(rowIndex, 10).setValue(numericValue); // Column J is index 10
    
    return { 
      success: true,
      message: "Budget updated successfully"
    };
  } catch (error) {
    Logger.log("Error in updateBudgetValue: " + error.toString());
    return { success: false, error: error.toString() };
  }
}