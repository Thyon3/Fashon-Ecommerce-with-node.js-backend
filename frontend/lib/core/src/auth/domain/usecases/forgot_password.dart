import 'package:frontend/core/src/auth/domain/repository/auth_repo.dart';
import 'package:frontend/core/usecase/usecase.dart';
import 'package:frontend/core/util/typedefs.dart';

class ForgotPassword extends UsecaseWithParams<void, String> {
  const ForgotPassword(this._repo);

  final AuthRepo _repo;

  // extending the usecase class to make the class callable

  ResultFuture<void> call(String params) => _repo.forgotPassword(email: params);
}
