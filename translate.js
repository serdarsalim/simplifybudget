const userProps = PropertiesService.getUserProperties();


/**
 * Translate a batch of strings to the target language
 * @param {Object} strings - Object with string keys to translate
 * @param {string} targetLanguage - Language code (e.g., 'es', 'fr')
 * @return {Object} Translated strings
 */
function translateUIStrings(strings, targetLanguage) {
  // Return original strings for English
  if (targetLanguage === 'en') {
    return strings;
  }
  
  // Check cache first
  const cacheKey = 'translations_' + targetLanguage;
  
  try {
    const cacheMetaStr = userProps.getProperty(`${cacheKey}_meta`);
    
    if (cacheMetaStr) {
      const cacheMeta = JSON.parse(cacheMetaStr);
      const cachedObj = {};
      
      // Retrieve all chunks
      let cacheComplete = true;
      for (let i = 0; i < cacheMeta.totalChunks; i++) {
        const chunkStr = userProps.getProperty(`${cacheKey}_chunk_${i}`);
        if (chunkStr) {
          const chunk = JSON.parse(chunkStr);
          Object.assign(cachedObj, chunk);
        } else {
          Logger.log(`Missing chunk ${i} for ${targetLanguage}`);
          cacheComplete = false;
          break;
        }
      }
      
      // Use cache if it's complete and has all required strings
      if (cacheComplete && Object.keys(strings).every(key => key in cachedObj)) {
        // Apply any language-specific overrides
        applyLanguageOverrides(cachedObj, targetLanguage);
        return cachedObj;
      } else {
        Logger.log("Cache incomplete or missing keys, translating all strings");
      }
    }
  } catch (e) {
    Logger.log(`Error retrieving cached translations: ${e.toString()}`);
  }
  
  // Create result object
  const result = {};
  
  // Define words that should not be translated
  const doNotTranslate = [
    "SimBudget", 
  ];
  
  // Get translation hints if available
  const hints = getTranslationHints();
  
  // Translate each string individually for maximum reliability
  for (const key in strings) {
    try {
      let originalText = strings[key];
      
      // Apply hint if available (use alternative text for translation)
      if (hints && hints[key]) {
        originalText = hints[key];
      }
      
      // Don't translate if it's in the protected list
      if (doNotTranslate.some(word => originalText === word)) {
        result[key] = strings[key]; // Use original non-hint value
        continue;
      }
      
      // Replace protected words with tokens before translation
      let textToTranslate = originalText;
      const replacements = [];
      
      doNotTranslate.forEach((word, i) => {
        // Only replace if the word appears as a whole word
        const regex = new RegExp(`\\b${word}\\b`, 'g');
        const token = `###PROTECTED_${i}_###`;
        
        if (regex.test(textToTranslate)) {
          textToTranslate = textToTranslate.replace(regex, token);
          replacements.push({ token, word });
        }
      });
      
      // Perform translation
      let translatedText = LanguageApp.translate(textToTranslate, 'en', targetLanguage);
      
      // Restore protected words
      replacements.forEach(({ token, word }) => {
        translatedText = translatedText.replace(new RegExp(token, 'g'), word);
      });
      
      // Store the result (using original key, not the hint text)
      result[key] = translatedText;
    } catch (e) {
      // Fall back to original text if translation fails
      result[key] = strings[key];
      Logger.log(`Translation failed for key "${key}": ${e.toString()}`);
    }
  }
  
  // Apply language-specific overrides
  applyLanguageOverrides(result, targetLanguage);
  
  // Cache the results in chunks
  try {
    // Break cache into chunks to avoid property size limits
    const chunkSize = 15; // Adjust this number as needed
    const keys = Object.keys(result);
    
    // Clear existing cache chunks for this language
    for (let i = 0; i < 20; i++) { // Assuming max 20 chunks
      userProps.deleteProperty(`${cacheKey}_chunk_${i}`);
    }
    
    // Store metadata
    userProps.setProperty(`${cacheKey}_meta`, JSON.stringify({
      totalChunks: Math.ceil(keys.length / chunkSize),
      totalKeys: keys.length,
      timestamp: new Date().getTime()
    }));
    
    // Store chunks
    for (let i = 0; i < keys.length; i += chunkSize) {
      const chunkObj = {};
      const chunkKeys = keys.slice(i, i + chunkSize);
      
      chunkKeys.forEach(key => {
        chunkObj[key] = result[key];
      });
      
      userProps.setProperty(`${cacheKey}_chunk_${Math.floor(i / chunkSize)}`, 
                           JSON.stringify(chunkObj));
    }
    
    Logger.log(`Cached translations in ${Math.ceil(keys.length / chunkSize)} chunks`);
  } catch (e) {
    Logger.log('Failed to cache translations: ' + e.toString());
  }
  
  return result;
}




