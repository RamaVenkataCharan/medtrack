// mobile/src/services/apiService.js
import { AuthService } from './authService';
import { Platform } from 'react-native';

// In Android emulator: 10.0.2.2 points to host localhost; for iOS simulator / web: localhost
const DEFAULT_URL = Platform.select({
  android: 'http://10.0.2.2:4000',
  default: 'http://localhost:4000',
});

const API_URL = process.env.EXPO_PUBLIC_API_URL || DEFAULT_URL;

export class APIService {
  static async makeRequest(endpoint, method = 'GET', body = null) {
    try {
      const token = await AuthService.getAuthToken();

      const headers = {
        'Content-Type': 'application/json',
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const options = {
        method,
        headers,
      };

      if (body) {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(`${API_URL}${endpoint}`, options);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || `Request failed with status ${response.status}`);
      }

      return { success: true, data };
    } catch (err) {
      console.warn(`APIService ${method} ${endpoint} error:`, err.message);
      return { success: false, error: err.message };
    }
  }

  // ═══════════════════════════════════════════════════════════
  // CUSTOMER OPERATIONS
  // ═══════════════════════════════════════════════════════════

  static async getCustomers() {
    return this.makeRequest('/api/customers');
  }

  static async getCustomer(id) {
    return this.makeRequest(`/api/customers/${id}`);
  }

  static async createCustomer(phoneNumber, name, village, address) {
    return this.makeRequest('/api/customers', 'POST', {
      phone_number: phoneNumber,
      name,
      village,
      address,
    });
  }

  // ═══════════════════════════════════════════════════════════
  // ENTRY (PURCHASE) OPERATIONS
  // ═══════════════════════════════════════════════════════════

  static async getEntries(customerId) {
    return this.makeRequest(`/api/entries/customer/${customerId}`);
  }

  static async createEntry(customerId, medicines, amountPaid) {
    return this.makeRequest('/api/entries', 'POST', {
      customer_id: customerId,
      medicines,
      amount_paid: amountPaid,
    });
  }

  // ═══════════════════════════════════════════════════════════
  // PAYMENT (DUE SETTLEMENT) OPERATIONS
  // ═══════════════════════════════════════════════════════════

  static async getPayments(customerId) {
    return this.makeRequest(`/api/payments/customer/${customerId}`);
  }

  static async createPayment(customerId, amount, note) {
    return this.makeRequest('/api/payments', 'POST', {
      customer_id: customerId,
      amount,
      note,
    });
  }

  // Health check
  static async checkHealth() {
    return this.makeRequest('/health');
  }
}
