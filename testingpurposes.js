// ============================================================================
// SERVER-SIDE FUNCTIONS (Code.gs) - Add these to your Code.gs file
// ============================================================================

/**
 * Get recurring data from spreadsheet (C5:N500 range)
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

    // Headers are at C5:N5
    const headerRange = "C5:N5";
    const headers = recurringSheet.getRange(headerRange).getValues()[0];
    console.log("Recurring headers found: " + JSON.stringify(headers));
    
    // Expected headers: transactionI, dStart, Date, Name, Category, Type, Frequency, Amount, Account, End date, Status, Next Payment
    const columnMap = {};
    const expectedHeaders = {
      'transactionI': ['transactioni', 'transaction id', 'id'],
      'startDate': ['dstart', 'start date', 'start'],
      'date': ['date', 'current date'],
      'name': ['name', 'subscription name', 'title'],
      'category': ['category', 'cat'],
      'type': ['type', 'subscription type'],
      'frequency': ['frequency', 'freq'],
      'amount': ['amount', 'cost', 'price'],
      'account': ['account', 'payment method', 'acc'],
      'endDate': ['end date', 'enddate', 'expiry'],
      'status': ['status', 'state'],
      'nextPayment': ['next payment', 'nextpayment', 'next due']
    };

    // Map headers to column indices
    headers.forEach((header, index) => {
      if (header && typeof header === 'string') {
        const cleanHeader = header.toString().trim().toLowerCase();
        
        Object.keys(expectedHeaders).forEach(key => {
          expectedHeaders[key].forEach(variation => {
            if (cleanHeader.includes(variation)) {
              if (!columnMap[key]) { // Use first match
                columnMap[key] = index;
                console.log("Mapped " + key + " to column " + index + " (" + header + ")");
              }
            }
          });
        });
      }
    });

    // Read data from C6:N500 (start from row after headers)
    const dataRange = "C6:N500";
    const lastRow = recurringSheet.getLastRow();
    const actualRange = "C6:N" + Math.min(500, lastRow);
    
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

      // Parse dates safely
      const startDateValue = columnMap.startDate !== undefined ? row[columnMap.startDate] : null;
      const endDateValue = columnMap.endDate !== undefined ? row[columnMap.endDate] : null;
      const nextPaymentValue = columnMap.nextPayment !== undefined ? row[columnMap.nextPayment] : null;

      let startDate = null;
      let endDate = null;
      let nextPayment = null;

      if (startDateValue) {
        startDate = startDateValue instanceof Date ? startDateValue.toISOString() : new Date(startDateValue).toISOString();
      }
      if (endDateValue) {
        endDate = endDateValue instanceof Date ? endDateValue.toISOString() : new Date(endDateValue).toISOString();
      }
      if (nextPaymentValue) {
        nextPayment = nextPaymentValue instanceof Date ? nextPaymentValue.toISOString() : new Date(nextPaymentValue).toISOString();
      }

      // Parse amount
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount)) {
        skippedCount++;
        continue;
      }

      recurring.push({
        id: transactionId || "recurring-" + (i + 6), // Use row number as fallback ID
        rowIndex: i + 6, // Actual row in spreadsheet
        startDate: startDate,
        endDate: endDate,
        name: name.toString(),
        category: columnMap.category !== undefined ? row[columnMap.category].toString() : '',
        type: columnMap.type !== undefined ? row[columnMap.type].toString() : '',
        frequency: columnMap.frequency !== undefined ? row[columnMap.frequency].toString() : 'Monthly',
        amount: parsedAmount,
        account: columnMap.account !== undefined ? row[columnMap.account].toString() : '',
        status: columnMap.status !== undefined ? row[columnMap.status].toString() : 'Active',
        nextPayment: nextPayment,
        notes: '' // Notes would be in column O if available
      });

      processedCount++;
    }

    console.log("Recurring data processing complete:");
    console.log("  - Total rows: " + recurringData.length);
    console.log("  - Processed: " + processedCount);
    console.log("  - Skipped: " + skippedCount);

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
 * Save batch recurring transactions
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

    let updated = 0;
    let inserted = 0;

    // Process each recurring transaction
    for (const item of recurring) {
      if (!item.amount || parseFloat(item.amount) <= 0) continue;

      // Prepare row data (C through N columns)
      const rowData = [
        item.id || item.transactionId,                                    // C: transactionI
        item.startDate ? new Date(item.startDate) : new Date(),          // D: dStart
        new Date(),                                                       // E: Date (current)
        item.name || '',                                                  // F: Name
        item.category || '',                                              // G: Category
        item.type || '',                                                  // H: Type
        item.frequency || 'Monthly',                                      // I: Frequency
        parseFloat(item.amount),                                          // J: Amount
        item.account || '',                                               // K: Account
        item.endDate ? new Date(item.endDate) : '',                      // L: End date
        item.status || 'Active',                                          // M: Status
        item.nextPayment ? new Date(item.nextPayment) : '',              // N: Next Payment
      ];

      if (item.rowIndex && item.rowIndex > 5) {
        // Update existing row
        sheet.getRange(item.rowIndex, 3, 1, 12).setValues([rowData]);
        updated++;
      } else {
        // Insert new row - find first empty row starting from row 6
        const lastRow = sheet.getLastRow();
        const newRow = Math.max(6, lastRow + 1);
        sheet.getRange(newRow, 3, 1, 12).setValues([rowData]);
        inserted++;
      }
    }

    return {
      success: true,
      updated: updated,
      inserted: inserted
    };

  } catch (error) {
    console.log("Error in saveRecurringTransaction: " + error.toString());
    return { success: false, error: error.toString() };
  }
}

/**
 * Clear a recurring transaction row by ID
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

    // Find the transaction by ID in column C
    const finder = sheet.createTextFinder(transactionId.toString())
                       .matchEntireCell(true)
                       .matchCase(false)
                       .findNext();
    
    if (!finder) {
      return {
        success: false,
        error: "Recurring transaction not found: " + transactionId
      };
    }

    const rowIndex = finder.getRow();
    
    // Clear the row (columns C through N)
    sheet.getRange(rowIndex, 3, 1, 12).clearContent();
    
    return {
      success: true,
      message: "Recurring transaction row cleared successfully",
      transactionId: transactionId,
      rowIndex: rowIndex
    };

  } catch (error) {
    console.log("Error in clearRecurringTransaction: " + error.toString());
    return { success: false, error: error.toString() };
  }
}