/**
 * Get current user language preference
 * @return {string} Language code
 */
function getUserLanguage() {
  const props = PropertiesService.getUserProperties();
  return props.getProperty('language') || 'en';
}

/**
 * Set user language preference
 * @param {string} languageCode - Language code to set
 * @return {Object} Success response
 */
function setUserLanguage(languageCode) {
  try {
    const props = PropertiesService.getUserProperties();
    props.setProperty('language', languageCode);
    return { success: true, language: languageCode };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}


/**
 * Translation hints - alternative source words for better translation results
 * These are ONLY used for translation, not for English UI display
 */
function getTranslationHints() {
  return {
    "expenses": "Purchases", // Will be translated as "Purchases" instead of "Expenses"
    "save": "Save it",

  };
}



/**
 * Get dictionary of UI strings for translation
 * @return {Object} UI strings dictionary
 */
function getUIDictionary() {
  return {

    // Budget quote
    "budget_quote": "Budgeting is telling your money where to go, not wondering where it went.",

    // General
    "educational_disclaimer": "Only for educational purposes. Not for real financial advice.",
    "refresh": "Refresh",
    "generate": "Generate",
    "save": "Save",
    "reset": "Reset",
    "test": "Test",
    
    // categories
    "Housing 🏡": "Housing 🏡",
    "Transport 🚗": "Transport 🚗",
    "Groceries 🍎": "Groceries 🍎",
    "Dining out 🍕": "Dining out 🍕",
    "Personal care ❤️": "Personal care ❤️",
    "Shopping 🛍️": "Shopping 🛍️",
    "Utilities 💡": "Utilities 💡",
    "Fun 🎬": "Fun 🎬",
    "Business 💼": "Business 💼",
    "Other 🧩": "Other 🧩",
    "Donation 🎗️": "Donation 🎗️",
    "Childcare 👶": "Childcare 👶",
    "Travel ✈️": "Travel ✈️",
    "Zakat 🌟": "Zakat 🌟",
    "Debt Payment 💸": "Debt Payment 💸",
    "Fitness 💪": "Fitness 💪",
    "Family Support 👨‍👩‍👧‍👦": "Family Support 👨‍👩‍👧‍👦",
    "Taxes 💵": "Taxes 💵",
    "Maintenance 🛠️": "Maintenance 🛠️",
    "Leisure 🎨": "Leisure 🎨",
    "PlayGround 🛝": "PlayGround 🛝",
    "Learning 📚": "Learning 📚",
    "Sports ⚽️": "Sports ⚽️",
    "Pet care 🐾": "Pet care 🐾",
    "Gifts 🎁": "Gifts 🎁",
    "Special Occasions 🎉": "Special Occasions 🎉",
    "Clothing 👚": "Clothing 👚",
    "Hobbies 🎨": "Hobbies 🎨",
    "Insurance 🛡️": "Insurance 🛡️",
    "Medical 🏥": "Medical 🏥",
    "Savings 💵": "Savings 💵",

    // Quick Expense Modal
    "quick_expense": "Quick Expense",
    "amount": "Amount",
    "description": "Description",
    "notes_optional": "Notes (Optional)",
    "select_account": "-- Select Account --",
    "save": "Save",
    "expense_saved": "Expense saved successfully!",

    // Budget alert messages
    "budget_no_income_tip": "You budgeted {0}. Tip: Align it with your income.",
    "budget_perfect_match": "Your budget of {0} perfectly matches your income!",
    "budget_under_income": "You've budgeted {0} with {1} left to allocate.",
    "budget_over_income": "You've budgeted {0}, exceeding income by {1}.",
    
        // Subscription info translations
    "subscriptions_total": "total",
    "subscriptions_of_income": "of income",

    
        // Month names
    "january": "January",
    "february": "February",
    "march": "March",
    "april": "April",
    "may": "May",
    "june": "June",
    "july": "July",
    "august": "August",
    "september": "September", 
    "october": "October",
    "november": "November",
    "december": "December",

    // days
    "today": "Today",
    "yesterday": "Yesterday",
    "tomorrow": "Tomorrow",
    "sunday": "Sunday",
    "monday": "Monday",
    "tuesday": "Tuesday",
    "wednesday": "Wednesday",
    "thursday": "Thursday",
    "friday": "Friday",
    "saturday": "Saturday",

    // Dashboard and loader
    "dashboard_load_test": "Dashboard HTML loaded",
    "dashboard_title": "Budget Dashboard",
    
    // Financial terms
    "income": "Income",
    "income_title": "Income",
    "spent": "Spent", 
    "left_to_spend": "Left to Spend",
    "net_worth": "Net Worth",
    "net_worth_title": "Net Worth",
    "savings": "Savings",
    "debts": "Debts",
    "amount": "Amount",
    
    // Budget categories and table
    "category": "Category",
    "categories": "Categories",
    "budgeted": "Budgeted",
    "actual": "Actual",
    "progress": "Progress",
    
    // Expense breakdown
    "expense_breakdown": "Monthly Expense Breakdown",
    
    // Subscriptions section
    "subscriptions": "Subscriptions",
    "name": "Name",
    "next_due": "Next Due",
    
    // Navigation and views
    "budget": "Budget",
    "expenses": "Expenses",
    "recurring": "Recurring",
    "reports": "Reports",
    "settings": "Settings",
    
    // Action buttons
    "add_expense": "Add Expense",
    "add_income": "Add Income",
    "add_recurring": "Add Recurring",
    
    // Expense view
    "search_expenses": "Search expenses...",
    "date": "Date",
    "description": "Description",
    "action": "Action",
    "no_expenses": "No expenses found",
    
    // Settings sections
    "account": "Account",
    "google_sheet_config": "Google Sheet Configuration",
    "budget_sheet_url": "Budget Spreadsheet URL",
    "sheet_url_help": "Enter the URL of your Google Sheet for budget data.",
    "display_settings": "Display Settings",
    "language": "Language",
    "currency": "Currency",
    "show_decimals": "Show Decimal Places",
    "date_format": "Date Format",
    "dark_mode": "Dark Mode",
    "budget_preferences": "Budget Preferences",
    "show_remaining": "Show Remaining Budget",
    "enable_alerts": "Enable Budget Alerts",
    
    // Alert and status messages
    "settings_saved": "Settings saved successfully",
    "connection_success": "Connection successful!",
    "connection_failed": "Connection failed",
    "testing_connection": "Testing connection...",
    "enter_url": "Please enter a spreadsheet URL",
    
    // Language names (for language selector)
    "english": "English",
    "spanish": "Español",
    "french": "Français",
    "german": "Deutsch",
    "malay": "Bahasa Melayu",
    "turkish": "Türkçe",


    
  };
}

/**
 * Get translated UI strings
 * @param {string} languageCode - The language code to translate to
 * @param {boolean} bustCache - Whether to bypass cache
 * @return {Object} Object with all UI strings translated
 */
function getTranslatedUI(languageCode, bustCache) {
  const ui = getUIDictionary();
  
  // Use source language strings if requesting English
  if (languageCode === 'en') {
    return ui;
  }
  
  // Bypass cache if requested
  if (bustCache) {
    // Delete the cached translation for this language
    const cacheKey = 'translations_' + languageCode;
    userProps.deleteProperty(cacheKey);
  }
  
  // Apply translation hints for better results
  const translationHints = getTranslationHints();
  const uiWithHints = Object.assign({}, ui);
  
  // Replace original text with hints for translation only
  Object.keys(translationHints).forEach(key => {
    if (uiWithHints[key]) {
      uiWithHints[key] = translationHints[key];
    }
  });
  
  // Translate with hints and return
  return translateUIStrings(uiWithHints, languageCode);
}

/**
 * Apply manual overrides for specific languages
 * @param {Object} translations - Translated strings
 * @param {string} targetLanguage - Language code
 * @return {Object} Corrected translations
 */
function applyLanguageOverrides(translations, targetLanguage) {
  // Language-specific overrides
  const overrides = {
    'de': { // German
      "Housing 🏡": "Wohnkosten 🏡"
    },
    'tr': { // Turkish
      "save": "Kaydet"
    }
    // Add more languages as needed
  };
  
  // Apply overrides if we have them for this language
  if (overrides[targetLanguage]) {
    Object.keys(overrides[targetLanguage]).forEach(key => {
      translations[key] = overrides[targetLanguage][key];
    });
  }
  
  return translations;
}