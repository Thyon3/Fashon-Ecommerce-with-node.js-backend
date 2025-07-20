part of 'injection_container.dart';

final sl = GetIt.instance;
Future<void> init() async {
  final _prefs = await SharedPreferences.getInstance();
  sl
    ..registerLazySingleton(() => CacheHelper(sl()))
    ..registerLazySingleton(() => _prefs);
}
