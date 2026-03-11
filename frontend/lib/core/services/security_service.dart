import 'dart:convert';
import 'dart:math';
import 'package:crypto/crypto.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class SecurityService {
  static final SecurityService _instance = SecurityService._internal();
  factory SecurityService() => _instance;
  SecurityService._internal();

  final FlutterSecureStorage _storage = const FlutterSecureStorage();
  final Random _random = Random.secure();

  // Encryption key management
  Future<String> generateSecureKey() async {
    final bytes = List<int>.generate(32, (_) => _random.nextInt(256));
    return base64Encode(bytes);
  }

  Future<void> storeSecureKey(String key, String value) async {
    await _storage.write(key: key, value: value);
  }

  Future<String?> getSecureKey(String key) async {
    return await _storage.read(key: key);
  }

  Future<void> deleteSecureKey(String key) async {
    await _storage.delete(key: key);
  }

  // Data encryption
  String encryptData(String data, String key) {
    final keyBytes = base64Decode(key);
    final dataBytes = utf8.encode(data);
    
    // Simple XOR encryption (in production, use proper encryption like AES)
    final encrypted = List<int>.generate(dataBytes.length, (i) {
      return dataBytes[i] ^ keyBytes[i % keyBytes.length];
    });
    
    return base64Encode(encrypted);
  }

  String decryptData(String encryptedData, String key) {
    final keyBytes = base64Decode(key);
    final encryptedBytes = base64Decode(encryptedData);
    
    // Simple XOR decryption
    final decrypted = List<int>.generate(encryptedBytes.length, (i) {
      return encryptedBytes[i] ^ keyBytes[i % keyBytes.length];
    });
    
    return utf8.decode(decrypted);
  }

  // Password hashing
  String hashPassword(String password, {String? salt}) {
    salt ??= _generateSalt();
    final bytes = utf8.encode(password + salt);
    final hash = sha256.convert(bytes);
    return '$salt:$hash';
  }

  bool verifyPassword(String password, String hashedPassword) {
    final parts = hashedPassword.split(':');
    if (parts.length != 2) return false;
    
    final salt = parts[0];
    final hash = parts[1];
    final computedHash = sha256.convert(utf8.encode(password + salt));
    
    return computedHash.toString() == hash;
  }

  String _generateSalt() {
    final bytes = List<int>.generate(16, (_) => _random.nextInt(256));
    return base64Encode(bytes);
  }

  // Token management
  Future<void> storeToken(String token, {String? key}) async {
    final storageKey = key ?? 'auth_token';
    await _storage.write(key: storageKey, value: token);
  }

  Future<String?> getToken({String? key}) async {
    final storageKey = key ?? 'auth_token';
    return await _storage.read(key: storageKey);
  }

  Future<void> deleteToken({String? key}) async {
    final storageKey = key ?? 'auth_token';
    await _storage.delete(key: storageKey);
  }

  // Session management
  Future<void> storeSession(Map<String, dynamic> session) async {
    final sessionJson = jsonEncode(session);
    await _storage.write(key: 'user_session', value: sessionJson);
  }

  Future<Map<String, dynamic>?> getSession() async {
    final sessionJson = await _storage.read(key: 'user_session');
    if (sessionJson != null) {
      try {
        return jsonDecode(sessionJson) as Map<String, dynamic>;
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  Future<void> clearSession() async {
    await _storage.delete(key: 'user_session');
  }

  // Biometric protection
  Future<void> enableBiometricProtection() async {
    await _storage.write(key: 'biometric_enabled', value: 'true');
  }

  Future<bool> isBiometricEnabled() async {
    final enabled = await _storage.read(key: 'biometric_enabled');
    return enabled == 'true';
  }

  Future<void> disableBiometricProtection() async {
    await _storage.delete(key: 'biometric_enabled');
  }

  // Security checks
  bool isSecurePassword(String password) {
    // Check password strength
    if (password.length < 8) return false;
    if (!password.contains(RegExp(r'[A-Z]'))) return false;
    if (!password.contains(RegExp(r'[a-z]'))) return false;
    if (!password.contains(RegExp(r'[0-9]'))) return false;
    if (!password.contains(RegExp(r'[!@#$%^&*(),.?":{}|<>]'))) return false;
    
    // Check for common patterns
    final commonPasswords = ['password', '123456', 'qwerty', 'admin'];
    if (commonPasswords.any((common) => password.toLowerCase().contains(common))) {
      return false;
    }
    
    return true;
  }

  bool isValidEmail(String email) {
    final emailRegex = RegExp(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$');
    return emailRegex.hasMatch(email);
  }

  bool isValidPhone(String phone) {
    final phoneRegex = RegExp(r'^[\d\s\-\+\(\)]+$');
    return phoneRegex.hasMatch(phone) && phone.replaceAll(RegExp(r'[^\d]'), '').length >= 10;
  }

  // Rate limiting
  final Map<String, List<DateTime>> _rateLimitMap = {};

  bool isRateLimited(String identifier, {int maxAttempts = 5, Duration window = const Duration(minutes: 5)}) {
    final now = DateTime.now();
    final attempts = _rateLimitMap[identifier] ?? [];
    
    // Remove old attempts
    attempts.removeWhere((time) => now.difference(time) > window);
    
    // Check if limit exceeded
    if (attempts.length >= maxAttempts) {
      return true;
    }
    
    // Add current attempt
    attempts.add(now);
    _rateLimitMap[identifier] = attempts;
    
    return false;
  }

  // Clear rate limiting
  void clearRateLimit(String identifier) {
    _rateLimitMap.remove(identifier);
  }

  // Security audit logging
  Future<void> logSecurityEvent(String event, Map<String, dynamic> context) async {
    final auditLog = {
      'event': event,
      'context': context,
      'timestamp': DateTime.now().toIso8601String(),
    };
    
    // Store in secure storage (in production, send to security service)
    await _storage.write(key: 'audit_${DateTime.now().millisecondsSinceEpoch}', value: jsonEncode(auditLog));
  }

  // Device fingerprinting
  Future<String> generateDeviceFingerprint() async {
    final components = [
      DateTime.now().millisecondsSinceEpoch.toString(),
      _random.nextInt(1000000).toString(),
      'fashon_app',
    ];
    
    final fingerprint = components.join('|');
    final hash = sha256.convert(utf8.encode(fingerprint));
    return hash.toString();
  }

  // Clear all security data
  Future<void> clearAllSecurityData() async {
    await _storage.deleteAll();
    _rateLimitMap.clear();
  }
}
