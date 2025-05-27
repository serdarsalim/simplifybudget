





/**
 * Get categories from UserProperties
 */
function getCategoriesFromUserProperties() {
  try {
    const userProps = PropertiesService.getUserProperties();
    const categoriesJson = userProps.getProperty('categories');
    
    if (categoriesJson) {
      const categories = JSON.parse(categoriesJson);
      return {
        success: true,
        categories: categories
      };
    } else {
      return {
        success: true,
        categories: [] // Empty array = no categories stored yet
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * Save categories to UserProperties
 */
function saveCategoriestoUserProperties(categories) {
  try {
    const userProps = PropertiesService.getUserProperties();
    userProps.setProperty('categories', JSON.stringify(categories));
    
    return {
      success: true,
      message: 'Categories saved to UserProperties'
    };
  } catch (error) {
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * Clear categories from UserProperties
 */
function clearCategoriesFromUserProperties() {
  try {
    const userProps = PropertiesService.getUserProperties();
    userProps.deleteProperty('categories');
    
    return {
      success: true,
      message: 'Categories cleared from UserProperties'
    };
  } catch (error) {
    return {
      success: false,
      error: error.toString()
    };
  }
}