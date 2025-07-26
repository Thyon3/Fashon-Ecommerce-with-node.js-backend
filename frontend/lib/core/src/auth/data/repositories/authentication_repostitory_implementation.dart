import 'package:dartz/dartz.dart';
import 'package:frontend/core/common/entities/user.dart';
import 'package:frontend/core/errors/exception.dart';
import 'package:frontend/core/errors/failure.dart';
import 'package:frontend/core/src/auth/domain/repository/auth_repo.dart';
import 'package:frontend/core/util/constants/typedefs.dart';

class AuthenticationRepostitoryImplementation implements AuthRepo {
  const AuthenticationRepostitoryImplementation(this._remoteDataSource);
  final AuthenticationRepostitoryImplementation _remoteDataSource;

  @override
  ResultFuture<void> forgotPassword({required String email}) async {
    try {
      await _remoteDataSource.forgotPassword(email: email);

      return Right(null);
    } on ServerException catch (e) {
      return Left(ServerFailure.fromException(e));
    }
  }

  @override
  ResultFuture<User> login({
    required String email,
    required String password,
  }) async {
    try {
      final result = await _remoteDataSource.login(
        email: email,
        password: password,
      );
      return Right(result as User);
    } on ServerException catch (e) {
      return Left(ServerFailure.fromException(e));
    }
  }

  @override
  ResultFuture<void> register({
    required String name,
    required String email,
    required String phone,
    required String password,
  }) async {
    try {
      await _remoteDataSource.register(
        name: name,
        email: email,
        phone: phone,
        password: password,
      );
      return Right(null);
    } on ServerException catch (e) {
      return Left(ServerFailure.fromException(e));
    }
  }

  @override
  ResultFuture<void> resetPassword({
    required String email,
    required String password,
  }) async {
    try {
      await _remoteDataSource.resetPassword(email: email, password: password);
      return Right(null);
    } on ServerException catch (e) {
      return Left(ServerFailure.fromException(e));
    }
  }

  @override
  ResultFuture<void> verifyOtp({
    required String email,
    required String otp,
  }) async {
    try {
      await _remoteDataSource.verifyOtp(email: email, otp: otp);
      return Right(null);
    } on ServerException catch (e) {
      return Left(ServerFailure.fromException(e));
    }
  }

  @override
  ResultFuture<bool> verifyToken() async {
    try {
      final result = await _remoteDataSource.verifyToken();
      return Right(result as bool);
    } on ServerException catch (e) {
      return Left(ServerFailure.fromException(e));
    }
  }
}
