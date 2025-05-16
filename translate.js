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
  const cachedTranslations = userProps.getProperty(cacheKey);
  
  if (cachedTranslations) {
    const cachedObj = JSON.parse(cachedTranslations);
    // Use cache if it has all required strings
    if (Object.keys(strings).every(key => key in cachedObj)) {
      return cachedObj;
    }
  }
  
  // Create result object
  const result = {};
  
  // Define words that should not be translated
  const doNotTranslate = [
    "SimBudget", 
  ];
  
  // Translate each string individually for maximum reliability
  for (const key in strings) {
    try {
      const originalText = strings[key];
      
      // Don't translate if it's in the protected list
      if (doNotTranslate.some(word => originalText === word)) {
        result[key] = originalText;
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
      
      result[key] = translatedText;
    } catch (e) {
      // Fall back to original text if translation fails
      result[key] = strings[key];
      Logger.log(`Translation failed for key "${key}": ${e.toString()}`);
    }
  }
  
  // Cache the results
  try {
    userProps.setProperty(cacheKey, JSON.stringify(result));
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
    // Add more hints as needed
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