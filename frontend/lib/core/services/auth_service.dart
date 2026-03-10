import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'api_service.dart';

class AuthService {
  final ApiService _apiService;

  AuthService(this._apiService);

  Future<Map<String, dynamic>> login(String email, String password) async {
    try {
      final response = await _apiService.post('/auth/login', data: {
        'email': email,
        'password': password,
      });

      final data = response.data;
      if (data['success']) {
        await _saveTokens(data['data']);
        return {'success': true, 'user': data['data']['user']};
      } else {
        return {'success': false, 'error': data['error']};
      }
    } catch (e) {
      return {'success': false, 'error': e.toString()};
    }
  }

  Future<Map<String, dynamic>> register(String name, String email, String password) async {
    try {
      final response = await _apiService.post('/auth/register', data: {
        'name': name,
        'email': email,
        'password': password,
      });

      final data = response.data;
      if (data['success']) {
        await _saveTokens(data['data']);
        return {'success': true, 'user': data['data']['user']};
      } else {
        return {'success': false, 'error': data['error']};
      }
    } catch (e) {
      return {'success': false, 'error': e.toString()};
    }
  }

  Future<void> logout() async {
    try {
      await _apiService.post('/auth/logout');
    } catch (e) {
      // Continue with logout even if API call fails
    } finally {
      await _clearTokens();
    }
  }

  Future<Map<String, dynamic>> refreshToken() async {
    try {
      final response = await _apiService.post('/auth/refresh');
      final data = response.data;
      
      if (data['success']) {
        await _saveTokens(data['data']);
        return {'success': true};
      } else {
        return {'success': false, 'error': data['error']};
      }
    } catch (e) {
      return {'success': false, 'error': e.toString()};
    }
  }

  Future<Map<String, dynamic>> forgotPassword(String email) async {
    try {
      final response = await _apiService.post('/auth/forgot-password', data: {
        'email': email,
      });

      final data = response.data;
      return {
        'success': data['success'],
        'message': data['message'] ?? 'Password reset email sent'
      };
    } catch (e) {
      return {'success': false, 'error': e.toString()};
    }
  }

  Future<Map<String, dynamic>> resetPassword(String token, String password) async {
    try {
      final response = await _apiService.post('/auth/reset-password', data: {
        'token': token,
        'password': password,
      });

      final data = response.data;
      return {
        'success': data['success'],
        'message': data['message'] ?? 'Password reset successful'
      };
    } catch (e) {
      return {'success': false, 'error': e.toString()};
    }
  }

  Future<Map<String, dynamic>> changePassword(String currentPassword, String newPassword) async {
    try {
      final response = await _apiService.post('/auth/change-password', data: {
        'currentPassword': currentPassword,
        'newPassword': newPassword,
      });

      final data = response.data;
      return {
        'success': data['success'],
        'message': data['message'] ?? 'Password changed successfully'
      };
    } catch (e) {
      return {'success': false, 'error': e.toString()};
    }
  }

  Future<bool> isLoggedIn() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('access_token');
    return token != null && token.isNotEmpty;
  }

  Future<String?> getCurrentUserId() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('user_id');
  }

  Future<Map<String, dynamic>?> getCurrentUser() async {
    final prefs = await SharedPreferences.getInstance();
    final userJson = prefs.getString('current_user');
    if (userJson != null) {
      // In a real app, you'd decode this JSON
      return {'id': prefs.getString('user_id'), 'name': 'User'};
    }
    return null;
  }

  Future<void> _saveTokens(Map<String, dynamic> data) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('access_token', data['token']);
    if (data['refreshToken'] != null) {
      await prefs.setString('refresh_token', data['refreshToken']);
    }
    if (data['user'] != null) {
      await prefs.setString('user_id', data['user']['id']);
      await prefs.setString('current_user', data['user'].toString());
    }
  }

  Future<void> _clearTokens() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('access_token');
    await prefs.remove('refresh_token');
    await prefs.remove('user_id');
    await prefs.remove('current_user');
  }
}

final authServiceProvider = Provider((ref) {
  final apiService = ref.read(apiServiceProvider);
  return AuthService(apiService);
});
