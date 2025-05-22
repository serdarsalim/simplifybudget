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
