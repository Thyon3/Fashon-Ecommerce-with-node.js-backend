import 'package:frontend/core/src/auth/domain/repository/auth_repo.dart';
import 'package:frontend/core/usecase/usecase.dart';
import 'package:frontend/core/util/constants/typedefs.dart';

class ResetPasswordParams {
  final String email;
  final String otp;
  final String newPassword;

  const ResetPasswordParams({
    required this.email,
    required this.otp,
    required this.newPassword,
  });

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    
    return other is ResetPasswordParams &&
           other.email == email &&
           other.otp == otp &&
           other.newPassword == newPassword;
  }

  @override
  int get hashCode => email.hashCode ^ otp.hashCode ^ newPassword.hashCode;

  @override
  String toString() => 'ResetPasswordParams(email: $email, otp: $otp, newPassword: [REDACTED])';
}

class ResetPassword extends UseCase<Success, ResetPasswordParams> {
  const ResetPassword(this._repository);

  final AuthRepository _repository;

  @override
  ResultFuture<Success> call(ResetPasswordParams params) async {
    return await _repository.resetPassword(
      email: params.email,
      otp: params.otp,
      newPassword: params.newPassword,
    );
  }
}
