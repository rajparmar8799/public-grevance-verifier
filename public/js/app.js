/**
 * Swagat Grievance Verifier - Client-side Utilities
 * Form validation, UI enhancements, and common utilities
 */

// ==================== FORM VALIDATION ====================

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} - True if valid email
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone number (Indian format)
 * @param {string} phone - Phone number to validate
 * @returns {boolean} - True if valid 10-digit phone
 */
function isValidPhone(phone) {
  const phoneRegex = /^[0-9]{10}$/;
  return phoneRegex.test(phone.replace(/\D/g, ''));
}

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {object} - { isValid: boolean, message: string }
 */
function validatePassword(password) {
  const errors = [];

  if (password.length < 8) {
    errors.push('At least 8 characters');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('At least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('At least one lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('At least one number');
  }
  if (!/[!@#$%^&*]/.test(password)) {
    errors.push('At least one special character (!@#$%^&*)');
  }

  return {
    isValid: errors.length === 0,
    message: errors.length > 0 ? 'Password must contain: ' + errors.join(', ') : ''
  };
}

/**
 * Validate file size and type for evidence upload
 * @param {File} file - File to validate
 * @param {number} maxSizeMB - Maximum file size in MB (default: 5)
 * @returns {object} - { isValid: boolean, message: string }
 */
function validateFileUpload(file, maxSizeMB = 5) {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  if (!file) {
    return { isValid: false, message: 'No file selected' };
  }

  if (!allowedTypes.includes(file.type)) {
    return {
      isValid: false,
      message: 'Only JPEG, PNG, and WebP images are allowed'
    };
  }

  if (file.size > maxSizeBytes) {
    return {
      isValid: false,
      message: `File size must be less than ${maxSizeMB}MB (current: ${(file.size / 1024 / 1024).toFixed(2)}MB)`
    };
  }

  return { isValid: true, message: '' };
}

// ==================== FORM HANDLERS ====================

/**
 * Setup form validation listeners
 */
function setupFormValidation() {
  const signupForm = document.querySelector('form[action="/auth/signup"]');
  const loginForm = document.querySelector('form[action="/auth/login"]');

  if (signupForm) {
    setupSignupValidation(signupForm);
  }

  if (loginForm) {
    setupLoginValidation(loginForm);
  }
}

/**
 * Setup signup form validation
 * @param {HTMLFormElement} form - The signup form
 */
function setupSignupValidation(form) {
  const emailInput = form.querySelector('input[name="email"]');
  const passwordInput = form.querySelector('input[name="password"]');
  const nameInput = form.querySelector('input[name="name"]');
  const submitBtn = form.querySelector('button[type="submit"]');

  if (emailInput) {
    emailInput.addEventListener('blur', () => {
      const email = emailInput.value.trim();
      if (email && !isValidEmail(email)) {
        emailInput.classList.add('is-invalid');
        showValidationError(emailInput, 'Invalid email format');
      } else {
        emailInput.classList.remove('is-invalid');
        removeValidationError(emailInput);
      }
    });
  }

  if (passwordInput) {
    passwordInput.addEventListener('blur', () => {
      const result = validatePassword(passwordInput.value);
      if (!result.isValid && passwordInput.value.length > 0) {
        passwordInput.classList.add('is-invalid');
        showValidationError(passwordInput, result.message);
      } else {
        passwordInput.classList.remove('is-invalid');
        removeValidationError(passwordInput);
      }
    });
  }

  if (submitBtn) {
    form.addEventListener('submit', (e) => {
      if (!validateFormBeforeSubmit(form)) {
        e.preventDefault();
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Creating account...';
    });
  }
}

/**
 * Setup login form validation
 * @param {HTMLFormElement} form - The login form
 */
function setupLoginValidation(form) {
  const emailInput = form.querySelector('input[name="email"]');
  const passwordInput = form.querySelector('input[name="password"]');
  const submitBtn = form.querySelector('button[type="submit"]');

  if (submitBtn) {
    form.addEventListener('submit', (e) => {
      if (!emailInput.value.trim() || !passwordInput.value) {
        e.preventDefault();
        showAlert('Please fill in all fields', 'warning');
        return;
      }

      if (!isValidEmail(emailInput.value)) {
        e.preventDefault();
        showAlert('Invalid email format', 'danger');
        emailInput.focus();
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Signing in...';
    });
  }
}

/**
 * Validate form before submission
 * @param {HTMLFormElement} form - The form to validate
 * @returns {boolean} - True if form is valid
 */
function validateFormBeforeSubmit(form) {
  const inputs = form.querySelectorAll('[required]');
  let isValid = true;

  inputs.forEach(input => {
    if (!input.value.trim()) {
      input.classList.add('is-invalid');
      isValid = false;
    } else {
      input.classList.remove('is-invalid');
    }
  });

  return isValid;
}

/**
 * Show validation error message
 * @param {HTMLElement} element - Input element
 * @param {string} message - Error message
 */
function showValidationError(element, message) {
  let errorDiv = element.parentElement.querySelector('.invalid-feedback');
  if (!errorDiv) {
    errorDiv = document.createElement('div');
    errorDiv.className = 'invalid-feedback d-block mt-1';
    element.parentElement.appendChild(errorDiv);
  }
  errorDiv.textContent = message;
}

/**
 * Remove validation error message
 * @param {HTMLElement} element - Input element
 */
function removeValidationError(element) {
  const errorDiv = element.parentElement.querySelector('.invalid-feedback');
  if (errorDiv) {
    errorDiv.remove();
  }
}

// ==================== ALERTS & NOTIFICATIONS ====================

/**
 * Show alert message
 * @param {string} message - Alert message
 * @param {string} type - Alert type: 'success', 'danger', 'warning', 'info'
 * @param {number} duration - Duration to show (ms, 0 = permanent)
 */
function showAlert(message, type = 'info', duration = 5000) {
  const alertDiv = document.createElement('div');
  alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
  alertDiv.role = 'alert';
  alertDiv.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  `;

  const container = document.querySelector('.container-custom') || document.body;
  container.insertBefore(alertDiv, container.firstChild);

  if (duration > 0) {
    setTimeout(() => {
      alertDiv.remove();
    }, duration);
  }
}

// ==================== UI ENHANCEMENTS ====================

/**
 * Add loading state to buttons
 * @param {HTMLElement} button - Button element
 * @param {string} message - Loading message
 */
function setButtonLoading(button, message = 'Loading...') {
  button.disabled = true;
  button.dataset.originalText = button.innerHTML;
  button.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>${message}`;
}

/**
 * Reset button from loading state
 * @param {HTMLElement} button - Button element
 */
function resetButton(button) {
  button.disabled = false;
  button.innerHTML = button.dataset.originalText || 'Submit';
}

/**
 * Format currency for display
 * @param {number} value - Value to format
 * @returns {string} - Formatted currency string
 */
function formatCurrency(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0
  }).format(value);
}

/**
 * Format date for display
 * @param {string|Date} date - Date to format
 * @returns {string} - Formatted date string
 */
function formatDate(date) {
  return new Intl.DateTimeFormat('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(date));
}

/**
 * Capitalize first letter of string
 * @param {string} str - String to capitalize
 * @returns {string} - Capitalized string
 */
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ==================== UTILITIES ====================

/**
 * Get query parameter from URL
 * @param {string} param - Parameter name
 * @returns {string|null} - Parameter value or null
 */
function getQueryParam(param) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(param);
}

/**
 * Check if device is mobile
 * @returns {boolean} - True if mobile device
 */
function isMobileDevice() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * Debounce function for search inputs
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in ms
 * @returns {Function} - Debounced function
 */
function debounce(func, wait = 500) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// ==================== INITIALIZATION ====================

/**
 * Initialize all form handlers and UI enhancements
 */
document.addEventListener('DOMContentLoaded', () => {
  // Setup form validation
  setupFormValidation();

  // Initialize Bootstrap tooltips if available
  const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
  tooltipTriggerList.forEach(tooltipTriggerEl => {
    new bootstrap.Tooltip(tooltipTriggerEl);
  });

  // Initialize Lucide icons
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
});

// Export for use in other scripts
window.appUtils = {
  isValidEmail,
  isValidPhone,
  validatePassword,
  validateFileUpload,
  showAlert,
  setButtonLoading,
  resetButton,
  formatCurrency,
  formatDate,
  capitalize,
  getQueryParam,
  isMobileDevice,
  debounce
};
