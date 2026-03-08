const fs = require('fs');
const path = require('path');

class I18nHelper {
  constructor() {
    this.translations = {};
    this.defaultLocale = 'en';
    this.supportedLocales = ['en', 'es', 'fr', 'de', 'it', 'pt', 'zh', 'ja', 'ko', 'ar'];
    this.loadTranslations();
  }

  // Load translation files
  loadTranslations() {
    const translationsDir = path.join(__dirname, '../locales');
    
    if (!fs.existsSync(translationsDir)) {
      console.log('Translations directory not found, using default translations');
      this.loadDefaultTranslations();
      return;
    }

    this.supportedLocales.forEach(locale => {
      const translationFile = path.join(translationsDir, `${locale}.json`);
      if (fs.existsSync(translationFile)) {
        try {
          const content = fs.readFileSync(translationFile, 'utf8');
          this.translations[locale] = JSON.parse(content);
        } catch (error) {
          console.error(`Error loading translation file for ${locale}:`, error);
          this.translations[locale] = {};
        }
      } else {
        this.translations[locale] = {};
      }
    });
  }

  // Load default translations (fallback)
  loadDefaultTranslations() {
    this.translations = {
      en: {
        common: {
          welcome: 'Welcome',
          goodbye: 'Goodbye',
          hello: 'Hello',
          thankYou: 'Thank you',
          sorry: 'Sorry',
          yes: 'Yes',
          no: 'No',
          ok: 'OK',
          cancel: 'Cancel',
          save: 'Save',
          delete: 'Delete',
          edit: 'Edit',
          add: 'Add',
          search: 'Search',
          loading: 'Loading...',
          error: 'Error',
          success: 'Success',
          warning: 'Warning',
          info: 'Information'
        },
        auth: {
          login: 'Login',
          register: 'Register',
          logout: 'Logout',
          email: 'Email',
          password: 'Password',
          forgotPassword: 'Forgot Password?',
          resetPassword: 'Reset Password',
          confirmPassword: 'Confirm Password',
          rememberMe: 'Remember Me',
          loginSuccess: 'Login successful',
          loginError: 'Login failed',
          registerSuccess: 'Registration successful',
          registerError: 'Registration failed',
          invalidCredentials: 'Invalid email or password',
          userNotFound: 'User not found',
          accountExists: 'Account already exists',
          passwordMismatch: 'Passwords do not match'
        },
        product: {
          product: 'Product',
          products: 'Products',
          price: 'Price',
          quantity: 'Quantity',
          addToCart: 'Add to Cart',
          buyNow: 'Buy Now',
          outOfStock: 'Out of Stock',
          inStock: 'In Stock',
          description: 'Description',
          specifications: 'Specifications',
          reviews: 'Reviews',
          rating: 'Rating',
          categories: 'Categories',
          brand: 'Brand',
          color: 'Color',
          size: 'Size',
          material: 'Material',
          shipping: 'Shipping',
          returns: 'Returns',
          warranty: 'Warranty'
        },
        cart: {
          cart: 'Cart',
          shoppingCart: 'Shopping Cart',
          item: 'Item',
          items: 'Items',
          total: 'Total',
          subtotal: 'Subtotal',
          tax: 'Tax',
          shipping: 'Shipping',
          discount: 'Discount',
          coupon: 'Coupon',
          checkout: 'Checkout',
          emptyCart: 'Your cart is empty',
          addToCart: 'Add to Cart',
          removeFromCart: 'Remove from Cart',
          updateQuantity: 'Update Quantity',
          continueShopping: 'Continue Shopping',
          proceedToCheckout: 'Proceed to Checkout'
        },
        order: {
          order: 'Order',
          orders: 'Orders',
          orderHistory: 'Order History',
          orderDetails: 'Order Details',
          orderNumber: 'Order Number',
          orderDate: 'Order Date',
          orderStatus: 'Order Status',
          shippingAddress: 'Shipping Address',
          billingAddress: 'Billing Address',
          paymentMethod: 'Payment Method',
          paymentStatus: 'Payment Status',
          trackingNumber: 'Tracking Number',
          estimatedDelivery: 'Estimated Delivery',
          cancelOrder: 'Cancel Order',
          returnOrder: 'Return Order',
          reorder: 'Reorder',
          invoice: 'Invoice',
          receipt: 'Receipt'
        },
        user: {
          profile: 'Profile',
          account: 'Account',
          settings: 'Settings',
          personalInfo: 'Personal Information',
          contactInfo: 'Contact Information',
          shippingInfo: 'Shipping Information',
          billingInfo: 'Billing Information',
          preferences: 'Preferences',
          security: 'Security',
          notifications: 'Notifications',
          privacy: 'Privacy',
          language: 'Language',
          currency: 'Currency',
          timezone: 'Timezone',
          changePassword: 'Change Password',
          updateProfile: 'Update Profile',
          deleteAccount: 'Delete Account'
        },
        errors: {
          notFound: 'Not Found',
          unauthorized: 'Unauthorized',
          forbidden: 'Forbidden',
          serverError: 'Server Error',
          networkError: 'Network Error',
          validationError: 'Validation Error',
          timeoutError: 'Timeout Error',
          unknownError: 'Unknown Error',
          requiredField: 'This field is required',
          invalidEmail: 'Invalid email address',
          invalidPassword: 'Password must be at least 8 characters',
          passwordMismatch: 'Passwords do not match',
          fileTooLarge: 'File is too large',
          unsupportedFileType: 'Unsupported file type',
          quotaExceeded: 'Quota exceeded'
        },
        messages: {
          success: 'Operation completed successfully',
          saved: 'Saved successfully',
          deleted: 'Deleted successfully',
          updated: 'Updated successfully',
          created: 'Created successfully',
          sent: 'Sent successfully',
          copied: 'Copied to clipboard',
          noChanges: 'No changes made',
          confirmDelete: 'Are you sure you want to delete this item?',
          confirmAction: 'Are you sure you want to proceed?',
          operationSuccessful: 'Operation successful',
          operationFailed: 'Operation failed',
          pleaseWait: 'Please wait...',
          processing: 'Processing...',
          loadingData: 'Loading data...',
          noDataFound: 'No data found',
          selectOption: 'Please select an option',
          invalidInput: 'Invalid input',
          tryAgain: 'Please try again',
          contactSupport: 'Contact support for assistance'
        }
      }
    };
  }

