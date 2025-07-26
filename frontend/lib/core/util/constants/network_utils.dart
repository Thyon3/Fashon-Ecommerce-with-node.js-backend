import 'package:frontend/core/common/application/cache_helper.dart';
import 'package:frontend/core/services/injection_container.dart';
import 'package:frontend/core/services/router.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;

class NetworkUtils {
  const NetworkUtils();
  static Future<void> renewToken(http.Response response) async {
    if (response.headers['authorization'] != null) {
      var token = response.headers['authorization'] as String;
      if (token.startsWith("Bearer")) {
        token = token.replaceFirst('Bearer', '').trim();
      }
      await sl<CacheHelper>().cacheUserToken(token);
    } else if (response.statusCode == 401) {
      rootNavigatorkey.currentContext!.go('/');
    }
  }
}
