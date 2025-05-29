// Code.gs - Server-side logic for SimBudget
// Rewritten for modular data loading

/**
 * SimBudget - Google Sheets Budget Management App
 * Built on a modular architecture for improved performance
 */

/**
 * Creates a custom menu when the spreadsheet is opened
 */
function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu("Simplify Budget")
      .addItem("Launch Simplify Budget", "showSimBudgetApp")
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
    .setTitle("Simplify Budget");

  SpreadsheetApp.getUi().showModelessDialog(html, "Simplify Budget");
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
    .setTitle("Simplify Budget")
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
    // Get the current date
    const now = new Date();
    const currentMonth = now.toLocaleString('default', { month: 'MMMM' });
    const currentYear = now.getFullYear();
    
    // Use existing setMonthYear function to avoid duplication
    const result = setMonthYear(currentMonth, currentYear);
    
    // Add month/year to the result if successful
    if (result.success) {
      result.month = currentMonth;
      result.year = currentYear;
    }
    
    return result;
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
    sheet.getRange("C1").setValue(month);
    sheet.getRange("E1").setValue(parseInt(year));
    
    return { success: true };
  } catch (error) {
    Logger.log("Error in setMonthYear: " + error.toString());
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
    const categoryRange = sheet.getRange("J9:J39");
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
    
    // Update the budget value in column K (budgeted amount)
    sheet.getRange(rowIndex, 11).setValue(numericValue); // Column K is index 10
    
    return { 
      success: true,
      message: "Budget updated successfully"
    };
  } catch (error) {
    Logger.log("Error in updateBudgetValue: " + error.toString());
    return { success: false, error: error.toString() };
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

      updateMasterDataTimestamp();
    
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







function setCurrencyInSheet(currencySymbol) {
  try {
    // 1. Store the currency symbol in Dontedit!M76 using getBudgetSheet
    const donteditSheet = getBudgetSheet("Dontedit");
    if (!donteditSheet) throw new Error("Sheet 'Dontedit' not found");
    donteditSheet.getRange("M86").setValue(currencySymbol);
    
    // Get user settings for decimal places
    const userProps = PropertiesService.getUserProperties();
    const showDecimals = userProps.getProperty("showDecimals") === "true";
    
    // Generate the currency format once
    const numberFormat = getCurrencyFormat(currencySymbol, showDecimals);
    
    // 2. Format Income:F5:F sheet
    const incomeSheet = getBudgetSheet("Income");
    if (incomeSheet) {
      incomeSheet.getRange("F5:F").setNumberFormat(numberFormat);
      Logger.log("Applied format to Income sheet range F5:F");
    }
    
    // 3. Format Expenses:F5:F sheet
    const expensesSheet = getBudgetSheet("Expenses");
    if (expensesSheet) {
      expensesSheet.getRange("F5:F").setNumberFormat(numberFormat);
      Logger.log("Applied format to Expenses sheet range F5:F");
    }
    
    // 4. Format recurring:I6:I sheet
    const recurringSheet = getBudgetSheet("recurring");
    if (recurringSheet) {
      recurringSheet.getRange("I6:I").setNumberFormat(numberFormat);
      Logger.log("Applied format to recurring sheet range I6:I");
    }
    
    // 5. Format Net Worth:G37:G sheet and additional ranges
    const netWorthSheet = getBudgetSheet("Net Worth");
    if (netWorthSheet) {

      netWorthSheet.getRange("G37:G").setNumberFormat(numberFormat);
      netWorthSheet.getRange("D5:P18").setNumberFormat(numberFormat);
      netWorthSheet.getRange("I37:I").setNumberFormat(numberFormat);
      
    }

    // 6. Format Budget!J9:K39 sheet 
    const budgetSheet = getBudgetSheet("Budget");
    if (budgetSheet) {
      budgetSheet.getRange("C6:M50").setNumberFormat(numberFormat);
         }
    
    // 8. Format Dontedit rows 301:340 
    if (donteditSheet) {
      // Format columns that contain currency values (C-H based on getDashboardData)
      donteditSheet.getRange("C301:H340").setNumberFormat(numberFormat);
      // Also format columns with subscription amounts (M column)
      donteditSheet.getRange("M301:M340").setNumberFormat(numberFormat);
      Logger.log("Applied format to Dontedit sheet rows 301:340");
    }

        // 9. Format Quick Log sheet's entire data grid
    const quickLogSheet = getBudgetSheet("Quick Log");
    if (quickLogSheet) {
      // Format the entire data grid from E2 to AL3177
      quickLogSheet.getRange("E2:AL2452").setNumberFormat(numberFormat);
      Logger.log("Applied format to Quick Log sheet range E2:AL2452");
    }

   // 10. Format Setup sheet with specific currency ranges
    const setupSheet = getBudgetSheet("Reports");
    if (setupSheet) {
      // Format specific ranges that contain monetary values
      setupSheet.getRange("E6:L7").setNumberFormat(numberFormat);
      setupSheet.getRange("I61:K71").setNumberFormat(numberFormat);
      setupSheet.getRange("B78:D109").setNumberFormat(numberFormat);
      setupSheet.getRange("F79:F109").setNumberFormat(numberFormat);
      setupSheet.getRange("I78:K109").setNumberFormat(numberFormat);
      setupSheet.getRange("M79:M109").setNumberFormat(numberFormat);
      setupSheet.getRange("C26:D55").setNumberFormat(numberFormat);
      setupSheet.getRange("J26:J55").setNumberFormat(numberFormat);
      setupSheet.getRange("M26:N55").setNumberFormat(numberFormat);
      
      Logger.log("Applied format to Setup sheet specific currency ranges");
    }
    
    return { success: true };
  } catch (e) {
    Logger.log("Error in setCurrencyInSheet: " + e.toString());
    return { success: false, error: e.toString() };
  }
}

/**
 * Get the proper Google Sheets number format for a given currency symbol
 * @param {string} symbol - Currency symbol
 * @param {boolean} showDecimals - Whether to show decimal places (defaults to false)
 * @return {string} Google Sheets number format pattern
 */
function getCurrencyFormat(symbol, showDecimals = false) {
  // Base formats with or without decimals
  const decimalSuffix = showDecimals ? ".00" : "";
  
  // Common currency formats
  const formats = {
    '$': `"$"#,##0${decimalSuffix};("$"#,##0${decimalSuffix})`,
    '€': `[$€]#,##0${decimalSuffix};([$€]#,##0${decimalSuffix})`,
    '£': `"£"#,##0${decimalSuffix};("£"#,##0${decimalSuffix})`,
    '¥': `"¥"#,##0${decimalSuffix};("¥"#,##0${decimalSuffix})`,
    '₹': `"₹"#,##0${decimalSuffix};("₹"#,##0${decimalSuffix})`,
    '₽': `"₽"#,##0${decimalSuffix};("₽"#,##0${decimalSuffix})`,
    '₺': `"₺"#,##0${decimalSuffix};("₺"#,##0${decimalSuffix})`,
    'C$': `"C$"#,##0${decimalSuffix};("C$"#,##0${decimalSuffix})`,
    'A$': `"A$"#,##0${decimalSuffix};("A$"#,##0${decimalSuffix})`,
    'CHF': `CHF#,##0${decimalSuffix};(CHF#,##0${decimalSuffix})`,
    'R$': `"R$"#,##0${decimalSuffix};("R$"#,##0${decimalSuffix})`,
    '₩': `"₩"#,##0${decimalSuffix};("₩"#,##0${decimalSuffix})`,
    'RM': `"RM"#,##0${decimalSuffix};("RM"#,##0${decimalSuffix})`,
    '฿': `"฿"#,##0${decimalSuffix};("฿"#,##0${decimalSuffix})`,
    '₦': `"₦"#,##0${decimalSuffix};("₦"#,##0${decimalSuffix})`
  };
  
  // Return the specific format or default to a generic one with the given symbol
  return formats[symbol] || `"${symbol}"#,##0${decimalSuffix};("${symbol}"#,##0${decimalSuffix})`;
}


