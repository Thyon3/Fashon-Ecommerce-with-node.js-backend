import 'package:equatable/equatable.dart';
import 'package:frontend/core/common/entities/user.dart';
import 'package:frontend/core/src/auth/domain/repository/auth_repo.dart';
import 'package:frontend/core/usecase/usecase.dart';
import 'package:frontend/core/util/typedefs.dart';

class Login extends UsecaseWithParams<User, LoginParms> {
  Login(this._repo);

  final AuthRepo _repo;

  @override
  ResultFuture<User> call(LoginParms params) =>
      _repo.login(email: params.email, password: params.password);
}

class LoginParms extends Equatable {
  LoginParms({required this.email, required this.password});

  final String email;
  final String password;

  LoginParms.empty() : email = 'test string', password = 'test stirng';
  @override
  // TODO: implement props
  List<Object?> get props => [email, password];
}
