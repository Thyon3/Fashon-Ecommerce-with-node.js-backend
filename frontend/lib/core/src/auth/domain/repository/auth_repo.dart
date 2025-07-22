// contains all the blue prints of  the auth operations
import 'package:frontend/core/common/entities/user.dart';
import 'package:frontend/core/util/typedefs.dart';

abstract class AuthRepo {
  ResultFuture<void> register({
    required String name,
    required String email,
    required String phone,
    required String password,
  });

  ResultFuture<User> login({required String email, required String password});
  ResultFuture<void> verifyToken();
  ResultFuture<void> forgotPassword({required String email});
  ResultFuture<void> verifyOtp({required String email, required String otp});
  ResultFuture<void> resetPassword({
    required String email,
    required String password,
  });
}
