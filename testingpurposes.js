/**
 * Save a batch of expenses to the spreadsheet at once
 * Writes ONLY to Expenses sheet range D4:K6000
 * Row 4 contains headers: transactionId Date Amount Category Name Label Notes Account
 * Inserts after the last non-empty transactionId in column D
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
    
    // Get all data in the transactionId column (D) to find last non-empty cell
    const transactionIdCol = expenseSheet.getRange("D5:D6000").getValues();
    
    // Find the last row with a non-empty transactionId
    let lastDataRow = 4; // Default to header row
    for (let i = 0; i < transactionIdCol.length; i++) {
      if (transactionIdCol[i][0] !== "") {
        lastDataRow = i + 5; // Add 5 because our range starts at row 5
      }
    }
    
    // Start inserting at the row after the last data row
    let insertRow = lastDataRow + 1;
    
    // Process each expense
    let successCount = 0;
    let errorCount = 0;
    
    expenses.forEach(expense => {
      try {
        // Create a new row for the expense
        // Column D=transactionId, E=Date, F=Amount, G=Category, H=Name, I=Label, J=Notes, K=Account
        const newRow = [
          expense.transactionId || "",       // Column D: transactionId
          expense.date || new Date(),        // Column E: Date
          parseFloat(expense.amount) || 0,   // Column F: Amount
          expense.category || "",            // Column G: Category
          expense.name || "",                // Column H: Name
          expense.label || "",               // Column I: Label
          expense.notes || "",               // Column J: Notes
          expense.account || "Main Account"  // Column K: Account
        ];
        
        // Insert the row in columns D through K
        expenseSheet.getRange(insertRow, 4, 1, 8).setValues([newRow]);
        insertRow++;
        successCount++;
        
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
      errors: errorCount,
      insertStartRow: lastDataRow + 1
    };
  } catch (error) {
    Logger.log("Error in saveBatchExpenses: " + error.toString());
    return { success: false, error: error.toString() };
  }
}