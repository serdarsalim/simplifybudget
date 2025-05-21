/**
 * Save a batch of expenses to the spreadsheet at once
 * Now supports updating existing rows by transaction ID
 * 
 * @param {Array} expenses - Array of expense objects
 * @return {Object} Result object with success flag
 */
function saveBatchExpenses(expenses) {
  try {
    // Get the expenses sheet using your existing function
    const expenseSheet = getBudgetSheet("Expenses");
    if (!expenseSheet) {
      return { success: false, error: "Expenses sheet not found" };
    }
    
    // Get all data in the transaction ID column (D) to find last non-empty cell
    const dataRange = expenseSheet.getRange("D5:K6000");
    const allData = dataRange.getValues();
    
    // Create a map of transaction IDs to row numbers for quick lookup
    const transactionIdMap = {};
    let lastDataRow = 4; // Default to header row
    
    for (let i = 0; i < allData.length; i++) {
      const rowData = allData[i];
      const transactionId = rowData[0]; // First column (D) is transactionId
      
      if (transactionId !== "") {
        // Add 5 because our range starts at row 5
        const actualRow = i + 5;
        transactionIdMap[transactionId] = actualRow;
        lastDataRow = actualRow;
      }
    }
    
    // Start inserting new rows after the last data row
    let insertRow = lastDataRow + 1;
    
    // Process each expense
    let successCount = 0;
    let updateCount = 0;
    let insertCount = 0;
    let errorCount = 0;
    
    expenses.forEach(expense => {
      try {
        // Skip expenses with zero or null amounts (deleted transactions)
        if (!expense.amount || parseFloat(expense.amount) <= 0) {
          Logger.log("Skipping transaction with zero/null amount: " + expense.transactionId);
          return;
        }
        
        // Create a row array for the expense
        // Column D=transactionId, E=Date, F=Amount, G=Category, H=Name, I=Label, J=Notes, K=Account
        const rowData = [
          expense.transactionId || "",       // Column D: transactionId
          expense.date || new Date(),        // Column E: Date
          parseFloat(expense.amount) || 0,   // Column F: Amount
          expense.category || "",            // Column G: Category
          expense.name || "",                // Column H: Name
          expense.label || "",               // Column I: Label
          expense.notes || "",               // Column J: Notes
          expense.account || "Main Account"  // Column K: Account
        ];
        
        // Check if this transaction ID already exists
        if (expense.transactionId && transactionIdMap[expense.transactionId]) {
          // Update existing row
          const rowToUpdate = transactionIdMap[expense.transactionId];
          expenseSheet.getRange(rowToUpdate, 4, 1, 8).setValues([rowData]);
          updateCount++;
          successCount++;
          
          Logger.log("Updated existing transaction at row " + rowToUpdate + ": " + expense.transactionId);
        } else {
          // Insert new row
          expenseSheet.getRange(insertRow, 4, 1, 8).setValues([rowData]);
          insertRow++;
          insertCount++;
          successCount++;
          
          Logger.log("Inserted new transaction at row " + (insertRow-1) + ": " + expense.transactionId);
        }
        
        // Update account balance if specified (using your existing function)
        if (expense.account && expense.amount) {
          updateAccountBalance(expense.account, -parseFloat(expense.amount));
        }
      } catch (expenseError) {
        errorCount++;
        Logger.log("Error saving expense: " + expenseError.toString());
      }
    });
    
    return {
      success: true,
      saved: successCount,
      updated: updateCount,
      inserted: insertCount,
      errors: errorCount,
      lastDataRow: lastDataRow,
      insertStartRow: lastDataRow + 1
    };
  } catch (error) {
    Logger.log("Error in saveBatchExpenses: " + error.toString());
    return { success: false, error: error.toString() };
  }
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
    
    // Get all data in the transaction ID column to find the row
    const dataRange = sheet.getRange("D5:D6000");
    const allIds = dataRange.getValues();
    
    let rowIndex = -1;
    
    // Find the row with matching transaction ID
    for (let i = 0; i < allIds.length; i++) {
      if (allIds[i][0] === transactionId || 
          (allIds[i][0] && allIds[i][0].toString() === transactionId.toString())) {
        rowIndex = i + 5; // +5 because our range starts at row 5
        break;
      }
    }
    
    if (rowIndex === -1) {
      return { 
        success: false, 
        error: "Transaction not found: " + transactionId 
      };
    }
    
    // Clear the cells in the row (columns D through K)
    sheet.getRange(rowIndex, 4, 1, 8).clearContent();
    
    // Update any caches
    const currentDate = getCurrentMonthYear();
    clearUserCache('expenses_' + currentDate.month + '_' + currentDate.year);
    
    return { 
      success: true, 
      message: "Transaction row cleared successfully",
      transactionId: transactionId,
      rowIndex: rowIndex
    };
    
  } catch (e) {
    Logger.log("Error in clearTransactionRow: " + e.toString());
    return { success: false, error: e.toString() };
  }
}