  // Get translation for a key
  translate(key, locale = this.defaultLocale, params = {}) {
    // Use default locale if provided locale is not supported
    if (!this.supportedLocales.includes(locale)) {
      locale = this.defaultLocale;
    }

    // Get translation string
    let translation = this.getNestedValue(this.translations[locale], key);
    
    // Fallback to default locale if translation not found
    if (!translation && locale !== this.defaultLocale) {
      translation = this.getNestedValue(this.translations[this.defaultLocale], key);
    }

    // Return key if no translation found
    if (!translation) {
      return key;
    }

    // Replace parameters in translation string
    if (typeof translation === 'string' && Object.keys(params).length > 0) {
      return this.replaceParams(translation, params);
    }

    return translation;
  }

  // Get nested value from object using dot notation
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : null;
    }, obj);
  }

  // Replace parameters in translation string
  replaceParams(str, params) {
    return str.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return params[key] !== undefined ? params[key] : match;
    });
  }

  // Get supported locales
  getSupportedLocales() {
    return this.supportedLocales;
  }

  // Get default locale
  getDefaultLocale() {
    return this.defaultLocale;
  }

  // Set default locale
  setDefaultLocale(locale) {
    if (this.supportedLocales.includes(locale)) {
      this.defaultLocale = locale;
    }
  }

  // Get locale info
  getLocaleInfo(locale) {
    const localeInfo = {
      en: { name: 'English', code: 'en', flag: '🇺🇸' },
      es: { name: 'Español', code: 'es', flag: '🇪🇸' },
      fr: { name: 'Français', code: 'fr', flag: '🇫🇷' },
      de: { name: 'Deutsch', code: 'de', flag: '🇩🇪' },
      it: { name: 'Italiano', code: 'it', flag: '🇮🇹' },
      pt: { name: 'Português', code: 'pt', flag: '🇵🇹' },
      zh: { name: '中文', code: 'zh', flag: '🇨🇳' },
      ja: { name: '日本語', code: 'ja', flag: '🇯🇵' },
      ko: { name: '한국어', code: 'ko', flag: '🇰🇷' },
      ar: { name: 'العربية', code: 'ar', flag: '🇸🇦' }
    };

    return localeInfo[locale] || localeInfo[this.defaultLocale];
  }

  // Middleware to set locale from request
  middleware() {
    return (req, res, next) => {
      // Get locale from query parameter, header, or cookie
      let locale = req.query.locale || 
                   req.headers['accept-language']?.split(',')[0] || 
                   req.cookies?.locale || 
                   this.defaultLocale;

      // Extract language code from Accept-Language header
      if (locale.includes('-')) {
        locale = locale.split('-')[0];
      }

      // Set locale if supported
      if (this.supportedLocales.includes(locale)) {
        req.locale = locale;
      } else {
        req.locale = this.defaultLocale;
      }

      // Add translation helper to response
      res.t = (key, params = {}) => this.translate(key, req.locale, params);

      next();
    };
  }

  // Format date according to locale
  formatDate(date, locale = this.defaultLocale, options = {}) {
    const defaultOptions = {
      en: { year: 'numeric', month: 'long', day: 'numeric' },
      es: { year: 'numeric', month: 'long', day: 'numeric' },
      fr: { year: 'numeric', month: 'long', day: 'numeric' },
      de: { year: 'numeric', month: 'long', day: 'numeric' },
      it: { year: 'numeric', month: 'long', day: 'numeric' },
      pt: { year: 'numeric', month: 'long', day: 'numeric' },
      zh: { year: 'numeric', month: 'long', day: 'numeric' },
      ja: { year: 'numeric', month: 'long', day: 'numeric' },
      ko: { year: 'numeric', month: 'long', day: 'numeric' },
      ar: { year: 'numeric', month: 'long', day: 'numeric' }
    };

    const localeOptions = options[locale] || defaultOptions[locale] || defaultOptions.en;
    
    try {
      return new Date(date).toLocaleDateString(locale, localeOptions);
    } catch (error) {
      return new Date(date).toLocaleDateString(this.defaultLocale, defaultOptions.en);
    }
  }

  // Format currency according to locale
  formatCurrency(amount, locale = this.defaultLocale, currency = 'USD') {
    const currencyFormatters = {
      en: { style: 'currency', currency: 'USD' },
      es: { style: 'currency', currency: 'EUR' },
      fr: { style: 'currency', currency: 'EUR' },
      de: { style: 'currency', currency: 'EUR' },
      it: { style: 'currency', currency: 'EUR' },
      pt: { style: 'currency', currency: 'EUR' },
      zh: { style: 'currency', currency: 'CNY' },
      ja: { style: 'currency', currency: 'JPY' },
      ko: { style: 'currency', currency: 'KRW' },
      ar: { style: 'currency', currency: 'SAR' }
    };

    try {
      const formatter = currencyFormatters[locale] || currencyFormatters.en;
      return new Intl.NumberFormat(locale, formatter).format(amount);
    } catch (error) {
      return new Intl.NumberFormat(this.defaultLocale, currencyFormatters.en).format(amount);
    }
  }

  // Validate locale
  isValidLocale(locale) {
    return this.supportedLocales.includes(locale);
  }

  // Reload translations (useful for development)
  reloadTranslations() {
    this.translations = {};
    this.loadTranslations();
  }
}

// Create singleton instance
const i18n = new I18nHelper();

module.exports = i18n;
