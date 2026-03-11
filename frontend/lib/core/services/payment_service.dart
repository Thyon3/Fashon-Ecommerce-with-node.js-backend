import 'dart:convert';
import 'dart:math';
import 'package:crypto/crypto.dart';

class PaymentService {
  static final PaymentService _instance = PaymentService._internal();
  factory PaymentService() => _instance;
  PaymentService._internal();

  final Random _random = Random.secure();

  // Payment methods
  static const List<String> supportedCards = ['visa', 'mastercard', 'amex', 'discover'];
  static const List<String> supportedWallets = ['apple_pay', 'google_pay', 'paypal'];

  // Card validation
  bool isValidCardNumber(String cardNumber) {
    final cleanNumber = cardNumber.replaceAll(RegExp(r'[^\d]'), '');
    
    if (cleanNumber.length < 13 || cleanNumber.length > 19) {
      return false;
    }
    
    return _luhnCheck(cleanNumber);
  }

  bool _luhnCheck(String cardNumber) {
    int sum = 0;
    bool isEven = false;
    
    for (int i = cardNumber.length - 1; i >= 0; i--) {
      int digit = int.parse(cardNumber[i]);
      
      if (isEven) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }
      
      sum += digit;
      isEven = !isEven;
    }
    
    return sum % 10 == 0;
  }

  String getCardType(String cardNumber) {
    final cleanNumber = cardNumber.replaceAll(RegExp(r'[^\d]'), '');
    
    if (cleanNumber.startsWith('4')) {
      return 'visa';
    } else if (cleanNumber.startsWith('5') || cleanNumber.startsWith('2')) {
      return 'mastercard';
    } else if (cleanNumber.startsWith('3')) {
      if (cleanNumber.startsWith('34') || cleanNumber.startsWith('37')) {
        return 'amex';
      }
      return 'discover';
    }
    
    return 'unknown';
  }

  bool isValidExpiryDate(String month, String year) {
    try {
      final intMonth = int.parse(month);
      final intYear = int.parse(year) + 2000; // Convert YY to YYYY
      
      if (intMonth < 1 || intMonth > 12) {
        return false;
      }
      
      final now = DateTime.now();
      final expiryDate = DateTime(intYear, intMonth);
      final currentMonth = DateTime(now.year, now.month);
      
      return expiryDate.isAfter(currentMonth) || expiryDate.isAtSameMomentAs(currentMonth);
    } catch (e) {
      return false;
    }
  }

  bool isValidCVV(String cvv, String cardType) {
    int requiredLength;
    
    switch (cardType.toLowerCase()) {
      case 'amex':
        requiredLength = 4;
        break;
      case 'visa':
      case 'mastercard':
      case 'discover':
      default:
        requiredLength = 3;
        break;
    }
    
    return RegExp(r'^\d{$requiredLength}$').hasMatch(cvv);
  }

  // Tokenization
  String generatePaymentToken() {
    final timestamp = DateTime.now().millisecondsSinceEpoch.toString();
    final random = _random.nextInt(1000000).toString();
    final data = '$timestamp:$random';
    
    final bytes = utf8.encode(data);
    final digest = sha256.convert(bytes);
    
    return digest.toString();
  }

  Map<String, dynamic> tokenizeCard({
    required String cardNumber,
    required String expiryMonth,
    required String expiryYear,
    required String cvv,
    required String cardholderName,
  }) {
    final token = generatePaymentToken();
    final cardType = getCardType(cardNumber);
    
    return {
      'token': token,
      'card_type': cardType,
      'last_four': cardNumber.substring(cardNumber.length - 4),
      'expiry_month': expiryMonth,
      'expiry_year': expiryYear,
      'cardholder_name': cardholderName,
      'created_at': DateTime.now().toIso8601String(),
    };
  }

  // Payment processing
  Future<Map<String, dynamic>> processPayment({
    required String token,
    required double amount,
    required String currency,
    String? description,
    Map<String, dynamic>? metadata,
  }) async {
    try {
      // Simulate payment processing
      await Future.delayed(const Duration(seconds: 2));
      
      final success = _random.nextDouble() > 0.1; // 90% success rate
      final transactionId = 'txn_${generatePaymentToken()}';
      
      return {
        'success': success,
        'transaction_id': transactionId,
        'amount': amount,
        'currency': currency,
        'status': success ? 'completed' : 'failed',
        'created_at': DateTime.now().toIso8601String(),
        'error': success ? null : 'Payment declined',
      };
    } catch (e) {
      return {
        'success': false,
        'error': e.toString(),
        'status': 'failed',
      };
    }
  }

  // Refund processing
  Future<Map<String, dynamic>> processRefund({
    required String transactionId,
    required double amount,
    String? reason,
  }) async {
    try {
      // Simulate refund processing
      await Future.delayed(const Duration(seconds: 1));
      
      final refundId = 'ref_${generatePaymentToken()}';
      
      return {
        'success': true,
        'refund_id': refundId,
        'transaction_id': transactionId,
        'amount': amount,
        'reason': reason,
        'status': 'completed',
        'created_at': DateTime.now().toIso8601String(),
      };
    } catch (e) {
      return {
        'success': false,
        'error': e.toString(),
        'status': 'failed',
      };
    }
  }

  // Payment methods validation
  bool isSupportedCard(String cardType) {
    return supportedCards.contains(cardType.toLowerCase());
  }

  bool isSupportedWallet(String walletType) {
    return supportedWallets.contains(walletType.toLowerCase());
  }

  // Currency formatting
  String formatAmount(double amount, String currency) {
    switch (currency.toUpperCase()) {
      case 'USD':
      case 'EUR':
      case 'GBP':
        return '\$${amount.toStringAsFixed(2)}';
      case 'JPY':
        return '¥${amount.toStringAsFixed(0)}';
      default:
        return '${amount.toStringAsFixed(2)} $currency';
    }
  }

  // Security checks
  bool isHighRiskTransaction({
    required double amount,
    required String currency,
    String? countryCode,
  }) {
    // Simple risk assessment
    if (amount > 1000) return true; // High amount
    if (currency == 'BTC' || currency == 'ETH') return true; // Cryptocurrency
    if (countryCode == 'XX') return true; // Unknown country
    
    return false;
  }

  // Payment analytics
  Map<String, dynamic> getPaymentAnalytics(List<Map<String, dynamic>> transactions) {
    int totalTransactions = transactions.length;
    double totalAmount = 0.0;
    int successfulTransactions = 0;
    Map<String, int> paymentMethods = {};
    Map<String, double> currencyBreakdown = {};
    
    for (final transaction in transactions) {
      totalAmount += transaction['amount'] ?? 0.0;
      if (transaction['status'] == 'completed') {
        successfulTransactions++;
      }
      
      final method = transaction['payment_method'] ?? 'unknown';
      paymentMethods[method] = (paymentMethods[method] ?? 0) + 1;
      
      final currency = transaction['currency'] ?? 'USD';
      currencyBreakdown[currency] = (currencyBreakdown[currency] ?? 0.0) + (transaction['amount'] ?? 0.0);
    }
    
    return {
      'total_transactions': totalTransactions,
      'successful_transactions': successfulTransactions,
      'success_rate': totalTransactions > 0 ? (successfulTransactions / totalTransactions) * 100 : 0.0,
      'total_amount': totalAmount,
      'average_amount': totalTransactions > 0 ? totalAmount / totalTransactions : 0.0,
      'payment_methods': paymentMethods,
      'currency_breakdown': currencyBreakdown,
    };
  }

  // Recurring payments
  Map<String, dynamic> createSubscription({
    required String paymentToken,
    required double amount,
    required String currency,
    required String interval, // 'daily', 'weekly', 'monthly', 'yearly'
    Map<String, dynamic>? metadata,
  }) {
    final subscriptionId = 'sub_${generatePaymentToken()}';
    
    return {
      'subscription_id': subscriptionId,
      'payment_token': paymentToken,
      'amount': amount,
      'currency': currency,
      'interval': interval,
      'status': 'active',
      'created_at': DateTime.now().toIso8601String(),
      'next_billing': _calculateNextBilling(interval),
      'metadata': metadata ?? {},
    };
  }

  DateTime _calculateNextBilling(String interval) {
    final now = DateTime.now();
    
    switch (interval.toLowerCase()) {
      case 'daily':
        return now.add(const Duration(days: 1));
      case 'weekly':
        return now.add(const Duration(days: 7));
      case 'monthly':
        return DateTime(now.year, now.month + 1, now.day);
      case 'yearly':
        return DateTime(now.year + 1, now.month, now.day);
      default:
        return now.add(const Duration(days: 30));
    }
  }
}
