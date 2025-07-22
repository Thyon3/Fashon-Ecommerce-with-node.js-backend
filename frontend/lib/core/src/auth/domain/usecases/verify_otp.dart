import 'package:equatable/equatable.dart';
import 'package:frontend/core/src/auth/domain/repository/auth_repo.dart';
import 'package:frontend/core/usecase/usecase.dart';
import 'package:frontend/core/util/typedefs.dart';

class VerifyOtp extends UsecaseWithParams<void, VerifyOtpParams> {
  VerifyOtp(this._repo);
  AuthRepo _repo;

  @override
  ResultFuture<void> call(VerifyOtpParams params) =>
      _repo.verifyOtp(email: params.email, otp: params.otp);
}

class VerifyOtpParams extends Equatable {
  VerifyOtpParams({required this.email, required this.otp});

  final String email;
  final String otp;

  VerifyOtpParams.empty() : email = 'test string', otp = 'test string';
  @override
  // TODO: implement props
  List<Object?> get props => [email, otp];
}
