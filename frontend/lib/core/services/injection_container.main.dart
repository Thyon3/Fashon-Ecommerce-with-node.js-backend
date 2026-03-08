part of 'injection_container.dart';

final sl = GetIt.instance;

Future<void> init() async {
  // External dependencies
  final _prefs = await SharedPreferences.getInstance();
  
  // HTTP Client
  final dio = Dio();
  dio.options.baseUrl = 'https://your-api-base-url.com'; // Replace with actual API URL
  dio.options.connectTimeout = const Duration(seconds: 30);
  dio.options.receiveTimeout = const Duration(seconds: 30);
  dio.options.headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  // Core services
  sl
    ..registerLazySingleton(() => _prefs)
    ..registerLazySingleton(() => dio)
    ..registerLazySingleton(() => CacheHelper(sl()));

  // Repositories
  sl
    ..registerLazySingleton<AuthRepository>(
      () => AuthRepositoryImplementation(
        dio: sl(),
        cacheHelper: sl(),
      ),
    );

  // Use cases
  sl
    ..registerLazySingleton(() => Login(repository: sl()))
    ..registerLazySingleton(() => Register(repository: sl()))
    ..registerLazySingleton(() => ForgotPassword(repository: sl()))
    ..registerLazySingleton(() => ResetPassword(repository: sl()))
    ..registerLazySingleton(() => VerifyOtp(repository: sl()))
    ..registerLazySingleton(() => VerifyToken(repository: sl()));
}
