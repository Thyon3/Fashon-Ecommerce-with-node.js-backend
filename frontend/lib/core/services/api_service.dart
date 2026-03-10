import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

class ApiService {
  late Dio _dio;
  late SharedPreferences _prefs;

  ApiService() {
    _dio = Dio(BaseOptions(
      baseUrl: 'http://localhost:3000/api',
      connectTimeout: const Duration(seconds: 30),
      receiveTimeout: const Duration(seconds: 30),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    ));

    // Add request interceptor for auth token
    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await _getToken();
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
      onError: (error, handler) async {
        if (error.response?.statusCode == 401) {
          // Handle token refresh
          await _refreshToken();
          // Retry the request
          final token = await _getToken();
          if (token != null) {
            error.requestOptions.headers['Authorization'] = 'Bearer $token';
            final response = await _dio.fetch(error.requestOptions);
            handler.resolve(response);
            return;
          }
        }
        handler.next(error);
      },
    ));

    // Add response interceptor for logging
    _dio.interceptors.add(InterceptorsWrapper(
      onResponse: (response, handler) {
        print('API Response: ${response.statusCode} ${response.requestOptions.path}');
        handler.next(response);
      },
      onError: (error, handler) {
        print('API Error: ${error.response?.statusCode} ${error.requestOptions.path}');
        handler.next(error);
      },
    ));
  }

  Future<String?> _getToken() async {
    _prefs ??= await SharedPreferences.getInstance();
    return _prefs.getString('access_token');
  }

  Future<void> _refreshToken() async {
    try {
      final response = await _dio.post('/auth/refresh');
      final token = response.data['data']['token'];
      await _prefs.setString('access_token', token);
    } catch (e) {
      // Handle refresh failure - logout user
      await _prefs.remove('access_token');
      await _prefs.remove('refresh_token');
    }
  }

  Future<Response> get(String path, {Map<String, dynamic>? query}) async {
    return await _dio.get(path, queryParameters: query);
  }

  Future<Response> post(String path, {dynamic data}) async {
    return await _dio.post(path, data: data);
  }

  Future<Response> put(String path, {dynamic data}) async {
    return await _dio.put(path, data: data);
  }

  Future<Response> delete(String path) async {
    return await _dio.delete(path);
  }

  Future<Response> upload(String path, FormData formData) async {
    return await _dio.post(path, data: formData);
  }

  // Health check
  Future<Map<String, dynamic>> checkHealth() async {
    final response = await get('/health');
    return response.data;
  }

  // API metrics
  Future<Map<String, dynamic>> getMetrics() async {
    final response = await get('/metrics');
    return response.data;
  }

  // API version
  Future<Map<String, dynamic>> getVersion() async {
    final response = await get('/version');
    return response.data;
  }
}

final apiServiceProvider = Provider((ref) => ApiService());
