import 'package:frontend/core/common/singletons/cache.dart';
import 'package:frontend/core/extensions/theme_extension.dart';
import "package:shared_preferences/shared_preferences.dart";
import 'package:flutter/material.dart';

class CacheHelper {
  const CacheHelper(this._prefs);

  final SharedPreferences _prefs;

  //
  static const _sessionTokenKey = 'userToken';
  static const _userIdkey = 'userId';
  static const _themePreferenceKey = 'themePreference';
  static const _firstTimeKey = 'isItYourFirstTime';

  // now we will have the function

  Future<bool> cacheUserToken(String token) async {
    try {
      await _prefs.setString(_sessionTokenKey, token);
      Cache.instance.setSessionToken(token);

      return true;
    } catch (_) {
      return false;
    }
  }

  Future<bool> cacheUserId(String userId) async {
    try {
      await _prefs.setString(_userIdkey, userId);
      Cache.instance.setUserId(userId);
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<bool> cacheThemePreference(ThemeMode themePreference) async {
    try {
      await _prefs.setString(
        _themePreferenceKey,
        themePreference.getStringValue,
      );
      Cache.instance.setThemeModePreference(themePreference.getStringValue);
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<void> cacheFirstTime() async {
    await _prefs.setBool(_firstTimeKey, false);
  }

  String? getSessionToken() {
    final _token = _prefs.getString(_sessionTokenKey);
    if (_token != null) {
      Cache.instance.setSessionToken(_token);
    }
    return _token;
  }

  String? getUserId() {
    final _userId = _prefs.getString(_userIdkey);
    if (_userId != null) {
      Cache.instance.setUserId(_userId);
    }
    return _userId;
  }

  String? getThemeModePreference() {
    final _themeModePreference = _prefs.getString(_themePreferenceKey);
    if (_themeModePreference != null) {
      Cache.instance.setThemeModePreference(_themeModePreference);
    }
    return _themeModePreference;
  }

  Future<void> resetSession() async {
    // reset the session or just remove the sharedpreference variables

    await _prefs.remove(_sessionTokenKey);
    await _prefs.remove(_userIdkey);
    await _prefs.remove(_themePreferenceKey);
    Cache.instance.resetSession();
  }

  Future<bool> knowWhetherIsItYourFirstTimeOrNot() async {
    final value = await _prefs.getBool(_firstTimeKey);
    return value ?? true;
  }
}
