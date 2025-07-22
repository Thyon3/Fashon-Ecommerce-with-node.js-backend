import 'package:frontend/core/src/auth/domain/repository/auth_repo.dart';
import 'package:frontend/core/usecase/usecase.dart';
import 'package:frontend/core/util/typedefs.dart';

class VerifyToken extends UsecaseWithOutParams<void> {
  VerifyToken(this._repo);
  final AuthRepo _repo;

  @override
  ResultFuture<void> call() => _repo.verifyToken();
}
