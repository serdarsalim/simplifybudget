
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
