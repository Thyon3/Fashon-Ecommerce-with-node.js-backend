import 'package:equatable/equatable.dart';
import 'package:frontend/core/src/auth/domain/repository/auth_repo.dart';
import 'package:frontend/core/usecase/usecase.dart';
import 'package:frontend/core/util/typedefs.dart';

class Register extends UsecaseWithParams<void, RegisterParams> {
  Register(this._repo);
  AuthRepo _repo;

  @override
  ResultFuture call(params) => _repo.register(
    name: params.name,
    email: params.email,
    phone: params.phone,
    password: params.password,
  );
}

class RegisterParams extends Equatable {
  RegisterParams({
    required this.name,
    required this.password,
    required this.email,
    required this.phone,
  });
  final String name;
  final String email;
  final String phone;
  final String password;

  RegisterParams.empty()
    : email = 'test string',
      password = 'test string',
      phone = 'test string',
      name = 'test string';
  @override
  // TODO: implement props
  List<Object?> get props => [name, email, phone, password];
}
