import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:frontend/core/src/auth/domain/entities/user.dart';
import 'package:frontend/core/src/auth/domain/usecases/login.dart';
import 'package:frontend/core/src/auth/domain/usecases/register.dart';
import 'package:frontend/core/src/auth/domain/usecases/forgot_password.dart';
import 'package:frontend/core/src/auth/domain/usecases/reset_password.dart';
import 'package:frontend/core/src/auth/domain/usecases/verify_otp.dart';
import 'package:frontend/core/src/auth/domain/usecases/verify_token.dart';
import 'package:frontend/core/src/auth/presentation/app/adapter/auth_state.dart';
import 'package:frontend/core/common/application/cache_helper.dart';

class AuthAdapter extends StateNotifier<AuthState> {
  AuthAdapter({
    required Login login,
    required Register register,
    required ForgotPassword forgotPassword,
    required ResetPassword resetPassword,
    required VerifyOtp verifyOtp,
    required VerifyToken verifyToken,
    required CacheHelper cacheHelper,
  })  : _login = login,
        _register = register,
        _forgotPassword = forgotPassword,
        _resetPassword = resetPassword,
        _verifyOtp = verifyOtp,
        _verifyToken = verifyToken,
        _cacheHelper = cacheHelper,
        super(AuthInitial());

  final Login _login;
  final Register _register;
  final ForgotPassword _forgotPassword;
  final ResetPassword _resetPassword;
  final VerifyOtp _verifyOtp;
  final VerifyToken _verifyToken;
  final CacheHelper _cacheHelper;

  // Login method
  Future<void> login({
    required String email,
    required String password,
  }) async {
    state = const AuthLoading();
    
    final result = await _login(LoginParams(email: email, password: password));
    
    result.fold(
      (failure) => state = AuthError(failure.message, 'LOGIN_ERROR'),
      (user) {
        state = Authenticated(user);
        _cacheHelper.saveData(key: 'token', value: 'user_token_here'); // Replace with actual token
        _cacheHelper.saveData(key: 'user_id', value: user.id);
      },
    );
  }

  // Register method
  Future<void> register({
    required String name,
    required String email,
    required String password,
    required String phone,
  }) async {
    state = const AuthLoading();
    
    final result = await _register(RegisterParams(
      name: name,
      email: email,
      password: password,
      phone: phone,
    ));
    
    result.fold(
      (failure) => state = AuthError(failure.message, 'REGISTER_ERROR'),
      (user) {
        state = Authenticated(user);
        _cacheHelper.saveData(key: 'token', value: 'user_token_here'); // Replace with actual token
        _cacheHelper.saveData(key: 'user_id', value: user.id);
      },
    );
  }

  // Forgot password method
  Future<void> forgotPassword(String email) async {
    state = const AuthLoading();
    
    final result = await _forgotPassword(email);
    
    result.fold(
      (failure) => state = AuthError(failure.message, 'FORGOT_PASSWORD_ERROR'),
      (success) => state = PasswordResetSent(email),
    );
  }

  // Reset password method
  Future<void> resetPassword({
    required String email,
    required String otp,
    required String newPassword,
  }) async {
    state = const AuthLoading();
    
    final result = await _resetPassword(ResetPasswordParams(
      email: email,
      otp: otp,
      newPassword: newPassword,
    ));
    
    result.fold(
      (failure) => state = AuthError(failure.message, 'RESET_PASSWORD_ERROR'),
      (success) => state = const AuthInitial(),
    );
  }

  // Verify OTP method
  Future<void> verifyOtp({
    required String email,
    required String otp,
  }) async {
    state = const AuthLoading();
    
    final result = await _verifyOtp(VerifyOtpParams(email: email, otp: otp));
    
    result.fold(
      (failure) => state = AuthError(failure.message, 'OTP_VERIFICATION_ERROR'),
      (success) => state = OtpVerified(email),
    );
  }

  // Verify token method
  Future<void> verifyToken(String token) async {
    state = const AuthLoading();
    
    final result = await _verifyToken(token);
    
    result.fold(
      (failure) => state = const Unauthenticated(),
      (user) {
        state = Authenticated(user);
        _cacheHelper.saveData(key: 'token', value: token);
        _cacheHelper.saveData(key: 'user_id', value: user.id);
      },
    );
  }

  // Logout method
  void logout() {
    _cacheHelper.removeData(key: 'token');
    _cacheHelper.removeData(key: 'user_id');
    state = const Unauthenticated();
  }

  // Check authentication status on app start
  Future<void> checkAuthStatus() async {
    final token = _cacheHelper.getData(key: 'token');
    final userId = _cacheHelper.getData(key: 'user_id');
    
    if (token != null && token.isNotEmpty && userId != null && userId.isNotEmpty) {
      await verifyToken(token);
    } else {
      state = const Unauthenticated();
    }
  }

  // Clear error state
  void clearError() {
    if (state is AuthError) {
      state = const AuthInitial();
    }
  }

  // Get current user if authenticated
  User? get currentUser {
    if (state is Authenticated) {
      return (state as Authenticated).user;
    }
    return null;
  }

  // Check if user is authenticated
  bool get isAuthenticated => state is Authenticated;

  // Check if user is admin
  bool get isAdmin {
    if (state is Authenticated) {
      return (state as Authenticated).user.isAdmin;
    }
    return false;
  }
}
