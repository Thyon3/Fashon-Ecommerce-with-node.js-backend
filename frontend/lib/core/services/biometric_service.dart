import 'package:flutter/services.dart';
import 'package:local_auth/local_auth.dart';

class BiometricService {
  static final BiometricService _instance = BiometricService._internal();
  factory BiometricService() => _instance;
  BiometricService._internal();

  final LocalAuthentication _auth = LocalAuthentication();
  bool _isInitialized = false;

  Future<void> init() async {
    try {
      await _auth.getAvailableBiometrics();
      _isInitialized = true;
    } catch (e) {
      _isInitialized = false;
    }
  }

  Future<bool> isDeviceSupported() async {
    try {
      final isSupported = await _auth.isDeviceSupported();
      return isSupported;
    } catch (e) {
      return false;
    }
  }

  Future<List<BiometricType>> getAvailableBiometrics() async {
    try {
      return await _auth.getAvailableBiometrics();
    } catch (e) {
      return [];
    }
  }

  Future<bool> authenticate({
    String? reason,
    bool useErrorDialogs = true,
    bool stickyAuth = false,
    bool biometricOnly = false,
  }) async {
    try {
      final authenticated = await _auth.authenticate(
        localizedReason: reason ?? 'Authenticate to access your account',
        options: AuthenticationOptions(
          useErrorDialogs: useErrorDialogs,
          stickyAuth: stickyAuth,
          biometricOnly: biometricOnly,
        ),
      );
      return authenticated;
    } on PlatformException catch (e) {
      if (e.code == 'LockedOut') {
        // Too many attempts, biometrics locked
        return false;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  Future<bool> authenticateWithBiometrics({
    String? reason,
  }) async {
    return await authenticate(
      reason: reason,
      biometricOnly: true,
    );
  }

  Future<void> stopAuthentication() async {
    try {
      await _auth.stopAuthentication();
    } catch (e) {
      // Ignore errors when stopping authentication
    }
  }

  Future<bool> canCheckBiometrics() async {
    try {
      return await _auth.canCheckBiometrics;
    } catch (e) {
      return false;
    }
  }

  bool get isInitialized => _isInitialized;
}
