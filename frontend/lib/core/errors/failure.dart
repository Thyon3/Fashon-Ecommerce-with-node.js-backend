import 'package:equatable/equatable.dart';
import 'package:frontend/core/errors/exception.dart';

sealed class Failure extends Equatable {
  const Failure({required this.message, required this.statusCode});
  final String message;
  final String statusCode;

  String get getErrorMessage => '${statusCode} Error Message: ${message}';

  @override
  // TODO: implement props
  List<Object?> get props => [message, statusCode];
}

class ServerFailure extends Failure {
  const ServerFailure({required super.message, required super.statusCode});

  ServerFailure.fromException(ServerException e)
    : this(message: e.message, statusCode: e.statusCode);
}

class CacheFailure extends Failure {
  const CacheFailure({required super.message}) : super(statusCode: '3');
  CacheFailure.fromException(CacheException e) : this(message: e.message);
}
