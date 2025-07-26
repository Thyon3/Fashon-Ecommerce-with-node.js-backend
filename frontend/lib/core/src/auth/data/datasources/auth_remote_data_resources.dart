import 'dart:convert';
import 'dart:io';

import 'package:flutter/cupertino.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:frontend/core/common/application/cache_helper.dart';
import 'package:frontend/core/common/singletons/cache.dart';
import 'package:frontend/core/errors/exception.dart';
import 'package:frontend/core/extensions/string_extension.dart';
import 'package:frontend/core/services/injection_container.dart';
import 'package:frontend/core/src/auth/data/models/user_model.dart';
import 'package:frontend/core/util/constants/network_constants.dart';
import 'package:frontend/core/util/constants/error_response.dart';
import 'package:frontend/core/util/constants/network_utils.dart';
import 'package:frontend/core/util/constants/typedefs.dart';
import 'package:http/http.dart' as http;

sealed class AuthRemoteDataResources {
  const AuthRemoteDataResources();

  Future<void> register({
    required String name,
    required String email,
    required String phone,
    required String password,
  });

  Future<UserModel> login({required String email, required String password});
  Future<bool> verifyToken();
  Future<void> forgotPassword({required String email});
  Future<void> verifyOtp({required String email, required String otp});
  Future<void> resetPassword({
    required String email,
    required String newPassword,
  });
}

const RESGISTER_ENDPOINT = '/register';
const LOGIN_ENDPOINT = '/login';
const FORGOT_PASSWORD_ENDPOINT = '/forgotPassword';
const VERIFY_TOKEN_ENDPOINT = '/verifyToken';
const VERIFY_OTP_ENDPOINT = '/verifYOtp';
const VERIFY_PASSWORD_ENDPOINT = '/verifyPassword';
const RESET_PASSWORD_ENDPOINT = '/resetPassword';

class AuthRemoteDataResourceImplementation implements AuthRemoteDataResources {
  const AuthRemoteDataResourceImplementation(this._client);
  final http.Client _client;
  @override
  Future<void> forgotPassword({required String email}) async {
    try {
      final uri = Uri.parse('${NetworkConstants.baseUrl}${RESGISTER_ENDPOINT}');
      final response = await _client.post(
        uri,
        body: jsonEncode({'email': email}),
        headers: NetworkConstants.header,
      );
      if (response.statusCode != 200) {
        final payload = jsonDecode(response.body) as DataMap;
        final errorResponse = ErrorResponse.fromMap(payload);
        throw ServerException(
          message: errorResponse.errorMessage,
          statusCode: response.statusCode,
        );
      }
    } on ServerException {
      rethrow;
    } catch (e, s) {
      debugPrint(e.toString());
      debugPrintStack(stackTrace: s);
      throw ServerException(message: e.toString(), statusCode: 500);
    }
  }

  @override
  Future<UserModel> login({
    required String email,
    required String password,
  }) async {
    try {
      final uri = Uri.parse('${NetworkConstants.baseUrl}$LOGIN_ENDPOINT');
      final response = await _client.post(
        uri,
        headers: NetworkConstants.header,
        body: jsonEncode({'email': email, 'password': password}),
      );

      final payload = jsonDecode(response.body) as DataMap;
      if (response.statusCode != 200) {
        final errorResponse = ErrorResponse.fromMap(payload);
        throw ServerException(
          message: errorResponse.errorMessage,
          statusCode: response.statusCode,
        );
      }
      // cache the accessToken of the user
      sl<CacheHelper>().cacheUserToken(payload['accessToken']);
      // return the user form the payload
      final user = UserModel.fromMap(payload);
      // cache the userId
      sl<CacheHelper>().cacheUserId(user.id);
      return user;
    } on ServerException {
      rethrow;
    } catch (e, s) {
      debugPrint(e.toString());
      debugPrintStack(stackTrace: s);
      throw ServerException(message: e.toString(), statusCode: 500);
    }
  }

  @override
  Future<void> register({
    required String name,
    required String email,
    required String phone,
    required String password,
  }) async {
    try {
      final uri = Uri.parse('${NetworkConstants.baseUrl}${RESGISTER_ENDPOINT}');
      final response = await _client.post(
        uri,
        headers: NetworkConstants.header,
        body: jsonEncode({
          "name": name,
          "email": email,
          "phone": phone,
          "passsword": password,
        }),
      );

      if (response.statusCode != 200) {
        final payload = jsonDecode(response.body) as DataMap;
        final errorResponse = ErrorResponse.fromMap(payload);
        throw ServerException(
          message: errorResponse.errorMessage,
          statusCode: response.statusCode,
        );
      }
    } on ServerException {
      rethrow;
    } catch (e, s) {
      debugPrint(e.toString());
      debugPrintStack(stackTrace: s);
      throw ServerException(message: e.toString(), statusCode: 500);
    }
  }

  @override
  Future<void> resetPassword({
    required String email,
    required String newPassword,
  }) async {
    try {
      final uri = Uri.parse(
        '${NetworkConstants.baseUrl}${RESET_PASSWORD_ENDPOINT}',
      );
      final response = await _client.post(
        uri,
        headers: NetworkConstants.header,
        body: jsonEncode({'email': email, 'newPassword': newPassword}),
      );
      if (response.statusCode != 200 && response.statusCode != 201) {
        final payload = jsonDecode(response.body) as DataMap;
        final errorResponse = ErrorResponse.fromMap(payload);
        throw ServerException(
          message: errorResponse.errorMessage,
          statusCode: response.statusCode,
        );
      }
    } on ServerException {
      rethrow;
    } catch (e, s) {
      debugPrint(e.toString());
      debugPrintStack(stackTrace: s);
      throw ServerException(message: e.toString(), statusCode: 500);
    }
  }

  @override
  Future<void> verifyOtp({required String email, required String otp}) async {
    try {
      final uri = Uri.parse(
        '${NetworkConstants.baseUrl}${VERIFY_OTP_ENDPOINT}',
      );
      final response = await _client.post(
        uri,
        body: jsonEncode({"email": email, "otp": otp}),
        headers: NetworkConstants.header,
      );
      if (response.statusCode != 200) {
        final payload = jsonDecode(response.body) as DataMap;
        final errorResponse = ErrorResponse.fromMap(payload);
        throw ServerException(
          message: errorResponse.errorMessage,
          statusCode: response.statusCode,
        );
      }
    } on ServerException {
      rethrow;
    } catch (e, s) {
      debugPrint(e.toString());
      debugPrintStack(stackTrace: s);
      throw ServerException(message: e.toString(), statusCode: 500);
    }
  }

  @override
  Future<bool> verifyToken() async {
    try {
      final uri = Uri.parse(
        '${NetworkConstants.baseUrl}${VERIFY_TOKEN_ENDPOINT}',
      );
      final response = await _client.get(
        uri,
        headers: Cache.instance.getSessionToken!.toAuthHeaders,
      );
      final payload = jsonDecode(response.body);
      await NetworkUtils.renewToken(response);

      if (response.statusCode != 200) {
        payload as DataMap;
        final errorResponse = ErrorResponse.fromMap(payload);
        throw ServerException(
          message: errorResponse.errorMessage,
          statusCode: response.statusCode,
        );
      }

      return payload as bool;
    } on ServerException {
      rethrow;
    } catch (e, s) {
      debugPrint(e.toString());
      debugPrintStack(stackTrace: s);
      throw ServerException(message: e.toString(), statusCode: 500);
    }
  }
}
