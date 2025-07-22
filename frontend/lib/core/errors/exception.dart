import 'package:equatable/equatable.dart';

class ServerException extends Equatable implements Exception {
  ServerException({required this.message, required this.statusCode});

  final String message;
  final String statusCode;

  @override
  // TODO: implement props
  List<Object?> get props => [message, statusCode];
}

class CacheException extends Equatable implements Exception {
  CacheException({required this.message});

  final String message;

  @override
  // TODO: implement props
  List<Object?> get props => [message];
}
